# Gotchas

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
not eliminated, by the system-prompt economy rules (see
[tool-agent-design.md](tool-agent-design.md)) — this remains a hard
ceiling on investigation depth on the Free plan.

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
