import type { Context } from "hono";
import type { Env } from "../env";
import { createMastra } from "../mastra";
import { toReadableStream } from "../lib/stream";
import { toNdjsonLines } from "../lib/wireEvents";

/**
 * Streams the investigation as NDJSON — one WireEvent per line, covering
 * reasoning deltas, tool calls, tool results, and the final answer's text
 * deltas — so the UI can render an agentic chat transcript as it happens,
 * not just the final answer. See lib/wireEvents.ts for the event shapes.
 */
export async function investigateRoute(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  const message = body.message?.trim();
  if (!message) {
    return c.json({ error: "Missing 'message' in request body." }, 400);
  }

  const mastra = createMastra(c.env);
  const agent = mastra.getAgentById("investigator");
  const stream = await agent.stream(message, {
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

  return new Response(toReadableStream(toNdjsonLines(stream.fullStream)), {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  });
}
