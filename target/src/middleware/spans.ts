import type { MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { SpanRecorder } from "../spans";

export type SpanVariables = { spans: SpanRecorder };

/**
 * Attaches a per-request SpanRecorder to context and flushes it to D1
 * after the handler runs. Wraps the whole handler in a "total" span —
 * this is what per-route metrics (P50/P99, request counts) are computed
 * from; Cloudflare's own Analytics API only reports at whole-worker
 * granularity, not per-route.
 */
export const spanMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: SpanVariables }> = async (
  c,
  next,
) => {
  const recorder = new SpanRecorder(c.req.path, crypto.randomUUID());
  c.set("spans", recorder);
  await recorder.time("total", next);
  c.executionCtx.waitUntil(recorder.flush(c.env.DB));
};
