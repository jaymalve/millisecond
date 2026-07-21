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
  the agent definition (instructions, model, tool registry), also built
  from an explicit `Env` rather than a module-scope singleton.
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
