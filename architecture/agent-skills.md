# Agent skills (progressive disclosure)

Until now, `agent/`'s entire behavior — tool descriptions aside — lived in
one system prompt string (`buildSystemPrompt` in
[`investigator.ts`](../agent/src/mastra/agents/investigator.ts)): identity,
the non-interactive rule, tool-call economy, a fixed investigation order
across all seven tools, and a fixed final-answer template. That worked
while there was exactly one kind of question this agent answered
("why did this route regress"). It stops working once a second, genuinely
different domain shows up (general Cloudflare ops — cache behavior,
traffic trends — see `cloudflare-ops` below): the fixed investigation
order and final-answer template for regressions don't fit a question that
has no known route or deploy to anchor on, and bolting a second `if this
kind of question, do X instead` branch into one growing prompt string is
exactly the kind of thing that degrades a model's adherence to any of it.

## The pattern

`src/mastra/skills/` holds one template-string export per domain
(`routeRegression.ts`, `cloudflareOps.ts`), registered by name with a
one-line `description` in `src/mastra/skills/index.ts`. The base prompt
no longer contains investigation-order or final-answer guidance at all —
it only carries what's true regardless of domain (identity, current time,
the non-interactive rule, tool-call economy). A `loadSkill` tool
(`src/mastra/tools/skills.ts`) exposes the skill registry to the model:
its own `description` *is* the skill menu (name + one-liner per skill),
so the menu costs nothing extra in the base prompt, and the full playbook
for a domain only enters context once the agent has picked it.

This is the same progressive-disclosure idea behind Claude Code's own
Skill system, reimplemented by hand because Mastra / the OpenAI Responses
API have no equivalent primitive — it's just a tool call returning a
string, not a special runtime feature.

## Why not just grow the one prompt

- **Selective loading.** A `cloudflare-ops` question never needs the
  regression investigation order; a `route-regression` question never
  needs the KV-analytics caveats. Cramming both into every request wastes
  context and, more importantly, gives the model two conflicting
  procedures to reconcile on every single call.
- **Scoped budget pressure.** Tool-call economy (Cloudflare's free-plan
  subrequest cap, see the base prompt) is the one thing that has to hold
  regardless of domain, so it stays in the base prompt. Everything
  domain-specific — including how strict the evidence bar is — moved out.
- **Growth path.** Adding a third domain means one new file plus one
  registry line, not a new paragraph threaded into an already-dense
  prompt with existing paragraphs re-read for conflicts.

## What did *not* change

- The `route-regression` skill's content is the prior system prompt's
  investigation section, moved verbatim — this was a structural refactor,
  not a rewrite of working behavior.
- `loadSkill` counts against the same "call each (tool, arguments)
  combination once" rule as every other tool — it's listed explicitly in
  the base prompt so the model doesn't treat it as free.
- `maxSteps: 15` ([`investigate.ts`](../agent/src/routes/investigate.ts),
  [`runWatchdogCheck.ts`](../agent/src/watchdog/runWatchdogCheck.ts)) is
  unchanged. One extra `loadSkill` call still fits comfortably under a
  budget sized for seven tools plus a synthesis step.

## See also

[tool-agent-design.md](tool-agent-design.md) for the full tool registry,
including `getKvOperations` (added alongside the `cloudflare-ops` skill
it backs).
