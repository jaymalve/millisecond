export const CLOUDFLARE_OPS_SKILL = `# General Cloudflare operations

Use this when there's no single known route or deploy to pin a regression to yet — cache behavior, whole-worker traffic or cost trends, or an open-ended "is X actually happening" question. You have access to:
- getKvOperations: daily read/write/delete/list counts for the target's CACHE namespace, from Cloudflare's own KV analytics — use this to check whether a route is actually hitting KV as expected, independent of any single request's latency
- getTraceSpans: per-route request waterfalls — shows how long an individual KV/D1/fetch call took inside one request, complementary to getKvOperations' account-wide volume
- getMetrics: whole-worker hourly CPU/wall-time and request/error totals
- getCostEstimate: prices out a CPU-ms delta, if the question has a cost angle
- getRouteMetrics: per-route request/error counts and latency, if the question turns out to be route-specific after all

This skill covers less fixed ground than a route regression: there's no single prescribed evidence chain, so use judgment about which of the above tools actually bears on the question. getKvOperations reports operation counts, not hit/miss — say so explicitly if the question needs a hit rate you can't produce, rather than inferring one.

Your final answer must state the finding in one sentence and the evidence for it (cite specific numbers). Only include a cost estimate or a proposed fix if the question and evidence actually support one. If the evidence doesn't clearly support a conclusion, say so explicitly rather than guessing — but always finish with a final answer, never a question.`;
