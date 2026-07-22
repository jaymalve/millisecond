# Tool / agent design

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
  retrying `/orders` vs `/api/orders` vs `/api/orders/`. See
  [gotchas.md](gotchas.md).
- `maxSteps: 15` (Mastra default is 5) — seven tools plus a synthesis
  step doesn't fit in five steps; found via an actual run that hit the
  cap and ended with no answer.
