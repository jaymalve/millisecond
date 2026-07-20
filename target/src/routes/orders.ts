import type { Context } from "hono";
import type { Env } from "../env";
import type { SpanVariables } from "../middleware/spans";
import { simulateWork } from "../spans";

/**
 * Looks up a cart (KV), checks inventory (D1), and confirms with a
 * (simulated) payment provider — three independent calls, run in
 * parallel. This is the route a later commit regresses to sequential
 * awaits, giving the agent a real diff to bisect to and explain.
 */
export async function ordersRoute(c: Context<{ Bindings: Env; Variables: SpanVariables }>) {
  const spans = c.get("spans");
  const [cart, inventory, payment] = await Promise.all([
    spans.time("kv.get:cart", async () => {
      await simulateWork(25);
      return c.env.CACHE.get("cart");
    }),
    spans.time("d1.query:inventory-check", async () => {
      await simulateWork(35);
      return c.env.DB.prepare("SELECT COUNT(*) AS n FROM spans").first();
    }),
    spans.time("fetch:payment-provider", async () => {
      await simulateWork(150);
      return { authorized: true };
    }),
  ]);
  return c.json({ cart: cart ?? null, inventory, payment });
}
