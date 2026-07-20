export type InvestigationState =
  | { status: "idle" }
  | { status: "streaming"; answer: string }
  | { status: "done"; answer: string }
  | { status: "error"; message: string };

export type InvestigationAction =
  | { type: "start" }
  | { type: "chunk"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

export const initialState: InvestigationState = { status: "idle" };

export function investigationReducer(
  state: InvestigationState,
  action: InvestigationAction,
): InvestigationState {
  switch (action.type) {
    case "start":
      return { status: "streaming", answer: "" };
    case "chunk":
      return state.status === "streaming"
        ? { status: "streaming", answer: state.answer + action.text }
        : state;
    case "done":
      return state.status === "streaming" ? { status: "done", answer: state.answer } : state;
    case "error":
      return { status: "error", message: action.message };
  }
}
