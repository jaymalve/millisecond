import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Env } from "../env";
import { getRouteMetrics } from "../mastra/tools/routeMetrics";
import { compareToBaseline } from "../mastra/tools/regression";
import { triggerInvestigation } from "../watchdog/runWatchdogCheck";
import { resolveBaseline } from "./resolveBaseline";
import { parseDuration } from "./parseDuration";
import { sensitivityToThreshold, type Sensitivity } from "./sensitivity";

export interface PostDeployCheckParams {
  sha: string;
  /** Already resolved to concrete routes — "*" expansion happens at the POST /api/deploys entry point, not here. */
  routes: string[];
  /** Warmup delay before sampling starts, e.g. "5m". */
  after: string;
  /** How long to sample the post-deploy window, e.g. "10m". */
  window: string;
  /** "previous-deploy" or an explicit commit SHA. */
  baseline: string;
  sensitivity: Sensitivity;
}

interface RouteCheckResult {
  regressionDetected: boolean;
  changepointLabel?: string;
  baselineSha: string;
}

/**
 * Runs once per deploy — see architecture/post-deploy-triggers.md. Sleeps
 * past the warmup window, then for each route: samples the post-deploy
 * and baseline windows and compares them directly via compareToBaseline
 * (the split point is already known — the deploy boundary — unlike the
 * cron watchdog's findRegressionWindow, which searches for one within a
 * single continuous series). Escalates to the same investigator agent
 * the cron watchdog uses when a regression fires, and records every
 * check — regardless of outcome — to deploy_checks.
 */
export class PostDeployCheckWorkflow extends WorkflowEntrypoint<Env, PostDeployCheckParams> {
  async run(event: WorkflowEvent<PostDeployCheckParams>, step: WorkflowStep) {
    const { sha, routes, after, window, baseline, sensitivity } = event.payload;
    const threshold = sensitivityToThreshold(sensitivity);
    const afterMs = parseDuration(after);
    const windowMs = parseDuration(window);

    await step.sleep("warmup", afterMs);

    for (const route of routes) {
      const check = await step.do(`compute regression: ${route}`, async (): Promise<RouteCheckResult> => {
        const resolved = await resolveBaseline(this.env, sha, baseline);
        const postDeployStart = resolved.deployedAtMs + afterMs;

        const [postDeployBuckets, baselineBuckets] = await Promise.all([
          getRouteMetrics(this.env, route, postDeployStart, postDeployStart + windowMs),
          getRouteMetrics(this.env, route, resolved.baselineSinceMs, resolved.baselineUntilMs),
        ]);

        const comparison = compareToBaseline(
          baselineBuckets.map((b) => b.wallTimeP99Ms),
          postDeployBuckets.map((b) => b.wallTimeP99Ms),
          threshold,
        );

        return {
          regressionDetected: comparison?.regressed ?? false,
          changepointLabel: postDeployBuckets[0]?.bucketStart,
          baselineSha: resolved.baselineSha,
        };
      });

      let alertId: string | undefined;
      if (check.regressionDetected) {
        // Same investigator agent run the cron watchdog escalates to —
        // can run multi-minute, so it gets its own generous timeout
        // rather than whatever step.do's default is.
        alertId = await step.do(`investigate: ${route}`, { timeout: "10 minutes" }, async () =>
          triggerInvestigation(this.env, route, check.changepointLabel),
        );
      }

      await step.do(`persist deploy_checks: ${route}`, async () => {
        await this.env.TARGET_DB.prepare(
          `INSERT INTO deploy_checks (id, sha, route, checked_at, regression_detected, changepoint_label, baseline_sha, alert_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            sha,
            route,
            Date.now(),
            check.regressionDetected ? 1 : 0,
            check.changepointLabel ?? null,
            check.baselineSha,
            alertId ?? null,
          )
          .run();
      });
    }
  }
}
