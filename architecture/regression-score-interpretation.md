# Reading the regression score: what 1.0 / 1.5 / 2.5 mean

`findRegressionWindow` (`agent/src/mastra/tools/regression.ts`) reduces a
bucketed P99 series down to one number per candidate split point:

```
score(split) = |mean(right) - mean(left)| / pooledStd(left, right)
pooledStd     = sqrt((variance(left) + variance(right)) / 2)
```

The split with the highest score wins, and is only called a regression if
`score >= threshold` (currently a hardcoded `1.5` at `regression.ts:53`;
see `architecture/post-deploy-triggers.md` for making that threshold
configurable via a `sensitivity` enum). This doc is about what that
number actually represents, so `1.5` (or `1.0`/`2.5`) isn't a magic
constant to future readers.

## It's an effect size, not a p-value

This formula is Cohen's d — a standardized mean difference. It answers
"how many pooled-standard-deviations apart are these two segments' means"
— not "how statistically significant is this difference" and not
"how many milliseconds did it get slower by." That distinction matters:

- A t-statistic divides by *standard error*, which shrinks as sample size
  grows — so it increases with more data even for a fixed, unchanging
  effect size.
- Cohen's d divides by *standard deviation*, which doesn't shrink with
  more samples — it's scale-free and roughly sample-size-invariant.

That's *why* the same `1.5` threshold can be reused across routes with
very different traffic volumes and lookback windows without
recalibrating per-route: it's measuring the shift relative to that
route's own noise, not an artifact of how many requests it happened to
serve.

One divergence from the textbook formula worth knowing: real Cohen's d
pools variance weighted by each segment's sample size
(`((n1-1)*var1 + (n2-1)*var2) / (n1+n2-2)`); this code averages the two
variances unweighted (`(var1 + var2) / 2`). It matters most when the two
segments are very different sizes — which happens for changepoints found
near either edge of the search range (see below).

## Why the bar sits above the textbook "large effect"

Cohen's original convention: 0.2 = small, 0.5 = medium, 0.8 = large. This
system's floor is `1.0`, and its default is `1.5` — well past what
academic convention calls a large effect. That's deliberate, not an
oversight: a flagged regression here isn't a research finding, it
escalates into a real LLM investigation (`triggerInvestigation`,
`agent/src/watchdog/runWatchdogCheck.ts` — genuine token cost) and
produces a page-worthy alert. The cost of a false positive is real money
and alert fatigue, so the threshold intentionally trades away sensitivity
to genuinely-real-but-small regressions in exchange for a low
false-positive rate on the ones that do fire.

| score | tier | meaning |
|---|---|---|
| `< 1.0` | (nothing fires) | noise-level — routine variance in the P99 series itself |
| `>= 1.0` | `sensitivity: high` | shift is on the same order as the segment's own spread — the weakest tier that still calls it signal |
| `>= 1.5` | `sensitivity: default` | what the cron watchdog has run in production with since inception — the calibrated baseline |
| `>= 2.5` | `sensitivity: low` | shift is more than double the pooled spread — reserved for unambiguous regressions |

## Caveats for anyone tempted to tune this further

**Multiple comparisons.** `findRegressionWindow` evaluates *every* split
point from index 2 to `length - 1` and keeps the max score
(`regression.ts:29`) — this is a scan, not one planned comparison. The
effective false-positive rate at a nominal `1.5` is therefore higher than
a textbook single Cohen's-d comparison at that value would suggest,
because the maximum of many noisy estimates is itself biased upward
("look-elsewhere effect"). `1.5` was set empirically against observed
traffic, not derived from a formula — lowering it further should be
validated against `watchdog_runs`' false-positive rate first, not assumed
safe by analogy to the stats textbook definition.

This bias is specific to the *scan*, not the formula. `compareToBaseline`
(`agent/src/mastra/tools/regression.ts`, added for
[post-deploy-triggers.md](post-deploy-triggers.md)) uses the identical
score formula on two pre-defined groups — a baseline window and a
post-deploy window whose boundary is already known from the `deploys`
table — with no split search at all. A `1.5` from `compareToBaseline` is
a single planned comparison and doesn't carry the look-elsewhere
inflation a `1.5` from `findRegressionWindow` does, even though both
currently default to the same numeric threshold. If the two thresholds
are ever tuned independently, this is why `compareToBaseline` can
reasonably run lower than `findRegressionWindow` for the same target
false-positive rate.

**Edge segments are noisier.** A changepoint found near either edge of
the search range (small `split`, or `split` near `length - 1`) computes
`variance()` from very few buckets. `pooledStd` — and therefore the score
— is noisier there than for a changepoint found near the middle of the
window. `findRegressionWindow` doesn't currently discount or flag
edge-adjacent changepoints; a score of `1.6` from a 2-bucket segment and
a score of `1.6` from a 20-bucket segment are treated identically today.

**Bucket granularity is baked into the calibration.** Buckets are 5
minutes (`BUCKET_MS`, `routeMetrics.ts`). Coarser buckets smooth out
noise (lower variance, higher scores for the same real shift) but blur
*where* the changepoint actually happened; finer buckets do the reverse.
If `BUCKET_MS` ever changes, treat `1.0`/`1.5`/`2.5` as invalidated and
re-derive them against real traffic — they are not scale-invariant to
bucket size the way Cohen's d nominally is to sample size.

## See also

- [`watchdog-regression-detection.md`](watchdog-regression-detection.md) — the cron-triggered consumer of this score.
- [`post-deploy-triggers.md`](post-deploy-triggers.md) — the CI-triggered consumer, and where the `sensitivity` enum in the table above is configured.
