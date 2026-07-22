# Architecture

Technical reference for how millisecond.dev works internally. Assumes
familiarity with the codebase; see `CLAUDE.md` for engineering
principles and package-level `CLAUDE.md` files for conventions.

## Two-worker split

Two Cloudflare Workers, one shared D1 database.

- `target/` (`millisecond-target`) — the instrumented service being
  monitored. Owns the `spans` table. No knowledge of the agent.
- `agent/` (`millisecond-agent`) — the investigation agent, watchdog, and
  API. Reads `target/`'s D1 database via the same `database_id`, bound
  under a different binding name (`TARGET_DB` vs `target/`'s `DB`). No
  knowledge of `target/`'s source beyond its GitHub repo (read via API
  for diffs).

Why split: `target/` must be redeployable/breakable independently — it's
the thing under test, and a "bad deploy" regressing it is the point.
`agent/` holds its own secrets (OpenAI, Braintrust, GitHub, CF API token)
that `target/` has no reason to have.

**D1 sharing mechanism.** Both `wrangler.toml`s bind the same
`database_id` under different binding names. D1 databases aren't
Worker-scoped — any Worker with the ID in its own `[[d1_databases]]`
block can read/write it. No cross-worker RPC, no service bindings;
`agent/` treats `target/`'s D1 database as a regular dependency, not a
call to the other Worker.

**Env access pattern** (`agent/src/env.ts`):
`import { env as workerEnv } from "cloudflare:workers"` at module scope,
cast once, re-exported. Load-bearing: constructing `new Mastra({...})` /
`new D1Store({...})` eagerly at module scope fails Wrangler's deploy-time
validation if it references a binding sourced any other way, because
that validation pass runs before bindings exist. `createMastra(env)`
(`agent/src/mastra/index.ts`) is called per-request from Hono's `c.env`
for the same reason — not at module scope. Tool `execute` functions
import the `cloudflare:workers` env directly, since they only ever run
mid-request, after bindings are real.

**Mastra-as-library, not Mastra's own deployer.**
`@mastra/deployer-cloudflare` generates its own `wrangler.jsonc`/server —
not used. `agent/` has a hand-authored `wrangler.toml` (cron trigger, D1
binding, custom domain routing) and one Hono app serving both
`/api/investigate` and `/api/alerts`. `mastra.getAgentById(...)` is
called from inside Hono route handlers instead.

## D1 schema

One physical database (`millisecond-target-db`), bound into both
Workers, four logical owners:

| Table | Owner | Written by | Read by |
|---|---|---|---|
| `spans` | target/ | `spanMiddleware` (`target/src/middleware/spans.ts`) — once per request (`span_name='total'`), once per instrumented sub-operation | `getRouteMetrics`, `getTraceSpans` |
| `mastra_*` | Mastra `D1Store` | Mastra internals (thread/message state), `tablePrefix: "mastra_"` | Mastra internals only |
| `watchdog_runs` | agent/watchdog | `checkRoute.ts`, every cron tick | audit/debug only, no reader yet |
| `watchdog_alerts` | agent/watchdog | `runWatchdogCheck.ts`'s `triggerInvestigation`, only when `shouldTrigger` | `GET /api/alerts`, `/api/alerts/:id` |

`spans` (`target/migrations/0001_init.sql`):

```sql
CREATE TABLE spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  route TEXT NOT NULL,
  span_name TEXT NOT NULL,
  start_ms REAL NOT NULL,
  duration_ms REAL NOT NULL,
  ts INTEGER NOT NULL
);
```

`span_name = 'total'` rows are the request-level record (`spanMiddleware`
wraps the whole handler). Other `span_name` values are sub-operations
timed inline in route handlers (`kv.get:cart`, `d1.query:inventory-check`,
`fetch:payment-provider`). `getRouteMetrics` filters on `span_name='total'`
only; sub-operation spans are for `getTraceSpans`'s waterfall, not P50/P99.

`watchdog_runs` / `watchdog_alerts` (`agent/migrations/0001_watchdog.sql`):
both indexed on the columns `checkRoute`'s cooldown lookup and
`listAlertsRoute` actually query (`route, checked_at` / `detected_at`).

Two migration directories, one physical database. `wrangler d1
migrations apply` runs separately per-package against the same
`database_id` — no shared migration tracking between them. Collisions
are avoided by table-name convention (`spans` vs `mastra_*` vs
`watchdog_*`), not by tooling.

## Tool / agent design

One `Agent` (`agent/src/mastra/agents/investigator.ts`), seven tools
(`agent/src/mastra/tools/`), each a `createTool` call with a Zod schema:

| Tool | Data source | Also a plain function? |
|---|---|---|
| `getRouteMetrics` | D1 `spans` | yes — watchdog's `checkRoute` calls it directly |
| `getMetrics` | Cloudflare GraphQL Analytics | no |
| `findRegressionWindow` | pure computation | yes — watchdog calls it directly |
| `listDeploys` | GitHub API | no |
| `getDiff` | GitHub API | no |
| `getTraceSpans` | D1 `spans` | no |
| `getCostEstimate` | pure computation | no |

Two tools export their underlying function separately from the
`createTool` wrapper, because the watchdog's cheap tier needs to call
them without an LLM turn. Nothing else does — this isn't a general
pattern applied uniformly, it's exactly two exceptions with a reason.

**Model.** `gpt-5.5` via `@ai-sdk/openai`'s `createOpenAI({ apiKey })`,
not Mastra's `model: "openai/gpt-5.5"` string shorthand — the shorthand
reads the key from `process.env`, which Workers doesn't populate from
`wrangler secret`. `agent.stream()` is called with `providerOptions: {
openai: { reasoningSummary: "auto" } }`: without it, the Responses API
performs the reasoning but never emits `reasoning-delta` chunks, so it's
invisible both in the UI and in Braintrust.

**System prompt** (`buildSystemPrompt`, interpolated per-request, not a
static template):
- Current UTC time is injected. Without it the model guesses ISO
  timestamps and burns tool-call budget on invalid ranges.
- Explicit instruction never to stop and ask for confirmation — this is
  a non-interactive agent; a hedged final answer is acceptable, a
  clarifying question is not.
- Explicit tool-call economy rules (exact route strings, no
  retry-with-trivial-variant, each `(tool, args)` pair at most once) —
  added after a real run wasted a chunk of its subrequest budget
  retrying `/orders` vs `/api/orders` vs `/api/orders/`. See "Gotchas."
- `maxSteps: 15` (Mastra default is 5) — seven tools plus a synthesis
  step doesn't fit in five steps; found via an actual run that hit the
  cap and ended with no answer.

## Streaming pipeline

```
agent.stream() → stream.fullStream (Mastra ChunkType)
  → toWireEvent()            agent/src/lib/wireEvents.ts   → WireEvent
  → toNdjsonLines()                                        → NDJSON HTTP body
  → investigate()            web/src/api.ts                → parsed WireEvent
  → investigationReducer()   web/src/state.ts               → TranscriptItem[]
  → React render
```

Three narrowing steps, each deliberate:

1. **`ChunkType` → `WireEvent`.** Mastra's `ChunkType` union has ~25
   variants (`step-start`, `tool-call-delta`, `object-result`,
   background-task events, etc.). `WireEvent` keeps six: `tool-call`,
   `tool-result`, `reasoning-delta`, `text-delta`, `error`, `finish`.
   Everything else is dropped in `toWireEvent`'s `default: return null`.
   The frontend never needs Mastra's internal vocabulary.
2. **`WireEvent` stream → NDJSON.** One JSON object per line, streamed as
   the HTTP response body (`content-type: application/x-ndjson`). Chosen
   over SSE for simplicity — no `event:`/`data:` framing, `api.ts` just
   splits on `\n`.
3. **`WireEvent[]` → `TranscriptItem[]`.** `investigationReducer`
   collapses consecutive `reasoning-delta`/`text-delta` events sharing an
   `id` into one growing string (`appendToTextBlock`) instead of
   rendering hundreds of tiny fragments as separate blocks. `tool-call`
   opens a block; the matching `tool-result` (matched on `toolCallId`)
   closes it.

`agent/src/lib/transcript.ts`'s `TranscriptBuilder` is the same merge
logic as `investigationReducer`, duplicated server-side for the watchdog
(`runWatchdogCheck.ts`), which has no browser to run a React reducer in.
Not shared as a package between `agent/` and `web/` — two independent
copies, kept in sync by hand. Both packages' `CLAUDE.md` flag this.

## Watchdog: regression detection (cheap tier)

Runs every cron tick (`agent/wrangler.toml`, `*/30 * * * *`) for each
route in `MONITORED_ROUTES` (`agent/src/watchdog/routes.ts`). No LLM
call. Deterministic.

**Data source.** `getRouteMetrics` (`agent/src/mastra/tools/routeMetrics.ts`)
reads the `total` span from D1, filtered by route over a 6-hour lookback
(`LOOKBACK_MS`). Grouped into 5-minute buckets (`BUCKET_MS`); P50/P99
wall time computed per bucket.

**Changepoint detection.** `findRegressionWindow`
(`agent/src/mastra/tools/regression.ts`) takes the P99 series (one value
per bucket) and evaluates every split point:

```
score(split) = |mean(right) - mean(left)| / pooledStd(left, right)
```

Selects the split with the maximum score. Flags a regression only if:
- `mean(right) > mean(left)` — slower, not faster
- `score >= 1.5` — hardcoded threshold (`regression.ts:61`)

Level-shift detection has a closed-form statistical answer. An LLM adds
cost and unreliability here with no accuracy benefit.

**Cooldown.** `checkRoute` (`agent/src/watchdog/checkRoute.ts`) queries
`watchdog_alerts` for the most recent `detected_at` for that route.
`shouldTrigger = true` iff a regression is flagged AND the last alert for
that route is absent or older than `COOLDOWN_MS` (2 hours). Prevents a
persistent regression from re-triggering a full investigation on every
tick.

**Audit trail.** Every check — regardless of outcome — is inserted into
`watchdog_runs`. Independent of whether the expensive tier fires.

**Handoff.** `shouldTrigger = true` is the only path into
`triggerInvestigation` (`agent/src/watchdog/runWatchdogCheck.ts`), which
runs the full investigator agent (LLM, multi-tool) and persists to
`watchdog_alerts`. Everything above this line is free in LLM-cost terms;
everything below is not.

## Gotchas

Three bugs found only by deploying and exercising the real system, not
by reading Mastra's or Cloudflare's docs.

**Microsecond/millisecond unit mismatch.** Cloudflare's GraphQL Analytics
API (`workersInvocationsAdaptive`) returns `cpuTime`/`wallTime` quantiles
in **microseconds**. Nothing in the schema or field naming indicates
this. Confirmed by a live query returning `wallTimeP50: 180460` for a
route that takes ~180ms — a 1000x mismatch that silently made every
latency number the agent reported look three orders of magnitude worse
than reality. Fixed by dividing by 1000 at the tool boundary
(`getMetrics`, `metrics.ts`) — every downstream consumer works in
milliseconds only.

**Free-plan subrequest limit (50/invocation).** Cloudflare Workers on the
Free plan cap external subrequests (any `fetch()`, not calls through a
binding like D1/KV) at 50 per invocation, non-configurable — the
`[limits] subrequests` wrangler config only raises this on Paid. A single
investigation legitimately makes one OpenAI call per agentic step (up to
`maxSteps: 15`) plus a GitHub/Cloudflare API call per relevant tool
invocation; a model retrying a tool with slightly-wrong arguments (route
string variants) burns the budget on waste before finishing. Mitigated,
not eliminated, by the system-prompt economy rules (see "Tool / agent
design") — this remains a hard ceiling on investigation depth on the
Free plan.

**Per-invocation CPU/memory limit (error 1102) from raw event
accumulation.** An earlier version of the watchdog's
`triggerInvestigation` collected the full raw `WireEvent` stream (up to
~1,600 events for one investigation — every individual `reasoning-delta`
token, every tool call's complete args/results) into an array, then
reduced it to a transcript at the end. This hit Cloudflare's CPU/memory
limit on a real (not synthetic) investigation. Fixed by building the
compact `TranscriptItem[]` representation incrementally via
`TranscriptBuilder.add()` as each event arrives, so the full raw stream
is never held in memory at once. The stale alert row written by the
pre-fix code (raw `WireEvent[]` instead of merged `TranscriptItem[]`)
had to be manually deleted from `watchdog_alerts` after the fix landed —
old data doesn't retroactively conform to a new shape.
