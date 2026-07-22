import { DEFAULT_REGRESSION_THRESHOLD } from "../mastra/tools/regression";

export type Sensitivity = "low" | "default" | "high";

const THRESHOLDS: Record<Sensitivity, number> = {
  low: 2.5,
  default: DEFAULT_REGRESSION_THRESHOLD,
  high: 1.0,
};

/**
 * Maps the CI config's sensitivity tier to compareToBaseline's threshold.
 * "default" is pinned to DEFAULT_REGRESSION_THRESHOLD rather than its own
 * literal 1.5, so the two never drift apart. See
 * architecture/regression-score-interpretation.md for what these numbers
 * mean.
 */
export function sensitivityToThreshold(sensitivity: Sensitivity): number {
  return THRESHOLDS[sensitivity];
}
