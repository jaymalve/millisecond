import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { Landing } from "./pages/Landing";
import { TooltipProvider } from "./components/ui/tooltip";
import "./styles.css";

// No router dependency for two pages that share nothing (a marketing
// manifesto vs. the chat app) — a plain path check at load time, read
// once here rather than threaded through as router state. wrangler.toml's
// `not_found_handling = "single-page-application"` already makes every
// path (including /app) serve this same bundle.
const isApp = window.location.pathname.startsWith("/app");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isApp ? (
    <TooltipProvider>
      <App />
    </TooltipProvider>
  ) : (
    <Landing />
  )}</StrictMode>,
);
