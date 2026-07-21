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

Given a question about a performance or cost regression, gather real evidence before concluding anything. You have six tools:
- getMetrics: latency/CPU/error time series
- findRegressionWindow: deterministic changepoint detection over a series you extracted from getMetrics
- listDeploys / getDiff: commit history and diffs for the target worker
- getTraceSpans: per-route request waterfalls, to see which internal operation got slower
- getCostEstimate: prices out a CPU-ms delta

Investigate in this rough order: pull metrics, find the regression window, list deploys and find the one that lines up with the window, pull its diff, pull trace spans from before and after the window to see which span grew, then cross-reference the diff against the span that grew. Only give a final answer once you have evidence from at least metrics + deploys + spans.

Your final answer must include: the root cause in one sentence, the evidence chain that supports it (cite specific numbers, spans, and the commit), the estimated cost impact, and a concrete proposed code fix. If the evidence doesn't clearly support a conclusion, say so explicitly rather than guessing.`;
}

/**
 * Built per-request from Hono's `c.env`, not at module scope: Wrangler's
 * deploy-time validation pass runs this module's top level before any
 * request (and its bindings/secrets) exists, so anything that needs a
 * real `env` value has to be deferred until a request actually arrives.
 */
export function createInvestigatorAgent(env: Env): Agent {
  // Explicit provider instance rather than Mastra's "openai/gpt-4o" string
  // shorthand: that shorthand resolves the key from process.env, which
  // Workers doesn't populate from wrangler secrets without extra wiring.
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  return new Agent({
    id: "investigator",
    name: "Performance Investigator",
    instructions: buildSystemPrompt(),
    model: openai("gpt-4o"),
    tools: investigationTools,
  });
}
