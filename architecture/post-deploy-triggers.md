# Post-deploy triggers

**Status: design, not yet implemented.** This is the agreed shape for the
next (and last, by intent — see root `CLAUDE.md`) feature: a CI-triggered
regression check tied to a specific deploy, as opposed to the watchdog's
interval-based cron check (`architecture/watchdog-regression-detection.md`).
Written now so the reasoning survives independent of who implements it.

## Problem

The watchdog (`agent/src/watchdog/`) is reactive and interval-based: it
ticks every 30 minutes and has no notion of "a deploy just happened." A
regression introduced at 2:03pm might not get flagged until the 2:30
tick, and even then nothing ties the alert back to the commit that caused
it. A post-deploy trigger closes that gap: CI calls this system right
after a deploy, and a check runs against that specific deploy some time
later, with the result attributable to a SHA.

## Trigger mechanism: Cloudflare Workflows

This needs a one-shot, arbitrary-future-timestamp trigger per deploy —
the Cloudflare analog of AWS EventBridge Scheduler's one-time `at()`.
Options considered:

| Option | Why not |
|---|---|
| Cron Triggers (what the watchdog uses) | Fixed interval only (`*/30 * * * *`); can't express "run once, N minutes from now, for this deploy." |
| Durable Object alarms (`setAlarm`) | Genuinely one-shot, but **one alarm per DO** — concurrent deploys (multiple repos, or the same repo deploying twice in five minutes) would need a queue-pattern workaround just to avoid clobbering each other. |
| Queues `delaySeconds` | Delayed delivery, but no built-in multi-step retry/backoff once the message fires — everything after that point would be hand-rolled. |
| **Workflows** (`step.sleep()` / `step.sleepUntil()`) | Chosen. A durable, independently-retriable sequence: wait → sample metrics → compare → maybe escalate → persist. State survives Worker restarts; sleeping instances cost nothing. |

One Workflow instance per deploy, id'd by commit SHA, gives idempotency
for free — a re-run of the same CI job doesn't spawn a duplicate check
(`env.MY_WORKFLOW.create({ id })` throws if the ID already exists within
the retention period).

## Entry point

New route, `POST /api/deploys`, mounted in `agent/src/index.ts` alongside
the existing `/api/investigate` and `/api/alerts`. Unlike the cron tick
(internal only, nothing external can hit it), this endpoint is called
from GitHub Actions — it needs its own shared-secret auth, checked against
a new Worker secret (e.g. `DEPLOY_WEBHOOK_SECRET`, set the same way as
the existing secrets documented in `agent/wrangler.toml`).

Request body: the resolved config from the CI YAML (see below) plus the
deploy SHA. Handler validates the shared secret, records the deploy in a
new `deploys` table, then creates a Workflow instance:

```ts
await env.POST_DEPLOY_CHECK.create({
  id: sha,
  params: { sha, routes, after, baseline, sensitivity },
});
```

## Data model

Two new tables, same D1 database (`TARGET_DB`), same migration-directory
convention as `agent/migrations/0001_watchdog.sql`
(see `architecture/d1-schema.md`):

```sql
-- One row per deploy this system was told about. The baseline resolver
-- (below) reads this to turn a SHA into a time window.
CREATE TABLE deploys (
  sha TEXT PRIMARY KEY,
  deployed_at INTEGER NOT NULL
);

CREATE INDEX idx_deploys_deployed_at ON deploys (deployed_at);

-- One row per (deploy, route) check — mirrors watchdog_alerts' shape,
-- but every check is recorded here, not just the ones that escalate,
-- since "no regression found" is itself a useful CI-visible result.
CREATE TABLE deploy_checks (
  id TEXT PRIMARY KEY,
  sha TEXT NOT NULL,
  route TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  regression_detected INTEGER NOT NULL,
  changepoint_label TEXT,
  baseline_sha TEXT,
  alert_id TEXT -- FK to watchdog_alerts.id when escalated, else NULL
);

CREATE INDEX idx_deploy_checks_sha ON deploy_checks (sha);
```

`deploy_checks.alert_id` is the join back to `watchdog_alerts` — an
escalated post-deploy check produces the exact same investigator
transcript an escalated cron check does (see below), so there's no reason
to duplicate that table.

## Workflow steps

```
step.sleep(after)
  → for each route in routes:
      step.do("resolve baseline window", ...)   // see below
      step.do("sample post-deploy metrics", ...) // getRouteMetrics, post-deploy window
      step.do("sample baseline metrics", ...)    // getRouteMetrics, baseline window
      step.do("compare", ...)                    // findRegressionWindow, with sensitivity's threshold
      if regression:
        step.do("investigate", ...)              // triggerInvestigation — same function the cron watchdog calls
      step.do("persist deploy_checks row", ...)
```

Every function above already exists and is reused as-is:
`getRouteMetrics` (`agent/src/mastra/tools/routeMetrics.ts`),
`findRegressionWindow` (`agent/src/mastra/tools/regression.ts`, needs the
threshold parameter described below), and `triggerInvestigation`
(`agent/src/watchdog/runWatchdogCheck.ts`) — the same investigator agent
run, the same `watchdog_alerts` write. A post-deploy check and a cron
check that both find a regression on `/api/orders` produce
indistinguishable investigation transcripts; only how they got triggered
differs.

## Baseline resolution

`baseline` accepts `"previous-deploy"` or an explicit SHA. Both resolve
to a window via the new `deploys` table:
`[deployed_at(baseline_sha), deployed_at(next deploy after baseline_sha))`.
`"previous-deploy"` is the same lookup with "next deploy" implicitly
being *this* deploy.

Explicit SHA is the recommended option, not just an alternative.
`"previous-deploy"` has a boiling-frog problem: if deploy N-1 already
regressed by 8% and slipped under the threshold, comparing deploy N
against N-1 only catches *additional* regression on top of that — the
original 8% is baked into the baseline and becomes permanently invisible.
Pinning `baseline: <known-good-sha>` fixes the reference point until a
human deliberately moves it.

Edge cases the resolver must handle:
- Baseline SHA not in `deploys` → config error in the check result, not
  a silent fallback to some other window.
- Baseline SHA is still the current live deploy (no "next" boundary yet)
  → reject; comparing a deploy against itself is meaningless.
- Baseline window too short to sample (e.g. it was live 90 seconds
  before a rollback) → same `values.length < 4` guard
  `findRegressionWindow` already enforces, surfaced as "insufficient
  baseline data" rather than a silent null.

`"1h trailing window"` (considered, dropped) doesn't have this integrity
property and mostly duplicates what the cron watchdog already checks.

## Sensitivity

`findRegressionWindow` currently hardcodes its threshold
(`regression.ts:53`, `bestScore < 1.5`). This needs a third optional
parameter, `threshold = 1.5`, so the existing cron-watchdog callsite in
`checkRoute.ts` is unaffected by omission. `sensitivity` in the CI config
maps to that threshold:

| `sensitivity` | threshold |
|---|---|
| `low` | `2.5` |
| `default` | `1.5` — identical to what the cron watchdog has run in production since inception |
| `high` | `1.0` |

What these numbers mean statistically, and why they're set where they
are, is documented separately in
[`regression-score-interpretation.md`](regression-score-interpretation.md)
— it's independently useful context for reading `watchdog_runs`/
`watchdog_alerts` too, not specific to this feature.

A raw numeric override (`sensitivity: 1.7`) is deliberately not exposed —
see deferred list.

## CI config surface (v1)

```yaml
- uses: millisecond/post-deploy-check@v1
  with:
    endpoint: "https://api.example.com"
    routes: "*"                  # or explicit list: "/checkout,/cart"
    after: "5m"                  # warmup delay before sampling starts
    window: "10m"                # how long to sample post-deploy
    baseline: "previous-deploy"  # or an explicit commit SHA
    sensitivity: "default"       # low | default | high
    deploy-sha: ${{ github.sha }}
```

Surfaced only in the existing web UI (new `GET /api/deploys` +
`GET /api/deploys/:id`, same list/detail shape as `agent/src/routes/alerts.ts`)
— no new notification channel.

## Explicitly deferred

- **`fail-on-regression` gating CI** — turns this from observability into
  a release gate; a false positive would block a deploy, which is a much
  bigger blast radius than a false-positive alert. Not worth it until the
  detector's real-world false-positive rate is known.
- **Staggered checks** (e.g. at 2min and 15min post-deploy, to catch both
  immediate and slow-burn regressions) — no evidence yet that a single
  check window misses regressions the current design would catch.
- **Error-rate as a second signal alongside P99** — would need a schema
  change to `spans`; no evidence the wall-time-only detector is
  insufficient.
- **Raw numeric `sensitivity` override** — the enum keeps the surface
  small and keeps `1.5` legible as "what production already trusts"; a
  free-form number invites tuning nobody has the data to calibrate.
