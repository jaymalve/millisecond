import type { Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { MONITORED_ROUTES } from "../watchdog/routes";
import { parseDuration } from "../postDeploy/parseDuration";

const DeployCheckRequestSchema = z.object({
  sha: z.string().min(1),
  routes: z.string().min(1).describe('"*" or a comma-separated list, e.g. "/checkout,/cart"'),
  after: z.string().min(1),
  window: z.string().min(1),
  baseline: z.string().min(1).describe('"previous-deploy" or an explicit commit SHA'),
  sensitivity: z.enum(["low", "default", "high"]).default("default"),
});

function isValidSecret(provided: string, expected: string): boolean {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);
  // Reject before comparing on length mismatch — crypto.subtle's
  // timingSafeEqual (a workerd extension, not standard Web Crypto)
  // requires equal-length inputs.
  if (providedBytes.length !== expectedBytes.length) return false;
  return crypto.subtle.timingSafeEqual(providedBytes, expectedBytes);
}

function resolveRoutes(routes: string): string[] {
  if (routes.trim() === "*") return MONITORED_ROUTES;
  return routes
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * CI calls this right after a deploy (see
 * architecture/post-deploy-triggers.md) — unlike the cron tick, which
 * nothing outside this account can reach, this endpoint is public, so
 * it's gated on a shared secret rather than relying on obscurity.
 *
 * Idempotent by design: re-posting the same SHA (a CI retry of the same
 * push) doesn't move the recorded deploy timestamp and doesn't spawn a
 * second Workflow instance — it returns the one already running.
 */
export async function createDeployCheckRoute(c: Context<{ Bindings: Env }>) {
  const [scheme, token] = (c.req.header("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token || !isValidSecret(token, c.env.DEPLOY_WEBHOOK_SECRET)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const parsed = DeployCheckRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }
  const { sha, routes, after, window, baseline, sensitivity } = parsed.data;

  const resolvedRoutes = resolveRoutes(routes);
  if (resolvedRoutes.length === 0) {
    return c.json({ error: `"routes" resolved to no routes` }, 400);
  }

  try {
    parseDuration(after);
    parseDuration(window);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Invalid duration" }, 400);
  }

  // First post for a given SHA wins the timestamp — a CI retry of the
  // same push shouldn't move the baseline-resolution anchor.
  await c.env.TARGET_DB.prepare(`INSERT OR IGNORE INTO deploys (sha, deployed_at) VALUES (?, ?)`)
    .bind(sha, Date.now())
    .run();

  let workflowInstanceId: string;
  try {
    const instance = await c.env.POST_DEPLOY_CHECK.create({
      id: sha,
      params: { sha, routes: resolvedRoutes, after, window, baseline, sensitivity },
    });
    workflowInstanceId = instance.id;
  } catch {
    // Instance ID (the SHA) already exists within the retention period —
    // return the existing instance instead of erroring.
    const existing = await c.env.POST_DEPLOY_CHECK.get(sha);
    workflowInstanceId = existing.id;
  }

  return c.json({ sha, workflowInstanceId }, 202);
}
