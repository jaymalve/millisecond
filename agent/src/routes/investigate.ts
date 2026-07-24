import type { Context } from "hono";
import type { Env } from "../env";
import { createMastra } from "../mastra";
import { toReadableStream } from "../lib/stream";
import { toWireEvent } from "../lib/wireEvents";
import { TranscriptBuilder } from "../lib/transcript";
import { persistConversationTurn } from "../lib/conversations";

/**
 * Streams the investigation as NDJSON — one WireEvent per line, covering
 * reasoning deltas, tool calls, tool results, and the final answer's text
 * deltas — so the UI can render an agentic chat transcript as it happens,
 * not just the final answer. See lib/wireEvents.ts for the event shapes.
 *
 * `conversationId` is Mastra's memory thread — the browser mints one per
 * chat and resends it on every turn, which is what lets the agent recall
 * prior turns instead of starting fresh on every message. The turn is
 * also persisted to D1 (via waitUntil, after the stream finishes) so the
 * sidebar's conversation list survives a page reload.
 */
export async function investigateRoute(c: Context<{ Bindings: Env }>) {
  const body = await c.req
    .json<{ message?: string; conversationId?: string; projectId?: string }>()
    .catch(() => ({}) as { message?: string; conversationId?: string; projectId?: string });
  const message = body.message?.trim();
  const conversationId = body.conversationId?.trim();
  if (!message) {
    return c.json({ error: "Missing 'message' in request body." }, 400);
  }
  if (!conversationId) {
    return c.json({ error: "Missing 'conversationId' in request body." }, 400);
  }
  const projectId = body.projectId?.trim() || "target";

  const mastra = createMastra(c.env);
  const agent = mastra.getAgentById("investigator");
  const stream = await agent.stream(message, {
    // No auth in this app yet, so every conversation shares one resource
    // bucket — isolation between chats comes entirely from conversationId
    // as the thread.
    memory: { thread: conversationId, resource: "web" },
    // Mastra's default maxSteps is 5 — too few for this agent's
    // seven-tool investigation chain plus a final synthesis step.
    // Without raising it, the run hits the cap right after the last
    // tool-result and ends via `finish` with no text ever generated.
    // Found via an actual empty run, not inferred from docs.
    maxSteps: 15,
    // Reasoning models don't stream their reasoning by default — the
    // Responses API (which `openai("gpt-5.5")` uses) only emits
    // `reasoning-delta` chunks when a summary is explicitly requested.
    // Without this, gpt-5.5's reasoning is real but invisible, both in
    // the UI and in Braintrust traces.
    providerOptions: { openai: { reasoningSummary: "auto" } },
  });

  const builder = new TranscriptBuilder();

  async function* lines() {
    try {
      for await (const chunk of stream.fullStream) {
        const event = toWireEvent(chunk);
        if (!event) continue;
        builder.add(event);
        yield JSON.stringify(event) + "\n";
      }
    } finally {
      // Runs even if the browser aborts mid-stream, so a partial turn
      // still shows up in history rather than vanishing silently.
      c.executionCtx.waitUntil(
        persistConversationTurn(c.env, {
          conversationId: conversationId!,
          projectId,
          question: message!,
          items: builder.getItems(),
        }),
      );
    }
  }

  return new Response(toReadableStream(lines()), {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
