import type { WireEvent } from "./wireEvents";

export type TranscriptItem =
  | { kind: "reasoning"; id: string; text: string }
  | { kind: "answer"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      toolCallId: string;
      toolName: string;
      args: unknown;
      status: "running" | "done" | "error";
      result?: unknown;
    };

/**
 * Merges a raw WireEvent stream into the same compact TranscriptItem[]
 * shape web/src/state.ts's reducer builds client-side — consecutive
 * reasoning/text deltas collapse into one growing string instead of
 * staying as hundreds of separate small objects. Built incrementally
 * (one `add` per event) rather than accumulating the raw stream and
 * reducing it at the end, so a long investigation never holds the full
 * uncompacted event list in memory.
 */
export class TranscriptBuilder {
  private items: TranscriptItem[] = [];
  private reportText = "";

  add(event: WireEvent): void {
    switch (event.type) {
      case "reasoning-delta":
        this.appendToTextBlock("reasoning", event.id, event.text);
        break;
      case "text-delta":
        this.appendToTextBlock("answer", event.id, event.text);
        this.reportText += event.text;
        break;
      case "tool-call":
        this.items.push({
          kind: "tool",
          id: event.toolCallId,
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          status: "running",
        });
        break;
      case "tool-result":
        this.items = this.items.map((item) =>
          item.kind === "tool" && item.toolCallId === event.toolCallId
            ? { ...item, status: event.isError ? "error" : "done", result: event.result }
            : item,
        );
        break;
      default:
        break;
    }
  }

  getItems(): TranscriptItem[] {
    return this.items;
  }

  getReportText(): string {
    return this.reportText;
  }

  private appendToTextBlock(kind: "reasoning" | "answer", id: string, text: string): void {
    const last = this.items[this.items.length - 1];
    if (last?.kind === kind && last.id === id) {
      this.items[this.items.length - 1] = { ...last, text: last.text + text };
      return;
    }
    this.items.push({ kind, id, text });
  }
}
