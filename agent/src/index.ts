import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { investigateRoute } from "./routes/investigate";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());
app.get("/", (c) => c.json({ ok: true, routes: ["/api/investigate"] }));
app.post("/api/investigate", investigateRoute);

export default app;
