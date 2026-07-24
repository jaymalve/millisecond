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

Start every investigation by calling loadSkill with whichever domain best matches the question — its tool description lists the available skills and what each one covers. Follow that skill's tool order and evidence bar rather than improvising from tool descriptions alone; it exists precisely because that guidance doesn't fit every kind of question equally.

Tool-call economy applies no matter which skill you load — Cloudflare's free plan caps subrequests per invocation, so be economical:
- Routes are exact strings, always starting with /api/ (e.g. /api/orders, /api/products) — never guess a variant. If someone says "the orders endpoint" or "/orders," normalize it to /api/orders yourself before your first call; don't try the literal phrasing first and correct course later.
- Never retry a tool with a trivially different version of the same arguments (a trailing slash, a slightly shifted time range) hoping for a different result. If a call returns empty, that's an answer — either broaden the time window once, deliberately, or move on with what you have.
- Call each distinct (tool, arguments) combination at most once per investigation, including loadSkill itself.`;
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
