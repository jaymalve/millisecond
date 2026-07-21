/**
 * Mirrors agent/src/lib/wireEvents.ts's WireEvent type. No shared package
 * exists between agent/ and web/ yet, so this is kept in sync by hand —
 * see that file's comment for the same note from the other side.
 */
export type WireEvent =
  | { type: "tool-call"; toolCallId: string; toolName: string; args: unknown }
  | { type: "tool-result"; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: "reasoning-delta"; id: string; text: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "error"; message: string }
  | { type: "finish" };
