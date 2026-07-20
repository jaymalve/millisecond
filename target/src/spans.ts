export interface SpanRow {
  request_id: string;
  route: string;
  span_name: string;
  start_ms: number;
  duration_ms: number;
  ts: number;
}

/**
 * Stands in for a tracing SDK: buffers spans for one request in memory,
 * then flushes them as a single batched D1 insert. Call `flush` via
 * `ctx.waitUntil` so it never adds latency to the response being measured.
 */
export class SpanRecorder {
  private readonly spans: SpanRow[] = [];
  private readonly requestId: string;
  private readonly route: string;
  private readonly origin: number;

  constructor(route: string, requestId: string) {
    this.route = route;
    this.requestId = requestId;
    this.origin = Date.now();
  }

  /** Wraps an async operation, recording its wall-clock duration as a span. */
  async time<T>(spanName: string, work: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await work();
    } finally {
      const end = Date.now();
      this.spans.push({
        request_id: this.requestId,
        route: this.route,
        span_name: spanName,
        start_ms: start - this.origin,
        duration_ms: end - start,
        ts: this.origin,
      });
    }
  }

  async flush(db: D1Database): Promise<void> {
    if (this.spans.length === 0) return;
    const stmt = db.prepare(
      `INSERT INTO spans (request_id, route, span_name, start_ms, duration_ms, ts)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    await db.batch(
      this.spans.map((s) =>
        stmt.bind(s.request_id, s.route, s.span_name, s.start_ms, s.duration_ms, s.ts),
      ),
    );
  }
}

/** Simulates latency for an operation that would otherwise be near-instant on Workers. */
export function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
