import { useReducer } from "react";
import { investigationReducer, initialState } from "./state";
import { investigate } from "./api";
import { InvestigateForm } from "./components/InvestigateForm";
import { Transcript } from "./components/Transcript";
import { ThinkingIndicator } from "./components/ThinkingIndicator";

export function App() {
  const [state, dispatch] = useReducer(investigationReducer, initialState);

  async function handleSubmit(message: string) {
    dispatch({ type: "start" });
    try {
      await investigate(message, (event) => dispatch({ type: "event", event }));
    } catch (err) {
      dispatch({ type: "event", event: { type: "error", message: (err as Error).message } });
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
        {state.status !== "idle" && state.items.length === 0 && <ThinkingIndicator />}
        {state.status !== "idle" && <Transcript items={state.items} />}
        {state.status === "error" && <p className="error">{state.message}</p>}
      </section>
    </main>
  );
}
