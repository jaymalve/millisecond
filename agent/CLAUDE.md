# agent/

The submission: a Mastra agent, deployed as a Cloudflare Worker, that
investigates performance regressions in `target/`.

## Structure

- `src/index.ts` — Hono app: CORS + route mounting only.
- `src/routes/investigate.ts` — the one HTTP route. Reads the request,
  calls the agent, streams the response back.
- `src/mastra/index.ts` — `createMastra(env)`: builds the `Mastra`
  instance (agent registry + Braintrust observability config) from an
  explicit `Env`. This is the only file that constructs `new Mastra({...})`.
- `src/mastra/agents/investigator.ts` — `createInvestigatorAgent(env)`:
  the agent definition (a slim, always-present base prompt, model, tool
  registry), also built from an explicit `Env` rather than a
  module-scope singleton.
- `src/mastra/skills/*.ts` — one file per domain playbook (tool order,
  evidence bar, final-answer shape), each exporting a single template
  string, registered by name in `src/mastra/skills/index.ts`. The base
  prompt does not contain this guidance; the agent fetches it via the
  `loadSkill` tool once it knows which domain a question falls into. See
  [`architecture/agent-skills.md`](../architecture/agent-skills.md) for
  why this is split out instead of one growing system prompt.
- `src/mastra/tools/*.ts` — one file per tool, each a `createTool` call
  with a Zod input/output schema. Tool logic (the actual fetch/query/calc)
  lives in the same file as its schema — there's exactly one thing calling
  it, so splitting them apart would be indirection, not clarity.
  `getRouteMetrics`/`findRegressionWindow` also export their underlying
  plain functions, since the watchdog (below) needs to call them without
  going through an LLM turn. `src/mastra/tools/skills.ts` is the one
  exception that isn't a data-fetching tool — it's `loadSkill`, reading
  from the skills registry above rather than an external source.
- `src/watchdog/` — the scheduled, autonomous half of the agent. See its
  own section below.
- `src/routes/alerts.ts` — `GET /api/alerts` (list) and `GET
  /api/alerts/:id` (full transcript), reading from the watchdog's own D1
  tables. Separate from `investigate.ts`'s manual, streamed flow —
  watchdog investigations already ran to completion server-side by the
  time anyone requests them.
- `src/postDeploy/` — the CI-triggered half of the agent (a Workflow, not
  a cron tick). See its own section below.
- `src/routes/deploys.ts` — `POST /api/deploys` (CI calls this after a
  deploy to register a check), `GET /api/deploys` (rollup by SHA), `GET
  /api/deploys/:sha` (per-route detail). The only auth-gated route in
  this package — see the post-deploy section below for why.

## Why Mastra-as-library, not Mastra's own deployer

Mastra ships `@mastra/deployer-cloudflare`, which generates its own
`wrangler.jsonc` and server. We don't use it: this package already has a
hand-authored `wrangler.toml` (D1 binding shared with `target/`, custom
domain routing) and we want one Hono app that serves both the API and,
later, anything else this Worker needs to do. Instead, `@mastra/core` is
used as a library — `mastra.getAgentById(...)` is called from inside our
own Hono route handler. This is a supported, common pattern; it just isn't
the path Mastra's quickstart docs default to.

## Cloudflare bindings inside Mastra

Two different patterns are in play here, and they're not interchangeable:

- **Eager, module-scope construction** (`new Mastra({...})`, `new
  D1Store({...})`, `new Agent({...})`) must take `env` as an explicit
  parameter, sourced from Hono's `c.env` inside the route handler
  (`createMastra(c.env)`). Wrangler's deploy-time validation pass executes
  every module's top level *before* any request — and therefore before
  bindings — exist. `new D1Store({ binding: env.TARGET_DB })` at module
  scope fails that validation with "D1 binding is required," even though
  it works fine once inlined behind a per-request factory. This was
  discovered by an actual failed deploy, not inferred from docs.
- **Lazily-evaluated code** — a tool's `execute` function, for
  instance — only runs during a real request, long after bindings exist.
  That's why the tool files still do `import { env } from
  "cloudflare:workers"` at the top and dereference it inside `execute`:
  by the time that code runs, the binding is real. Don't "fix" this by
  threading `env` through tool factories too; it isn't broken.

If you add something that constructs a class instance at module scope and
that instance touches a binding (not a plain string var/secret), it needs
the factory-function treatment, not the `cloudflare:workers` import.

## Storage

`@mastra/cloudflare-d1`'s `D1Store` binds to the same D1 database as
`target/` (`TARGET_DB`), with `tablePrefix: "mastra_"` so its tables don't
collide with `target/`'s own `spans` table. This is Mastra's internal
thread/message storage, not the investigation traces — those go to
Braintrust, since D1 storage doesn't support persisting the observability
domain.

## Observability

Every agent run must be traced in Braintrust — this isn't optional
instrumentation, it's how "agent design quality" in a review actually gets
inspected after the fact. If you add a tool or a second agent, confirm it
shows up in Braintrust traces before considering the work done.

## The watchdog (`src/watchdog/`)

Runs on the Cron Trigger configured in `wrangler.toml` (every 30 minutes),
via the `scheduled()` export in `src/index.ts` sitting alongside the
Hono `fetch()` export — same file, two different entry points into the
same Worker.

Two-tier by design, and don't collapse the tiers into one:
- `checkRoute.ts` is the cheap tier — pulls metrics and runs changepoint
  detection in plain code, no LLM call. Runs for every monitored route
  on every tick. Also enforces the cooldown (2 hours by default): a
  route that already got a full investigation recently doesn't get
  another one just because the regression is still there.
- `runWatchdogCheck.ts` is the expensive tier — only reached when
  `checkRoute` says `shouldTrigger`. Builds the exact same investigator
  agent used for manual investigations (`createMastra(env)`), runs it to
  completion, and persists the transcript to `watchdog_alerts` (D1) —
  there's no browser attached to a cron invocation to save it to
  localStorage the way manual investigations do.

`MONITORED_ROUTES` (`src/watchdog/routes.ts`) is hardcoded to `target/`'s
two routes. It isn't reading from the web app's Projects list — that
list is still cosmetic (see `web/src/lib/projects.ts`), so there's
nothing real to iterate over yet.

## The post-deploy check (`src/postDeploy/`)

CI calls `POST /api/deploys` right after a deploy; the handler records
the SHA and creates a `PostDeployCheckWorkflow` instance (Cloudflare
Workflows, bound as `POST_DEPLOY_CHECK` in `wrangler.toml`) — the
one-shot, arbitrary-future-timestamp scheduling primitive this needs,
which neither Cron Triggers (fixed interval) nor a Durable Object alarm
(one per DO) provide cleanly. Full reasoning in
`architecture/post-deploy-triggers.md`; this section is package
conventions, not the design rationale.

Reuses as much of the watchdog as it can rather than forking it:
`getRouteMetrics` and `triggerInvestigation` (`src/watchdog/runWatchdogCheck.ts`)
are called as-is. The one thing it does **not** reuse is
`findRegressionWindow` for the actual comparison — that function
searches for an unknown changepoint within one continuous series, which
is the watchdog's problem, not this one's: here the split point (the
deploy boundary) is already known. `compareToBaseline`
(`src/mastra/tools/regression.ts`, alongside `findRegressionWindow`) is
the direct two-group version of the same score formula. Don't reach for
`findRegressionWindow` here even though it's tempting to reuse — see the
architecture doc for why that was tried first and reverted.

`src/postDeploy/resolveBaseline.ts` throws `NonRetryableError` (from
`cloudflare:workflows`), not a plain `Error`, for config problems (unknown
SHA, baseline still live) — a plain `Error` would make Workflows retry a
problem that can't change between retries.

Unlike the watchdog, `POST /api/deploys` is reachable from outside this
Cloudflare account (GitHub Actions calls it), so it's the one route in
this package gated on a shared secret (`DEPLOY_WEBHOOK_SECRET`), checked
with `crypto.subtle.timingSafeEqual` — a workerd extension to Web
Crypto, not `node:crypto` (that module's types aren't available in this
runtime's type declarations, `nodejs_compat` notwithstanding).
