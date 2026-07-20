# millisecond.dev — engineering principles

This is a monorepo with three packages, each with its own `CLAUDE.md` for
package-specific detail:

- [`target/`](target/CLAUDE.md) — the instrumented demo service being monitored
- [`agent/`](agent/CLAUDE.md) — the Mastra-based investigation agent (API, deployed as a Cloudflare Worker)
- [`web/`](web/CLAUDE.md) — the React UI, talks to `agent/` over HTTP

Package manager: **bun** (`bun install`, `bun run --filter <pkg> <script>`).
Every package deploys to Cloudflare Workers.

## Strict principles — apply to every package in this repo

1. **Write as a senior engineer would.** Favor the boring, obviously-correct
   solution. Don't reach for cleverness where a straight line will do.
2. **One responsibility per file.** A file that fetches data, transforms it,
   and renders it is three files. If you can't name a file's job in one
   short phrase, split it.
3. **No spec or unit tests for this project.** Correctness comes from
   reading the code and exercising it end-to-end (dev server, real
   requests), not from a test suite.
4. **UI follows Linear/Vercel-style aesthetics.** Dark neutral surfaces,
   thin 1px borders instead of shadows, small border-radius, restrained
   accent color, system/monospace font stacks, tight and consistent
   spacing scale. No default browser-chrome look.
5. **Skeleton loaders, not spinners.** Any UI waiting on network/stream
   data shows a skeleton in the shape of the eventual content.
6. **Everything is properly typed. No `any`.** If a type is genuinely
   unknown at a boundary (e.g. a third-party JSON response), narrow it
   with a parse/validation step rather than casting.
7. **Comments are short and explain *why*, never *what*.** Well-named code
   already says what it does. A comment earns its place only when there's
   a non-obvious reason behind a decision.
8. **DRY and KISS.** Don't abstract until a second real use case shows up.
   Don't build for hypothetical future requirements.
9. **Everything follows a proper framework**, not hand-rolled plumbing:
   Hono for HTTP in the Workers, Mastra for the agent runtime, Vite+React
   for the UI. Reach for a library's intended pattern before writing a
   custom one.
10. **Mastra is the agent runtime.** Agents, tools, and orchestration go
    through `@mastra/core` (`Agent`, `createTool`), not hand-rolled
    tool-calling loops.
11. **Every agent run is observable end-to-end via Braintrust.**
    `@mastra/braintrust`'s `BraintrustExporter` is wired into every Mastra
    instance that runs an agent. If you add a new agent or tool, it must
    show up in traces — don't build a path around the exporter.
12. **No `useEffect` bombardment in React.** State changes happen in event
    handlers (form submit, click, stream chunk callback), not in effects
    chasing other state. Reach for `useEffect` only for a genuine
    synchronization-with-an-external-system case, and prefer a single
    reducer over cascades of `useState`.
13. **Stream, don't batch.** Agent responses go through Mastra's
    `agent.stream()` (which wraps AI SDK's `streamText`) end-to-end: HTTP
    response streams to the client, and the UI renders incrementally,
    whenever the agent is producing a final answer.

## Repo-wide conventions

- TypeScript `strict: true`, `noEmit: true`, `isolatedModules: true` in
  every package — matches how Wrangler/Vite bundle each file independently.
- Cloudflare bindings (D1, KV, secrets) are accessed via
  `import { env } from "cloudflare:workers"`, not threaded through
  function parameters — see `agent/CLAUDE.md` for why this matters under
  Mastra specifically.
- Deployment target for `target/` and `agent/` is Cloudflare Workers via
  hand-authored `wrangler.toml` (not Mastra's own `CloudflareDeployer` —
  see `agent/CLAUDE.md` for that tradeoff).
