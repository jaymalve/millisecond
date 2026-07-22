import type { Context } from "hono";
import type { Env } from "../env";

interface AlertRow {
  id: string;
  route: string;
  detected_at: number;
  report_text: string;
}

/** Summaries only — full transcript is fetched per-alert via getAlertRoute. */
export async function listAlertsRoute(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.TARGET_DB.prepare(
    `SELECT id, route, detected_at, report_text FROM watchdog_alerts ORDER BY detected_at DESC LIMIT 50`,
  ).all<AlertRow>();

  return c.json(
    (results ?? []).map((r) => ({
      id: r.id,
      route: r.route,
      detectedAt: r.detected_at,
      summary: r.report_text.slice(0, 140),
    })),
  );
}

export async function getAlertRoute(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  const row = await c.env.TARGET_DB.prepare(
    `SELECT id, route, detected_at, report_text, transcript_json FROM watchdog_alerts WHERE id = ?`,
  )
    .bind(id)
    .first<AlertRow & { transcript_json: string }>();

  if (!row) return c.json({ error: "Not found" }, 404);

  return c.json({
    id: row.id,
    route: row.route,
    detectedAt: row.detected_at,
    reportText: row.report_text,
    transcript: JSON.parse(row.transcript_json),
  });
}
