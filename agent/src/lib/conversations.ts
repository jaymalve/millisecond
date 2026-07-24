import type { Env } from "../env";
import type { TranscriptItem } from "./transcript";

export interface ConversationTurnInput {
  conversationId: string;
  projectId: string;
  question: string;
  items: TranscriptItem[];
}

/**
 * Persists one turn of a manual conversation to D1 — creates the parent
 * conversation row on its first turn (title = that turn's question),
 * otherwise just bumps updated_at. Called from investigate.ts via
 * waitUntil once a turn's stream finishes, so it never blocks the
 * response the browser is reading.
 */
export async function persistConversationTurn(env: Env, input: ConversationTurnInput): Promise<void> {
  const now = Date.now();
  const questionItem: TranscriptItem = { kind: "question", id: crypto.randomUUID(), text: input.question };
  const itemsJson = JSON.stringify([questionItem, ...input.items]);

  await env.TARGET_DB.batch([
    env.TARGET_DB.prepare(
      `INSERT INTO conversations (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET updated_at = excluded.updated_at`,
    ).bind(input.conversationId, input.projectId, input.question.slice(0, 140), now, now),
    env.TARGET_DB.prepare(
      `INSERT INTO conversation_messages (id, conversation_id, items_json, created_at) VALUES (?, ?, ?, ?)`,
    ).bind(crypto.randomUUID(), input.conversationId, itemsJson, now),
  ]);
}
