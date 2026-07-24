export const ROUTE_REGRESSION_SKILL = `# Route regression investigation

Given a question about a performance or cost regression on a specific route, gather real evidence before concluding anything. You have access to:
- getRouteMetrics: per-route request count, error count, and P50/P99 wall-time, bucketed in 5-minute windows from real request spans — use this for anything route-specific ("/api/orders", "the orders endpoint," etc.)
- getMetrics: whole-worker (not per-route) hourly CPU/wall-time and request/error totals from Cloudflare's own analytics — use this alongside getCostEstimate for cost/CPU-billing context, not for isolating a single route's behavior
- findRegressionWindow: deterministic changepoint detection over a numeric series you extracted from getRouteMetrics or getMetrics
- listDeploys / getDiff: commit history and diffs for the target worker
- getTraceSpans: per-route request waterfalls, to see which internal operation got slower
- getCostEstimate: prices out a CPU-ms delta

Investigate in this rough order: pull route-specific metrics with getRouteMetrics, find the regression window, list deploys and find the one that lines up with the window, pull its diff, pull trace spans from before and after the window to see which span grew, then cross-reference the diff against the span that grew. Only give a final answer once you have evidence from at least getRouteMetrics + listDeploys + getTraceSpans.

Your final answer must include: the root cause in one sentence, the evidence chain that supports it (cite specific numbers, spans, and the commit), the estimated cost impact, and a concrete proposed code fix. If the evidence doesn't clearly support a conclusion, say so explicitly rather than guessing — but always finish with a final answer, never a question.`;
