import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const RegressionWindowSchema = z.object({
  changepointIndex: z.number(),
  changepointLabel: z.string(),
  before: z.object({ mean: z.number(), count: z.number() }),
  after: z.object({ mean: z.number(), count: z.number() }),
  percentIncrease: z.number(),
});

/**
 * Deterministic changepoint detection, not delegated to the LLM: for each
 * split point, compares the mean of the left/right segments and picks the
 * split with the largest standardized jump. Level-shift detection is a
 * numeric problem the model would otherwise eyeball unreliably.
 */
export const findRegressionWindowTool = createTool({
  id: "find-regression-window",
  description:
    "Run changepoint detection over a numeric metric series (e.g. wallTimeP99 values from get-metrics, in chronological order) to find where a level shift occurred.",
  inputSchema: z.object({
    values: z.array(z.number()),
    labels: z.array(z.string()).describe("Same length as values, e.g. the datetimeHour for each point."),
  }),
  outputSchema: RegressionWindowSchema.nullable(),
  execute: async ({ values, labels }) => findRegressionWindow(values, labels),
});

function findRegressionWindow(
  values: number[],
  labels: string[],
): z.infer<typeof RegressionWindowSchema> | null {
  if (values.length < 4 || values.length !== labels.length) return null;

  let best: z.infer<typeof RegressionWindowSchema> | null = null;
  let bestScore = 0;

  for (let split = 2; split < values.length - 1; split++) {
    const left = values.slice(0, split);
    const right = values.slice(split);

    const leftMean = mean(left);
    const rightMean = mean(right);
    const pooledStd = Math.sqrt((variance(left) + variance(right)) / 2) || 1;
    const score = Math.abs(rightMean - leftMean) / pooledStd;

    if (score > bestScore && rightMean > leftMean) {
      bestScore = score;
      best = {
        changepointIndex: split,
        changepointLabel: labels[split],
        before: { mean: leftMean, count: left.length },
        after: { mean: rightMean, count: right.length },
        percentIncrease: ((rightMean - leftMean) / leftMean) * 100,
      };
    }
  }

  // Require a real, not noise-level, shift before calling it a regression.
  if (!best || bestScore < 1.5) return null;
  return best;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
}
