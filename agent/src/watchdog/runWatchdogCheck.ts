import type { Env } from "../env";
import { createMastra } from "../mastra";
import { toWireEvent } from "../lib/wireEvents";
import { TranscriptBuilder } from "../lib/transcript";
import { checkRoute } from "./checkRoute";
import { MONITORED_ROUTES } from "./routes";

/**
 * Runs the investigator agent for a route to completion and persists the
 * transcript to D1 — split out from runWatchdogCheck so it's independently
 * testable (e.g. via a temporary route bypassing the cheap-check gate)
 * without duplicating this logic.
 *
 * Builds the compact TranscriptBuilder representation incrementally
 * instead of collecting the raw event stream (hundreds of small
 * reasoning/text-delta chunks, each carrying full tool args/results) and
 * reducing it at the end — that approach genuinely hit Cloudflare's
 * per-invocation CPU/memory limit (error 1102) on a real investigation,
 * confirmed via a manual test before this fix.
 */
export async function triggerInvestigation(env: Env, route: string, changepointLabel?: string): Promise<void> {
  const mastra = createMastra(env);
  const agent = mastra.getAgentById("investigator");
  const prompt = changepointLabel
    ? `An autonomous watchdog check just detected a performance regression on ${route} (changepoint around ${changepointLabel}). Investigate the root cause.`
    : `An autonomous watchdog check just detected a performance regression on ${route}. Investigate the root cause.`;

  const stream = await agent.stream(prompt, {
    maxSteps: 15,
    providerOptions: { openai: { reasoningSummary: "auto" } },
  });

  const builder = new TranscriptBuilder();
  for await (const chunk of stream.fullStream) {
    const event = toWireEvent(chunk);
    if (event) builder.add(event);
  }

  await env.TARGET_DB.prepare(
    `INSERT INTO watchdog_alerts (id, route, detected_at, report_text, transcript_json) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(crypto.randomUUID(), route, Date.now(), builder.getReportText(), JSON.stringify(builder.getItems()))
    .run();
}

/**
 * Runs on the Cron Trigger (see agent/wrangler.toml). Cheap-checks every
 * monitored route; for any that warrant it, runs the same investigator
 * agent used for manual investigations, to completion, server-side — no
 * browser involved, so the result is persisted to D1 (watchdog_alerts)
 * rather than the browser's localStorage that manual investigations use.
 */
export async function runWatchdogCheck(env: Env): Promise<void> {
  for (const route of MONITORED_ROUTES) {
    const result = await checkRoute(env, route);
    if (!result.shouldTrigger) continue;
    await triggerInvestigation(env, route, result.changepointLabel);
  }
}
