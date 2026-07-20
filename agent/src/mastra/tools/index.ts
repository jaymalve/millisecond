import { getMetricsTool } from "./metrics";
import { findRegressionWindowTool } from "./regression";
import { listDeploysTool } from "./deploys";
import { getDiffTool } from "./diff";
import { getTraceSpansTool } from "./spans";
import { getCostEstimateTool } from "./cost";

export const investigationTools = {
  getMetrics: getMetricsTool,
  findRegressionWindow: findRegressionWindowTool,
  listDeploys: listDeploysTool,
  getDiff: getDiffTool,
  getTraceSpans: getTraceSpansTool,
  getCostEstimate: getCostEstimateTool,
};
