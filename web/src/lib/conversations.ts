import type { TranscriptItem } from "../state";

const API_URL = import.meta.env.VITE_AGENT_API_URL;

export interface ConversationSummary {
  id: string;
  projectId: string;
  title: string;
  updatedAt: number;
}

export interface ConversationDetail extends ConversationSummary {
  // Already merged server-side (agent/src/lib/transcript.ts's
  // TranscriptBuilder, one turn's items concatenated after another) into
  // the same shape state.ts's reducer produces — not raw per-turn rows,
  // so no client-side replay/merge step is needed here.
  items: TranscriptItem[];
}

/** Manual (chat) conversations, persisted server-side in D1 — replaces the old localStorage-backed history so it survives a page reload and a device switch. */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_URL}/api/conversations`);
  if (!res.ok) throw new Error(`Failed to fetch conversations (${res.status})`);
  return res.json();
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_URL}/api/conversations/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch conversation (${res.status})`);
  return res.json();
}
