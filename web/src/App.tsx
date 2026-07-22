import { useEffect, useReducer, useRef, useState } from "react";
import { investigationReducer, initialState, type InvestigationState, type TranscriptItem } from "./state";
import { investigate } from "./api";
import type { WireEvent } from "./wireEvents";
import { loadHistory, saveInvestigation, type InvestigationRecord } from "./lib/history";
import { loadProjects, saveProjects, type Project } from "./lib/projects";
import { fetchAlerts, fetchAlert, type AlertSummary, type AlertDetail } from "./lib/alerts";
import { InvestigateForm } from "./components/InvestigateForm";
import { Transcript } from "./components/Transcript";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { Sidebar } from "./components/Sidebar";
import { AddProjectModal } from "./components/AddProjectModal";

export function App() {
  const [state, dispatch] = useReducer(investigationReducer, initialState);
  // Lazy init reads localStorage once on first render — no useEffect needed
  // for what's otherwise just "load initial state."
  const [history, setHistory] = useState<InvestigationRecord[]>(() => loadHistory());
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => projects[0]?.id ?? "target");
  const [showAddProject, setShowAddProject] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertItems, setSelectedAlertItems] = useState<TranscriptItem[] | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const isStreaming = state.status === "streaming";
  const selectedRecord = selectedId ? history.find((r) => r.id === selectedId) : undefined;
  const displayItems = selectedAlertItems ?? (selectedRecord ? selectedRecord.items : state.status !== "idle" ? state.items : []);
  const displayError = selectedRecord?.status === "error" ? selectedRecord.errorMessage : state.status === "error" ? state.message : undefined;

  // Fetching the alert list from the agent's API on mount is a genuine
  // "sync with an external system" case for useEffect — there's no user
  // event that causes it, it's just what's already there server-side.
  useEffect(() => {
    fetchAlerts()
      .then(setAlerts)
      .catch(() => {
        /* Alerts are a nice-to-have surface, not worth blocking the rest of the app over. */
      });
  }, []);

  // The transcript is now a fixed-height internal scroll pane (not a
  // growing page), so it needs to be told to follow new content itself —
  // the legitimate "sync with an external system" case for useEffect.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayItems]);

  async function handleSubmit(question: string) {
    setSelectedId(null);
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
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
        projectId: activeProjectId,
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
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    dispatch({ type: "reset" });
  }

  function handleSelectHistory(id: string) {
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    setSelectedId(id);
  }

  async function handleSelectAlert(id: string) {
    setSelectedId(null);
    setSelectedAlertId(id);
    setSelectedAlertItems(null);
    try {
      const detail: AlertDetail = await fetchAlert(id);
      setSelectedAlertItems(detail.transcript);
    } catch {
      setSelectedAlertItems([]);
    }
  }

  function handleAddProject(project: Project) {
    setProjects((prev) => {
      const next = [...prev, project];
      saveProjects(next);
      return next;
    });
    setActiveProjectId(project.id);
    setShowAddProject(false);
  }

  return (
    <div className="layout">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onAddProjectClick={() => setShowAddProject(true)}
        alerts={alerts}
        selectedAlertId={selectedAlertId}
        onSelectAlert={handleSelectAlert}
        history={history}
        selectedId={selectedId}
        disabled={isStreaming}
        onSelect={handleSelectHistory}
        onNew={handleNew}
      />
      <main className="page">
        <header className="page__header">
          <h1>millisecond.dev</h1>
          <p>Performance investigation agent for a Cloudflare Workers service.</p>
        </header>

        <section className="page__output" ref={outputRef}>
          {displayItems.length > 0 && <Transcript items={displayItems} />}
          {isStreaming && !selectedRecord && !selectedAlertId && <ThinkingIndicator />}
          {displayError && <p className="error">{displayError}</p>}
        </section>

        <div className="page__composer">
          <InvestigateForm disabled={isStreaming} onSubmit={handleSubmit} />
        </div>
      </main>

      {showAddProject && <AddProjectModal onAdd={handleAddProject} onClose={() => setShowAddProject(false)} />}
    </div>
  );
}
