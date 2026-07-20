import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Workers Paid plan pricing as published at
// https://developers.cloudflare.com/workers/platform/pricing/ — hardcoded
// here for a quick estimate. Verify current figures before quoting this
// number anywhere serious; Cloudflare has changed pricing before.
const INCLUDED_CPU_MS_PER_MONTH = 30_000_000;
const USD_PER_MILLION_EXTRA_CPU_MS = 0.02;

export const getCostEstimateTool = createTool({
  id: "get-cost-estimate",
  description:
    "Given a before/after CPU-ms-per-request and an assumed monthly request volume, estimate the extra monthly cost from a regression.",
  inputSchema: z.object({
    cpuMsBefore: z.number(),
    cpuMsAfter: z.number(),
    requestsPerMonthAssumed: z.number(),
  }),
  outputSchema: z.object({
    cpuMsDelta: z.number(),
    requestsPerMonthAssumed: z.number(),
    extraCpuCostUsdPerMonth: z.number(),
    note: z.string(),
  }),
  execute: async ({ cpuMsBefore, cpuMsAfter, requestsPerMonthAssumed }) => {
    const cpuMsDelta = cpuMsAfter - cpuMsBefore;
    const extraCpuMsPerMonth = Math.max(0, cpuMsDelta * requestsPerMonthAssumed);
    const billableExtra = Math.max(0, extraCpuMsPerMonth - INCLUDED_CPU_MS_PER_MONTH);
    const extraCpuCostUsdPerMonth = (billableExtra / 1_000_000) * USD_PER_MILLION_EXTRA_CPU_MS;

    return {
      cpuMsDelta,
      requestsPerMonthAssumed,
      extraCpuCostUsdPerMonth,
      note: "Estimate only — assumes a constant CPU-ms delta across all requests and flat monthly volume; does not account for included allotment already consumed by other routes.",
    };
  },
});
