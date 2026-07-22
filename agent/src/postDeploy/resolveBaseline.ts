import { NonRetryableError } from "cloudflare:workflows";
import type { Env } from "../env";

export interface BaselineResolution {
  /** When `sha` itself was deployed. */
  deployedAtMs: number;
  baselineSha: string;
  baselineSinceMs: number;
  baselineUntilMs: number;
}

/**
 * Resolves `baseline` ("previous-deploy" or an explicit SHA) to a time
 * window against the `deploys` table: [deployed_at(baselineSha),
 * deployed_at(next deploy after it)). "previous-deploy" is the same
 * lookup with "next deploy" landing on `sha` itself by construction.
 *
 * Config problems (unknown SHA, baseline still live) throw
 * NonRetryableError — retrying against the same table state can't fix a
 * bad SHA, so Workflows' default step retry would otherwise just burn
 * attempts on a permanent failure.
 *
 * See architecture/post-deploy-triggers.md's "Baseline resolution"
 * section for the reasoning (explicit SHA over "previous-deploy" as the
 * recommended default, to avoid compounding regressions going
 * unnoticed).
 */
export async function resolveBaseline(env: Env, sha: string, baseline: string): Promise<BaselineResolution> {
  const current = await env.TARGET_DB.prepare(`SELECT deployed_at FROM deploys WHERE sha = ?`)
    .bind(sha)
    .first<{ deployed_at: number }>();
  if (!current) throw new NonRetryableError(`Deploy ${sha} not found in deploys table`);

  const baselineSha =
    baseline === "previous-deploy" ? await previousDeploySha(env, current.deployed_at) : baseline;

  if (baselineSha === sha) {
    throw new NonRetryableError(`Baseline resolves to the deploy under test (${sha}) — nothing to compare against`);
  }

  const baselineRow = await env.TARGET_DB.prepare(`SELECT deployed_at FROM deploys WHERE sha = ?`)
    .bind(baselineSha)
    .first<{ deployed_at: number }>();
  if (!baselineRow) throw new NonRetryableError(`Baseline deploy ${baselineSha} not found in deploys table`);

  const nextRow = await env.TARGET_DB.prepare(
    `SELECT deployed_at FROM deploys WHERE deployed_at > ? ORDER BY deployed_at ASC LIMIT 1`,
  )
    .bind(baselineRow.deployed_at)
    .first<{ deployed_at: number }>();
  if (!nextRow) {
    throw new NonRetryableError(
      `Baseline deploy ${baselineSha} has no deploy after it — it may still be live, which makes it an invalid baseline`,
    );
  }

  return {
    deployedAtMs: current.deployed_at,
    baselineSha,
    baselineSinceMs: baselineRow.deployed_at,
    baselineUntilMs: nextRow.deployed_at,
  };
}

async function previousDeploySha(env: Env, beforeMs: number): Promise<string> {
  const row = await env.TARGET_DB.prepare(
    `SELECT sha FROM deploys WHERE deployed_at < ? ORDER BY deployed_at DESC LIMIT 1`,
  )
    .bind(beforeMs)
    .first<{ sha: string }>();
  if (!row) throw new NonRetryableError(`No deploy before ${beforeMs} to use as a previous-deploy baseline`);
  return row.sha;
}
