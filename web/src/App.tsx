import { useEffect, useReducer, useRef, useState } from "react";
import { investigationReducer, initialState, type InvestigationState, type TranscriptItem } from "./state";
import { investigate } from "./api";
import type { WireEvent } from "./wireEvents";
import { fetchConversations, fetchConversation, type ConversationSummary } from "./lib/conversations";
import { loadProjects, saveProjects, type Project } from "./lib/projects";
import { fetchAlerts, fetchAlert, type AlertSummary, type AlertDetail } from "./lib/alerts";
import { fetchDeploys, fetchDeploy, type DeploySummary, type DeployDetail } from "./lib/deploys";
import { InvestigateForm } from "./components/InvestigateForm";
import { Transcript } from "./components/Transcript";
import { ThinkingIndicator } from "./components/ThinkingIndicator";
import { Sidebar } from "./components/Sidebar";
import { AddProjectModal } from "./components/AddProjectModal";
import { DeployChecks } from "./components/DeployChecks";
import { DeployChecksSkeleton } from "./components/DeployChecksSkeleton";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import {
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScroller as MessageScrollerRoot,
  MessageScrollerViewport,
} from "./components/ui/message-scroller";
import { Alert, AlertDescription } from "./components/ui/alert";

export function App() {
  const [state, dispatch] = useReducer(investigationReducer, initialState);
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState(() => projects[0]?.id ?? "target");
  const [showAddProject, setShowAddProject] = useState(false);
  // The active conversation thread — sent to the agent as its Mastra
  // memory thread on every turn, so a null id means "no chat started
  // yet," not "history entry not selected."
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Items from turns before whichever one `state` currently represents —
  // folded in once a turn completes so a resumed or multi-turn
  // conversation renders as one continuous transcript.
  const [conversationItems, setConversationItems] = useState<TranscriptItem[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertSummary[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertItems, setSelectedAlertItems] = useState<TranscriptItem[] | null>(null);
  const [deploys, setDeploys] = useState<DeploySummary[]>([]);
  const [deploysLoading, setDeploysLoading] = useState(true);
  const [selectedDeploySha, setSelectedDeploySha] = useState<string | null>(null);
  const [selectedDeployDetail, setSelectedDeployDetail] = useState<DeployDetail | null>(null);
  const [selectedDeployError, setSelectedDeployError] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const isStreaming = state.status === "streaming";
  const displayItems = selectedAlertItems ?? [...conversationItems, ...(state.status !== "idle" ? state.items : [])];
  const displayError = selectedAlertId ? undefined : state.status === "error" ? state.message : submitError;
  const isLive = isStreaming && !selectedAlertId;
  const activeItemId = isLive ? displayItems[displayItems.length - 1]?.id : undefined;

  // Fetching lists from the agent's API on mount is a genuine "sync with
  // an external system" case for useEffect — there's no user event that
  // causes it, it's just what's already there server-side.
  useEffect(() => {
    fetchConversations()
      .then(setConversations)
      .catch(() => {
        /* Sidebar history is a nice-to-have, not worth blocking the rest of the app over. */
      });
    fetchAlerts()
      .then(setAlerts)
      .catch(() => {
        /* Alerts are a nice-to-have surface, not worth blocking the rest of the app over. */
      });
    fetchDeploys()
      .then(setDeploys)
      .catch(() => {
        /* Same as alerts above — not worth blocking the rest of the app over. */
      })
      .finally(() => setDeploysLoading(false));
  }, []);

  async function handleSubmit(question: string) {
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    setSelectedDeploySha(null);
    setSelectedDeployDetail(null);
    setSelectedDeployError(null);
    setSubmitError(null);

    // Minted once, on the first turn of a chat, then resent on every
    // later turn — this is what makes the agent treat a follow-up
    // question as a continuation instead of a fresh conversation.
    const activeConversationId = conversationId ?? crypto.randomUUID();
    if (!conversationId) setConversationId(activeConversationId);

    dispatch({ type: "start", question });

    // Mirrors the reducer's own logic to capture the finished turn for
    // folding into conversationItems — reuses investigationReducer itself
    // (it's pure) rather than duplicating its event-handling logic.
    let local: InvestigationState = {
      status: "streaming",
      items: [{ kind: "question", id: crypto.randomUUID(), text: question }],
    };
    const onEvent = (event: WireEvent) => {
      local = investigationReducer(local, { type: "event", event });
      dispatch({ type: "event", event });
    };

    try {
      await investigate(question, activeConversationId, activeProjectId, onEvent);
    } catch (err) {
      const event: WireEvent = { type: "error", message: (err as Error).message };
      local = investigationReducer(local, { type: "event", event });
      dispatch({ type: "event", event });
    }

    if (local.status === "done" || local.status === "error") {
      const finishedItems = local.items;
      setConversationItems((prev) => [...prev, ...finishedItems]);
      if (local.status === "error") setSubmitError(local.message);
      dispatch({ type: "reset" });
      fetchConversations()
        .then(setConversations)
        .catch(() => {
          /* Sidebar history is a nice-to-have, not worth blocking the rest of the app over. */
        });
    }
  }

  function handleNew() {
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    setSelectedDeploySha(null);
    setSelectedDeployDetail(null);
    setSelectedDeployError(null);
    setConversationId(null);
    setConversationItems([]);
    setSubmitError(null);
    dispatch({ type: "reset" });
  }

  async function handleSelectConversation(id: string) {
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    setSelectedDeploySha(null);
    setSelectedDeployDetail(null);
    setSelectedDeployError(null);
    setSubmitError(null);
    dispatch({ type: "reset" });
    setConversationId(id);
    try {
      const detail = await fetchConversation(id);
      setConversationItems(detail.items);
    } catch {
      setConversationItems([]);
    }
  }

  async function handleSelectAlert(id: string) {
    setConversationId(null);
    setSelectedAlertId(id);
    setSelectedAlertItems(null);
    setSelectedDeploySha(null);
    setSelectedDeployDetail(null);
    setSelectedDeployError(null);
    try {
      const detail: AlertDetail = await fetchAlert(id);
      setSelectedAlertItems(detail.transcript);
    } catch {
      setSelectedAlertItems([]);
    }
  }

  async function handleSelectDeploy(sha: string) {
    setConversationId(null);
    setSelectedAlertId(null);
    setSelectedAlertItems(null);
    setSelectedDeploySha(sha);
    setSelectedDeployDetail(null);
    setSelectedDeployError(null);
    const el = outputRef.current;
    if (el) el.scrollTo({ top: 0 });
    try {
      setSelectedDeployDetail(await fetchDeploy(sha));
    } catch (err) {
      setSelectedDeployError((err as Error).message);
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
    <SidebarProvider className="layout">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onAddProjectClick={() => setShowAddProject(true)}
        alerts={alerts}
        selectedAlertId={selectedAlertId}
        onSelectAlert={handleSelectAlert}
        deploys={deploys}
        deploysLoading={deploysLoading}
        selectedDeploySha={selectedDeploySha}
        onSelectDeploy={handleSelectDeploy}
        conversations={conversations}
        selectedId={conversationId}
        disabled={isStreaming}
        onSelect={handleSelectConversation}
        onNew={handleNew}
      />
      <main className="page">
        <header className="page__header">
          <div className="page__header-row">
            <SidebarTrigger />
            <h1>millisecond.dev</h1>
          </div>
          <p>Performance investigation agent for a Cloudflare Workers service.</p>
        </header>

        {selectedDeploySha ? (
          <section className="page__output" ref={outputRef}>
            <div className="mx-auto w-full max-w-[760px] px-8 py-6">
            {selectedDeployError ? (
              <Alert variant="destructive">
                <AlertDescription>{selectedDeployError}</AlertDescription>
              </Alert>
            ) : selectedDeployDetail ? (
              <DeployChecks deploy={selectedDeployDetail} onViewAlert={handleSelectAlert} />
            ) : (
              <DeployChecksSkeleton />
            )}
            </div>
          </section>
        ) : (
          <div className="page__transcript">
            <MessageScrollerProvider autoScroll>
              <MessageScrollerRoot>
                <MessageScrollerViewport>
                  <MessageScrollerContent className="mx-auto w-full max-w-[760px] px-8 py-6">
                    {displayItems.length > 0 && <Transcript items={displayItems} activeItemId={activeItemId} />}
                    {isLive && (
                      <MessageScrollerItem messageId="thinking-indicator">
                        <ThinkingIndicator />
                      </MessageScrollerItem>
                    )}
                    {displayError && (
                      <MessageScrollerItem messageId="error">
                        <Alert variant="destructive">
                          <AlertDescription>{displayError}</AlertDescription>
                        </Alert>
                      </MessageScrollerItem>
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScrollerRoot>
            </MessageScrollerProvider>
          </div>
        )}

        <div className="page__composer">
          <InvestigateForm disabled={isStreaming} onSubmit={handleSubmit} />
        </div>
      </main>

      {showAddProject && <AddProjectModal onAdd={handleAddProject} onClose={() => setShowAddProject(false)} />}
    </SidebarProvider>
  );
}
