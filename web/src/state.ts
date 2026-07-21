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

export type InvestigationState =
  | { status: "idle" }
  | { status: "streaming"; items: TranscriptItem[] }
  | { status: "done"; items: TranscriptItem[] }
  | { status: "error"; items: TranscriptItem[]; message: string };

export type InvestigationAction = { type: "start" } | { type: "event"; event: WireEvent } | { type: "reset" };

export const initialState: InvestigationState = { status: "idle" };

export function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  if (action.type === "reset") {
    return initialState;
  }
  if (action.type === "start") {
    return { status: "streaming", items: [] };
  }
  if (state.status !== "streaming") return state;

  const { event } = action;
  const items = state.items;

  switch (event.type) {
    case "reasoning-delta":
      return { ...state, items: appendToTextBlock(items, "reasoning", event.id, event.text) };
    case "text-delta":
      return { ...state, items: appendToTextBlock(items, "answer", event.id, event.text) };
    case "tool-call":
      return {
        ...state,
        items: [
          ...items,
          {
            kind: "tool",
            id: event.toolCallId,
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            status: "running",
          },
        ],
      };
    case "tool-result":
      return {
        ...state,
        items: items.map((item) =>
          item.kind === "tool" && item.toolCallId === event.toolCallId
            ? { ...item, status: event.isError ? "error" : "done", result: event.result }
            : item,
        ),
      };
    case "error":
      return { status: "error", items, message: event.message };
    case "finish":
      return { status: "done", items };
    default:
      return state;
  }
}

function appendToTextBlock(
  items: TranscriptItem[],
  kind: "reasoning" | "answer",
  id: string,
  text: string,
): TranscriptItem[] {
  const last = items[items.length - 1];
  if (last?.kind === kind && last.id === id) {
    return [...items.slice(0, -1), { ...last, text: last.text + text }];
  }
  return [...items, { kind, id, text }];
}
