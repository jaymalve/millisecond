import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { env } from "../../env";

const SpanRowSchema = z.object({
  request_id: z.string(),
  span_name: z.string(),
  start_ms: z.number(),
  duration_ms: z.number(),
  ts: z.number(),
});

/**
 * Reads raw spans for a route within a timestamp window from the target
 * worker's D1 database. `TARGET_DB` binds to the same database_id as
 * target/wrangler.toml — D1 databases can be bound from multiple Workers,
 * so this is a real cross-worker read, not a mocked call.
 */
export const getTraceSpansTool = createTool({
  id: "get-trace-spans",
  description:
    "Fetch raw request-span waterfalls for a route within a millisecond timestamp window, to see which internal operation was slow.",
  inputSchema: z.object({
    route: z.string().describe("e.g. /api/orders"),
    sinceMs: z.number(),
    untilMs: z.number(),
  }),
  outputSchema: z.array(SpanRowSchema),
  execute: async ({ route, sinceMs, untilMs }) => {
    const { results } = await env.TARGET_DB.prepare(
      `SELECT request_id, span_name, start_ms, duration_ms, ts
       FROM spans
       WHERE route = ? AND ts >= ? AND ts <= ?
       ORDER BY ts DESC
       LIMIT 200`,
    )
      .bind(route, sinceMs, untilMs)
      .all<z.infer<typeof SpanRowSchema>>();
    return results ?? [];
  },
});
