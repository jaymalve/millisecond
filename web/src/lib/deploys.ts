const API_URL = import.meta.env.VITE_AGENT_API_URL;

export interface DeploySummary {
  sha: string;
  deployedAt: number;
  routesChecked: number;
  regressionsDetected: number;
}

export interface DeployCheck {
  id: string;
  route: string;
  checkedAt: number;
  regressionDetected: boolean;
  changepointLabel: string | null;
  baselineSha: string | null;
  alertId: string | null;
}

export interface DeployDetail {
  sha: string;
  deployedAt: number;
  checks: DeployCheck[];
}

export type DeployStatus = "pending" | "clean" | "regressed";

/** `routesChecked: 0` means the Workflow is still asleep through its warmup window — see agent/src/routes/deploys.ts. */
export function getDeployStatus(summary: Pick<DeploySummary, "routesChecked" | "regressionsDetected">): DeployStatus {
  if (summary.routesChecked === 0) return "pending";
  return summary.regressionsDetected > 0 ? "regressed" : "clean";
}

/** CI-registered deploys, rolled up by SHA server-side (agent/src/routes/deploys.ts) — not a flat per-check list. */
export async function fetchDeploys(): Promise<DeploySummary[]> {
  const res = await fetch(`${API_URL}/api/deploys`);
  if (!res.ok) throw new Error(`Failed to fetch deploys (${res.status})`);
  return res.json();
}

export async function fetchDeploy(sha: string): Promise<DeployDetail> {
  const res = await fetch(`${API_URL}/api/deploys/${sha}`);
  if (!res.ok) throw new Error(`Failed to fetch deploy (${res.status})`);
  return res.json();
}
