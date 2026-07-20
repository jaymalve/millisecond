import { Hono } from "hono";
import type { Env } from "./env";
import type { SpanVariables } from "./middleware/spans";
import { spanMiddleware } from "./middleware/spans";
import { productsRoute } from "./routes/products";
import { ordersRoute } from "./routes/orders";

const app = new Hono<{ Bindings: Env; Variables: SpanVariables }>();

app.use("*", spanMiddleware);
app.get("/", (c) => c.json({ ok: true, routes: ["/api/products", "/api/orders"] }));
app.get("/api/products", productsRoute);
app.get("/api/orders", ordersRoute);

export default app;
