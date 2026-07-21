import { getMetricsTool } from "./metrics";
import { getRouteMetricsTool } from "./routeMetrics";
import { findRegressionWindowTool } from "./regression";
import { listDeploysTool } from "./deploys";
import { getDiffTool } from "./diff";
import { getTraceSpansTool } from "./spans";
import { getCostEstimateTool } from "./cost";

export const investigationTools = {
  getRouteMetrics: getRouteMetricsTool,
  getMetrics: getMetricsTool,
  findRegressionWindow: findRegressionWindowTool,
  listDeploys: listDeploysTool,
  getDiff: getDiffTool,
  getTraceSpans: getTraceSpansTool,
  getCostEstimate: getCostEstimateTool,
};
