# Watchdog: regression detection (cheap tier)

Runs every cron tick (`agent/wrangler.toml`, `*/30 * * * *`) for each
route in `MONITORED_ROUTES` (`agent/src/watchdog/routes.ts`). No LLM
call. Deterministic.

**Data source.** `getRouteMetrics` (`agent/src/mastra/tools/routeMetrics.ts`)
reads the `total` span from D1, filtered by route over a 6-hour lookback
(`LOOKBACK_MS`). Grouped into 5-minute buckets (`BUCKET_MS`); P50/P99
wall time computed per bucket.

**Changepoint detection.** `findRegressionWindow`
(`agent/src/mastra/tools/regression.ts`) takes the P99 series (one value
per bucket) and evaluates every split point:

```
score(split) = |mean(right) - mean(left)| / pooledStd(left, right)
```

Selects the split with the maximum score. Flags a regression only if:
- `mean(right) > mean(left)` — slower, not faster
- `score >= 1.5` — hardcoded threshold (`regression.ts:61`)

Level-shift detection has a closed-form statistical answer. An LLM adds
cost and unreliability here with no accuracy benefit.

**Cooldown.** `checkRoute` (`agent/src/watchdog/checkRoute.ts`) queries
`watchdog_alerts` for the most recent `detected_at` for that route.
`shouldTrigger = true` iff a regression is flagged AND the last alert for
that route is absent or older than `COOLDOWN_MS` (2 hours). Prevents a
persistent regression from re-triggering a full investigation on every
tick.

**Audit trail.** Every check — regardless of outcome — is inserted into
`watchdog_runs`. Independent of whether the expensive tier fires.

**Handoff.** `shouldTrigger = true` is the only path into
`triggerInvestigation` (`agent/src/watchdog/runWatchdogCheck.ts`), which
runs the full investigator agent (LLM, multi-tool) and persists to
`watchdog_alerts`. Everything above this line is free in LLM-cost terms;
everything below is not.
