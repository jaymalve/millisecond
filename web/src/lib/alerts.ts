import type { TranscriptItem } from "../state";

const API_URL = import.meta.env.VITE_AGENT_API_URL;

export interface AlertSummary {
  id: string;
  route: string;
  detectedAt: number;
  summary: string;
}

export interface AlertDetail extends AlertSummary {
  reportText: string;
  // Already merged server-side (agent/src/lib/transcript.ts's
  // TranscriptBuilder) into the same shape state.ts's reducer produces —
  // not a raw WireEvent[], so no eventsToItems() replay needed here.
  transcript: TranscriptItem[];
}

/** Watchdog-triggered investigations, persisted server-side in D1 — unlike manual history, there's no browser attached when these run. */
export async function fetchAlerts(): Promise<AlertSummary[]> {
  const res = await fetch(`${API_URL}/api/alerts`);
  if (!res.ok) throw new Error(`Failed to fetch alerts (${res.status})`);
  return res.json();
}

export async function fetchAlert(id: string): Promise<AlertDetail> {
  const res = await fetch(`${API_URL}/api/alerts/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch alert (${res.status})`);
  return res.json();
}
