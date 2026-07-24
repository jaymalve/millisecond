import { getMetricsTool } from "./metrics";
import { getRouteMetricsTool } from "./routeMetrics";
import { findRegressionWindowTool } from "./regression";
import { listDeploysTool } from "./deploys";
import { getDiffTool } from "./diff";
import { getTraceSpansTool } from "./spans";
import { getCostEstimateTool } from "./cost";
import { getKvOperationsTool } from "./kvOperations";
import { loadSkillTool } from "./skills";

export const investigationTools = {
  loadSkill: loadSkillTool,
  getRouteMetrics: getRouteMetricsTool,
  getMetrics: getMetricsTool,
  findRegressionWindow: findRegressionWindowTool,
  listDeploys: listDeploysTool,
  getDiff: getDiffTool,
  getTraceSpans: getTraceSpansTool,
  getCostEstimate: getCostEstimateTool,
  getKvOperations: getKvOperationsTool,
};
