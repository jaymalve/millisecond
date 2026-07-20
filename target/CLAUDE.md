# target/

The demo service millisecond.dev monitors. Not the submission itself — a
controlled environment that produces real Cloudflare Analytics data, real
D1-backed request spans, and a real, seedable regression to investigate.

## Structure

- `src/index.ts` — Hono app: wiring only (routes, span flush). No business
  logic lives here.
- `src/routes/*.ts` — one file per route. Each exports a single handler.
- `src/spans.ts` — `SpanRecorder`, the tracing stand-in every route uses to
  time its internal operations and batch-write them to D1.
- `migrations/` — D1 schema for the `spans` table.

## Conventions specific to this package

- A route handler's only job is to run its operations (via
  `spans.time(name, fn)`) and return a `Response`. Instrumentation,
  routing, and persistence are handled elsewhere.
- `simulateWork(ms)` in `spans.ts` stands in for real KV/D1/external
  latency so the demo has a meaningful waterfall to inspect — this is the
  one deliberately fake thing in the package, and it's isolated to a
  single function for exactly that reason.
- When seeding a regression for the agent to find: change a route from
  `Promise.all([...])` to sequential `await`s in its own commit, so
  `agent/`'s `get_diff` tool has a clean, single-purpose diff to explain.
