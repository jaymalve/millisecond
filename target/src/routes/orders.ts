import type { Context } from "hono";
import type { Env } from "../env";
import type { SpanVariables } from "../middleware/spans";
import { simulateWork } from "../spans";

/**
 * Looks up a cart (KV), checks inventory (D1), and confirms with a
 * (simulated) payment provider — three independent calls, run
 * sequentially since the payment confirmation includes the cart total.
 */
export async function ordersRoute(c: Context<{ Bindings: Env; Variables: SpanVariables }>) {
  const spans = c.get("spans");

  const cart = await spans.time("kv.get:cart", async () => {
    await simulateWork(25);
    return c.env.CACHE.get("cart");
  });

  const inventory = await spans.time("d1.query:inventory-check", async () => {
    await simulateWork(35);
    return c.env.DB.prepare("SELECT COUNT(*) AS n FROM spans").first();
  });

  const payment = await spans.time("fetch:payment-provider", async () => {
    await simulateWork(150);
    return { authorized: true };
  });

  return c.json({ cart: cart ?? null, inventory, payment });
}
