# millisecond.dev

An AI agent that investigates performance regressions in a Cloudflare Workers
service: it detects a latency/CPU shift, bisects it to the deploy that caused
it, explains the mechanism by diffing request waterfalls before/after, and
prices out the cost impact.

Built as an AI agent take-home exercise: build an AI agent on Cloudflare
Workers for understanding, monitoring, or investigating software
infrastructure.

See [`CLAUDE.md`](CLAUDE.md) for the engineering principles this repo follows.

## Status

Scaffolding in progress. See `target/`, `agent/`, and `web/` for the three
packages that make up this project.

## Architecture

Three Cloudflare Workers:

- **`target/`** — a small instrumented demo service (the thing being
  monitored). A Hono app with a couple of HTTP routes doing real subrequest
  work (KV/D1/simulated external calls), some parallelized, some not. Every
  request writes timing spans to a D1 table, which stands in for a
  distributed tracing backend.
- **`agent/`** — the actual submission. A Mastra agent (`@mastra/core`),
  exposed over Hono at `POST /api/investigate`, with seven tools:
  1. `getRouteMetrics` — per-route request count and P50/P99 wall-time,
     bucketed in 5-minute windows, computed from the target's own D1 spans
  2. `getMetrics` — Cloudflare GraphQL Analytics API (whole-worker,
     hourly-only CPU/wall-time and request/error totals — used for cost
     context, not route-specific investigation)
  3. `findRegressionWindow` — deterministic changepoint detection over a
     series from `getRouteMetrics`/`getMetrics` (code, not LLM judgment)
  4. `listDeploys` — commit history for `target/` via the GitHub API
  5. `getDiff` — diff for a candidate commit
  6. `getTraceSpans` — waterfall spans for a route/time-window from the
     target's D1 table
  7. `getCostEstimate` — CPU-ms/request delta priced against Workers pricing

  The agent gathers evidence across these tools, cross-references the diff
  against the waterfall change, and streams back a root cause with
  supporting evidence plus a proposed fix (not auto-applied — see "Future
  improvements"). Every run is traced in Braintrust via
  `@mastra/braintrust`'s exporter.
- **`web/`** — the UI, deployed at millisecond.dev. A small React app (Vite)
  that posts to `agent/`'s `/api/investigate` and streams the response in.

## Design decisions & tradeoffs

- **Self-reported D1 spans instead of a paid tracing product.** Cloudflare's
  own distributed tracing is a paid feature; `target/` writes its own
  lightweight spans to D1 instead. Cheap to stand up, real enough to give
  the agent an actual waterfall to reason about.
- **Bisecting via GitHub commit history on the `target/` path, not
  Cloudflare's deployment API.** Deployment metadata alone has no diff to
  reason about; commit history does, and in this repo commits on that path
  line up with deploys 1:1.
- **Mastra as a library, not its own CLI deployer.** See
  [`agent/CLAUDE.md`](agent/CLAUDE.md) — keeps one hand-authored
  `wrangler.toml` and one Hono app instead of two competing deployment
  pipelines.
- **The agent runs stateless, single-shot, per HTTP request** rather than in
  a Durable Object. There's no multi-turn conversation to persist yet; if
  an investigation history view gets added, Mastra's D1-backed storage is
  already wired up for it (see `agent/CLAUDE.md`).

## Future improvements

- Cron-triggered autonomous mode: run the detection loop on a schedule and
  auto-open an investigation when a regression is found, instead of only
  on-demand.
- Stream intermediate tool-call/tool-result events to the UI too, not just
  the final answer — currently only Braintrust sees the full trace live.
- Close the loop on the proposed fix: deploy it to a preview environment,
  re-run load, and report a measured before/after instead of a suggestion.

## Local development

Uses [bun](https://bun.sh) as the package manager and workspace runner.

```bash
bun install
bun run dev:target   # http://localhost:8787
bun run dev:agent    # http://localhost:8788
bun run dev:web      # http://localhost:5173
```

## Deployment

```bash
bun run deploy:target
bun run deploy:agent
bun run deploy:web
```

Requires (see each package's `.dev.vars.example` / `.env.example`):
- Cloudflare account with `wrangler login` (or `CF_API_TOKEN` / `CF_ACCOUNT_ID`)
- `OPENAI_API_KEY`
- `BRAINTRUST_API_KEY`
- Optionally `GITHUB_TOKEN` (only needed to raise GitHub API rate limits on a
  public repo)
