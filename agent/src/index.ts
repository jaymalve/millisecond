import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { investigateRoute } from "./routes/investigate";
import { listAlertsRoute, getAlertRoute } from "./routes/alerts";
import { runWatchdogCheck } from "./watchdog/runWatchdogCheck";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());
app.get("/", (c) => c.json({ ok: true, routes: ["/api/investigate", "/api/alerts"] }));
app.post("/api/investigate", investigateRoute);
app.get("/api/alerts", listAlertsRoute);
app.get("/api/alerts/:id", getAlertRoute);

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
