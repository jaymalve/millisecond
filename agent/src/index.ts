import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { investigateRoute } from "./routes/investigate";
import { listAlertsRoute, getAlertRoute } from "./routes/alerts";
import { createDeployCheckRoute, listDeploysRoute, getDeployRoute } from "./routes/deploys";
import { runWatchdogCheck } from "./watchdog/runWatchdogCheck";

// Wrangler resolves [[workflows]]'s class_name against a named export of
// this file (the Worker's `main`) — not a module-scope side effect, so
// this export is required even though nothing calls it directly yet.
export { PostDeployCheckWorkflow } from "./postDeploy/postDeployWorkflow";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());
app.get("/", (c) => c.json({ ok: true, routes: ["/api/investigate", "/api/alerts", "/api/deploys"] }));
app.post("/api/investigate", investigateRoute);
app.get("/api/alerts", listAlertsRoute);
app.get("/api/alerts/:id", getAlertRoute);
app.post("/api/deploys", createDeployCheckRoute);
app.get("/api/deploys", listDeploysRoute);
app.get("/api/deploys/:sha", getDeployRoute);

export default {
  fetch: app.fetch,
  // Runs on the Cron Trigger configured in wrangler.toml. waitUntil keeps
  // the invocation alive for the full watchdog check (which can include
  // a multi-minute agent investigation) past whatever the runtime would
  // otherwise consider "done."
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(runWatchdogCheck(env));
  },
} satisfies ExportedHandler<Env>;
