import type { Context } from "hono";
import type { Env } from "../env";
import { createMastra } from "../mastra";
import { toReadableStream } from "../lib/stream";

/**
 * Streams the investigator agent's final answer back as plain text.
 * Intermediate tool-call/tool-result events aren't streamed to the
 * client here — they're captured in Braintrust traces instead (see
 * agent/CLAUDE.md). Streaming those live to the UI too is a reasonable
 * follow-up once Mastra's structured stream-part shape is confirmed.
 */
export async function investigateRoute(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ message?: string }>().catch(() => ({}) as { message?: string });
  const message = body.message?.trim();
  if (!message) {
    return c.json({ error: "Missing 'message' in request body." }, 400);
  }

  const mastra = createMastra(c.env);
  const agent = mastra.getAgentById("investigator");
  const stream = await agent.stream(message);

  return new Response(toReadableStream(stream.textStream), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
