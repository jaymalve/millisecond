# agent/

The submission: a Mastra agent, deployed as a Cloudflare Worker, that
investigates performance regressions in `target/`.

## Structure

- `src/index.ts` — Hono app: CORS + route mounting only.
- `src/routes/investigate.ts` — the one HTTP route. Reads the request,
  calls the agent, streams the response back.
- `src/mastra/index.ts` — the `Mastra` instance: agent registry +
  Braintrust observability config. This is the only file that constructs
  `new Mastra({...})`.
- `src/mastra/agents/investigator.ts` — the agent definition: instructions,
  model, tool registry.
- `src/mastra/tools/*.ts` — one file per tool, each a `createTool` call
  with a Zod input/output schema. Tool logic (the actual fetch/query/calc)
  lives in the same file as its schema — there's exactly one thing calling
  it, so splitting them apart would be indirection, not clarity.

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

Workers only populate `env` per-request, but `new Mastra({...})` in this
codebase is constructed once at module scope. The fix — and the reason
every tool file does `import { env } from "cloudflare:workers"` instead of
taking an `Env` parameter — is that this import is populated correctly by
the Workers runtime even when read at module scope, which is what Mastra's
own Cloudflare deployment guide relies on too. Don't reintroduce a
threaded `Env` parameter; it fights this pattern for no benefit.

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
