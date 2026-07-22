# Two-worker split

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
