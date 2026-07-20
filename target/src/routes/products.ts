import type { Context } from "hono";
import type { Env } from "../env";
import type { SpanVariables } from "../middleware/spans";
import { simulateWork } from "../spans";

/**
 * Fan out to KV (catalog) and D1 (inventory) in parallel. This route is
 * the control: it stays fast across the whole commit history, giving the
 * agent a baseline to contrast a regression against.
 */
export async function productsRoute(c: Context<{ Bindings: Env; Variables: SpanVariables }>) {
  const spans = c.get("spans");
  const [catalog, inventory] = await Promise.all([
    spans.time("kv.get:catalog", async () => {
      await simulateWork(20);
      return c.env.CACHE.get("catalog");
    }),
    spans.time("d1.query:inventory", async () => {
      await simulateWork(40);
      return c.env.DB.prepare("SELECT COUNT(*) AS n FROM spans").first();
    }),
  ]);
  return c.json({ catalog: catalog ?? [], inventory });
}
