import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { Env } from "../../env";
import { env } from "../../env";

const RouteMetricBucketSchema = z.object({
  bucketStart: z.string().describe("ISO 8601 start of this bucket"),
  requests: z.number(),
  wallTimeP50Ms: z.number(),
  wallTimeP99Ms: z.number(),
});

export type RouteMetricBucket = z.infer<typeof RouteMetricBucketSchema>;

const BUCKET_MS = 5 * 60 * 1000;

/**
 * Per-route request count and wall-time percentiles, bucketed in 5-minute
 * windows from the target worker's own D1 spans (the "total" span
 * recorded once per request in target/'s middleware) — the route-level,
 * fine-grained view Cloudflare's own Analytics API can't provide, since
 * that API is worker-wide and hourly-only.
 *
 * Exported as a plain function (not just wrapped in the tool below) so
 * the watchdog's cheap check can call it directly without going through
 * an LLM turn.
 */
export async function getRouteMetrics(
  targetEnv: Env,
  route: string,
  sinceMs: number,
  untilMs: number,
): Promise<RouteMetricBucket[]> {
  const { results } = await targetEnv.TARGET_DB.prepare(
    `SELECT ts, duration_ms FROM spans
     WHERE route = ? AND span_name = 'total' AND ts >= ? AND ts <= ?
     ORDER BY ts ASC
     LIMIT 5000`,
  )
    .bind(route, sinceMs, untilMs)
    .all<{ ts: number; duration_ms: number }>();

  const buckets = new Map<number, number[]>();
  for (const row of results ?? []) {
    const bucketStart = Math.floor(row.ts / BUCKET_MS) * BUCKET_MS;
    const durations = buckets.get(bucketStart) ?? [];
    durations.push(row.duration_ms);
    buckets.set(bucketStart, durations);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, durations]) => {
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        bucketStart: new Date(bucketStart).toISOString(),
        requests: sorted.length,
        wallTimeP50Ms: percentile(sorted, 0.5),
        wallTimeP99Ms: percentile(sorted, 0.99),
      };
    });
}

export const getRouteMetricsTool = createTool({
  id: "get-route-metrics",
  description:
    "Fetch per-route request count and P50/P99 wall-time, bucketed in 5-minute windows, from real request spans. Use this instead of get-metrics for anything specific to a single route.",
  inputSchema: z.object({
    route: z.string().describe("e.g. /api/orders"),
    sinceMs: z.number().describe("epoch milliseconds"),
    untilMs: z.number().describe("epoch milliseconds"),
  }),
  outputSchema: z.array(RouteMetricBucketSchema),
  execute: async ({ route, sinceMs, untilMs }) => getRouteMetrics(env, route, sinceMs, untilMs),
});

function percentile(sorted: number[], p: number): number {
  const index = Math.floor(p * (sorted.length - 1));
  return sorted[index];
}
