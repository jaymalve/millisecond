import { Agent } from "@mastra/core/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { Memory } from "@mastra/memory";
import type { D1Store } from "@mastra/cloudflare-d1";
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
 *
 * `storage` is the same D1Store instance the Mastra instance itself uses
 * (see mastra/index.ts) — passed in rather than constructed here so
 * there's exactly one D1Store per request, not two independently
 * managing the same `mastra_*` tables.
 */
export function createInvestigatorAgent(env: Env, storage: D1Store): Agent {
  // Explicit provider instance rather than Mastra's "openai/gpt-5.5"
  // string shorthand: that shorthand resolves the key from process.env,
  // which Workers doesn't populate from wrangler secrets without extra
  // wiring. Passing the key straight through avoids that pitfall.
  const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });

  // Recency-window recall only — no vector store configured, so semantic
  // recall is explicitly off rather than silently inert. threadId/resourceId
  // are supplied per-call from investigate.ts (one thread per browser
  // conversation), not fixed here.
  //
  // The `as unknown as` casts below aren't papering over a real mismatch:
  // @mastra/memory depends on zod v4 directly while the rest of this
  // package is on zod v3, so bun's isolated installer resolves two
  // physical copies of @mastra/core (one per zod major). Memory and
  // Agent are structurally identical either way — they only call each
  // other's public storage/memory methods, never touch private fields
  // across that boundary — but TypeScript treats the two copies'
  // classes as nominally distinct. Confirmed via `bun pm ls`/lockfile
  // inspection, not a guess.
  const memory = new Memory({
    storage: storage as unknown as NonNullable<ConstructorParameters<typeof Memory>[0]>["storage"],
    options: { lastMessages: 20, semanticRecall: false },
  });

  return new Agent({
    id: "investigator",
    name: "Performance Investigator",
    instructions: buildSystemPrompt(),
    model: openai("gpt-5.5"),
    tools: investigationTools,
    memory: memory as unknown as ConstructorParameters<typeof Agent>[0]["memory"],
  });
}
