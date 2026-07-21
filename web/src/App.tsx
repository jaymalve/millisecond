import { useEffect, useReducer, useRef, useState } from "react";
import { investigationReducer, initialState, type InvestigationState } from "./state";
import { investigate } from "./api";
import type { WireEvent } from "./wireEvents";
import { loadHistory, saveInvestigation, type InvestigationRecord } from "./lib/history";
import { InvestigateForm } from "./components/InvestigateForm";
import { Transcript } from "./components/Transcript";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { Sidebar } from "./components/Sidebar";

export function App() {
  const [state, dispatch] = useReducer(investigationReducer, initialState);
  // Lazy init reads localStorage once on first render — no useEffect needed
  // for what's otherwise just "load initial state."
  const [history, setHistory] = useState<InvestigationRecord[]>(() => loadHistory());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const isStreaming = state.status === "streaming";
  const selectedRecord = selectedId ? history.find((r) => r.id === selectedId) : undefined;
  const displayItems = selectedRecord ? selectedRecord.items : state.status !== "idle" ? state.items : [];
  const displayError = selectedRecord?.status === "error" ? selectedRecord.errorMessage : state.status === "error" ? state.message : undefined;

  // The transcript is now a fixed-height internal scroll pane (not a
  // growing page), so it needs to be told to follow new content itself —
  // the legitimate "sync with an external system" case for useEffect.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayItems]);

  async function handleSubmit(question: string) {
    setSelectedId(null);
    dispatch({ type: "start" });

    // Mirrors the reducer's own logic to capture the final transcript for
    // persistence — reuses investigationReducer itself (it's pure) rather
    // than duplicating the event-handling switch.
    let local: InvestigationState = { status: "streaming", items: [] };
    const onEvent = (event: WireEvent) => {
      local = investigationReducer(local, { type: "event", event });
      dispatch({ type: "event", event });
    };

    try {
      await investigate(question, onEvent);
    } catch (err) {
      const event: WireEvent = { type: "error", message: (err as Error).message };
      local = investigationReducer(local, { type: "event", event });
      dispatch({ type: "event", event });
    }

    if (local.status === "done" || local.status === "error") {
      const record: InvestigationRecord = {
        id: crypto.randomUUID(),
        question,
        items: local.items,
        status: local.status,
        errorMessage: local.status === "error" ? local.message : undefined,
        createdAt: Date.now(),
      };
      setHistory((prev) => saveInvestigation(record, prev));
    }
  }

  function handleNew() {
    setSelectedId(null);
    dispatch({ type: "reset" });
  }

  return (
    <div className="layout">
      <Sidebar
        history={history}
        selectedId={selectedId}
        disabled={isStreaming}
        onSelect={setSelectedId}
        onNew={handleNew}
      />
      <main className="page">
        <header className="page__header">
          <h1>millisecond.dev</h1>
          <p>Performance investigation agent for a Cloudflare Workers service.</p>
        </header>

        <section className="page__output" ref={outputRef}>
          {displayItems.length > 0 && <Transcript items={displayItems} />}
          {isStreaming && !selectedRecord && <ThinkingIndicator />}
          {displayError && <p className="error">{displayError}</p>}
        </section>

        <div className="page__composer">
          <InvestigateForm disabled={isStreaming} onSubmit={handleSubmit} />
        </div>
      </main>
    </div>
  );
}
