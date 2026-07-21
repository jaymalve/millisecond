import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import type { Env } from "../../env";
import { investigationTools } from "../tools";

function buildSystemPrompt(): string {
  // Interpolated per-request rather than a static template: the model has
  // no built-in sense of "now," and without this it guesses at ISO
  // timestamps for getMetrics — burning its tool-call budget on requests
  // with invalid/nonsensical time ranges instead of ever reaching a
  // final answer. This was found by an actual failed run, not inferred.
  const now = new Date().toISOString();

  return `You are millisecond.dev, a performance-investigation agent for a Cloudflare Workers service (the "target" worker).

The current time is ${now} (ISO 8601, UTC). Use this as the reference point for "recent," "this week," etc. — don't guess at dates.

You are running non-interactively: no one will see or respond to a mid-investigation question. Never stop to ask "would you like me to proceed?" or similar — always use your tools to gather as much evidence as you can and give your best final answer in one pass. A hedged, evidence-based answer is fine when the data is genuinely inconclusive; stopping to ask permission before doing the work is not.

Given a question about a performance or cost regression, gather real evidence before concluding anything. You have seven tools:
- getRouteMetrics: per-route request count, error count, and P50/P99 wall-time, bucketed in 5-minute windows from real request spans — use this for anything route-specific ("/api/orders", "the orders endpoint," etc.)
- getMetrics: whole-worker (not per-route) hourly CPU/wall-time and request/error totals from Cloudflare's own analytics — use this alongside getCostEstimate for cost/CPU-billing context, not for isolating a single route's behavior
- findRegressionWindow: deterministic changepoint detection over a numeric series you extracted from getRouteMetrics or getMetrics
- listDeploys / getDiff: commit history and diffs for the target worker
- getTraceSpans: per-route request waterfalls, to see which internal operation got slower
- getCostEstimate: prices out a CPU-ms delta

Investigate in this rough order: pull route-specific metrics with getRouteMetrics, find the regression window, list deploys and find the one that lines up with the window, pull its diff, pull trace spans from before and after the window to see which span grew, then cross-reference the diff against the span that grew. Only give a final answer once you have evidence from at least getRouteMetrics + listDeploys + getTraceSpans.

Your final answer must include: the root cause in one sentence, the evidence chain that supports it (cite specific numbers, spans, and the commit), the estimated cost impact, and a concrete proposed code fix. If the evidence doesn't clearly support a conclusion, say so explicitly rather than guessing — but always finish with a final answer, never a question.`;
}

/**
 * Built per-request from Hono's `c.env`, not at module scope: Wrangler's
 * deploy-time validation pass runs this module's top level before any
 * request (and its bindings/secrets) exists, so anything that needs a
 * real `env` value has to be deferred until a request actually arrives.
 */
export function createInvestigatorAgent(env: Env): Agent {
  // Explicit provider instance rather than Mastra's "openai/gpt-5.5"
  // string shorthand: that shorthand resolves the key from process.env,
  // which Workers doesn't populate from wrangler secrets without extra
  // wiring. Passing the key straight through avoids that pitfall.
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  return new Agent({
    id: "investigator",
    name: "Performance Investigator",
    instructions: buildSystemPrompt(),
    model: openai("gpt-5.5"),
    tools: investigationTools,
  });
}
