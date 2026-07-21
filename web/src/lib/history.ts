import type { TranscriptItem } from "../state";

export interface InvestigationRecord {
  id: string;
  projectId: string;
  question: string;
  items: TranscriptItem[];
  status: "done" | "error";
  errorMessage?: string;
  createdAt: number;
}

const STORAGE_KEY = "millisecond.history";
const MAX_RECORDS = 50;

/** No backend/auth in this app, so investigation history lives in the browser's localStorage — per-device, not shared. */
export function loadHistory(): InvestigationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Records saved before projects existed have no projectId — backfill
    // them into "target" (the only project that existed at the time).
    return parsed.map((r) => ({ ...r, projectId: r.projectId ?? "target" }));
  } catch {
    return [];
  }
}

export function saveInvestigation(
  record: InvestigationRecord,
  existing: InvestigationRecord[],
): InvestigationRecord[] {
  const next = [record, ...existing].slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or private browsing — history is a nice-to-have, not worth surfacing an error for.
  }
  return next;
}

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
