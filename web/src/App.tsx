import { useReducer } from "react";
import { investigationReducer, initialState } from "./state";
import { investigate } from "./api";
import { InvestigateForm } from "./components/InvestigateForm";
import { ReportSkeleton } from "./components/ReportSkeleton";
import { ReportView } from "./components/ReportView";

export function App() {
  const [state, dispatch] = useReducer(investigationReducer, initialState);

  async function handleSubmit(message: string) {
    dispatch({ type: "start" });
    try {
      await investigate(message, (text) => dispatch({ type: "chunk", text }));
      dispatch({ type: "done" });
    } catch (err) {
      dispatch({ type: "error", message: (err as Error).message });
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>millisecond.dev</h1>
        <p>Performance investigation agent for a Cloudflare Workers service.</p>
      </header>

      <InvestigateForm disabled={state.status === "streaming"} onSubmit={handleSubmit} />

      <section className="page__output">
        {state.status === "streaming" && state.answer === "" && <ReportSkeleton />}
        {state.status === "streaming" && state.answer !== "" && <ReportView answer={state.answer} />}
        {state.status === "done" && <ReportView answer={state.answer} />}
        {state.status === "error" && <p className="error">{state.message}</p>}
      </section>
    </main>
  );
}
