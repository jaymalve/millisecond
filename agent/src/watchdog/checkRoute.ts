import type { Env } from "../env";
import { getRouteMetrics } from "../mastra/tools/routeMetrics";
import { findRegressionWindow } from "../mastra/tools/regression";

const LOOKBACK_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_MS = 2 * 60 * 60 * 1000;

export interface RouteCheckResult {
  route: string;
  regressionDetected: boolean;
  changepointLabel?: string;
  /** Regression detected AND no alert already fired for this route within the cooldown window. */
  shouldTrigger: boolean;
}

/**
 * The cheap half of the watchdog: pulls the last 6 hours of this route's
 * metrics and runs the same deterministic changepoint detection the
 * manual investigation flow uses — no LLM call, so this can run on every
 * cron tick without burning tokens or subrequest budget on routes that
 * are perfectly healthy.
 */
export async function checkRoute(env: Env, route: string): Promise<RouteCheckResult> {
  const now = Date.now();
  const buckets = await getRouteMetrics(env, route, now - LOOKBACK_MS, now);
  const regression = findRegressionWindow(
    buckets.map((b) => b.wallTimeP99Ms),
    buckets.map((b) => b.bucketStart),
  );

  const regressionDetected = regression !== null;
  let shouldTrigger = false;

  if (regressionDetected) {
    const { results } = await env.TARGET_DB.prepare(
      `SELECT detected_at FROM watchdog_alerts WHERE route = ? ORDER BY detected_at DESC LIMIT 1`,
    )
      .bind(route)
      .all<{ detected_at: number }>();
    const lastAlertAt = results?.[0]?.detected_at;
    shouldTrigger = !lastAlertAt || now - lastAlertAt > COOLDOWN_MS;
  }

  await env.TARGET_DB.prepare(
    `INSERT INTO watchdog_runs (route, checked_at, regression_detected, changepoint_label) VALUES (?, ?, ?, ?)`,
  )
    .bind(route, now, regressionDetected ? 1 : 0, regression?.changepointLabel ?? null)
    .run();

  return { route, regressionDetected, changepointLabel: regression?.changepointLabel, shouldTrigger };
}
