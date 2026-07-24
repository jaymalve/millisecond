import type { ChunkType } from "@mastra/core/stream";

/**
 * The event shape sent to the browser over NDJSON (one JSON object per
 * line). Deliberately narrower than Mastra's own `ChunkType` — the
 * frontend shouldn't need to know Mastra's internal event vocabulary.
 * Keep `web/src/api.ts`'s copy of this type in sync by hand; this repo
 * doesn't have a shared package between agent/ and web/ yet.
 */
export type WireEvent =
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "reasoning-delta"; id: string; text: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "error"; message: string }
  | { type: "finish" };

/** Maps Mastra's fullStream chunks to our narrower wire protocol, dropping chunk types the UI doesn't render. */
export function toWireEvent(chunk: ChunkType): WireEvent | null {
  switch (chunk.type) {
    case "tool-call":
      return { type: "tool-call", toolCallId: chunk.payload.toolCallId, toolName: chunk.payload.toolName, args: chunk.payload.args };
    case "tool-result":
      return {
        type: "tool-result",
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        result: chunk.payload.result,
        isError: chunk.payload.isError,
      };
    // A thrown tool execute() surfaces as its own chunk type, not
    // "tool-result" with isError — without this case the failure was
    // silently dropped by the switch's default, invisible to the model's
    // caller even though the model itself still saw and reasoned about it.
    case "tool-error":
      return {
        type: "tool-result",
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        result: chunk.payload.error instanceof Error ? chunk.payload.error.message : String(chunk.payload.error),
        isError: true,
      };
    case "reasoning-delta":
      return { type: "reasoning-delta", id: chunk.payload.id, text: chunk.payload.text };
    case "text-delta":
      return { type: "text-delta", id: chunk.payload.id, text: chunk.payload.text };
    case "error":
      return { type: "error", message: String(chunk.payload.error ?? "Unknown error") };
    case "finish":
      return { type: "finish" };
    default:
      return null;
  }
}

/** Consumes Mastra's fullStream and yields NDJSON lines for an HTTP response body. */
export async function* toNdjsonLines(fullStream: AsyncIterable<ChunkType>): AsyncGenerator<string> {
  for await (const chunk of fullStream) {
    const event = toWireEvent(chunk);
    if (event) yield JSON.stringify(event) + "\n";
  }
}
