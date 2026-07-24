import type { Context } from "hono";
import type { Env } from "../env";
import type { TranscriptItem } from "../lib/transcript";

interface ConversationRow {
  id: string;
  project_id: string;
  title: string;
  updated_at: number;
}

/** Summaries only — full turn history is fetched per-conversation via getConversationRoute. */
export async function listConversationsRoute(c: Context<{ Bindings: Env }>) {
  const { results } = await c.env.TARGET_DB.prepare(
    `SELECT id, project_id, title, updated_at FROM conversations ORDER BY updated_at DESC LIMIT 50`,
  ).all<ConversationRow>();

  return c.json(
    (results ?? []).map((r) => ({
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      updatedAt: r.updated_at,
    })),
  );
}

export async function getConversationRoute(c: Context<{ Bindings: Env }>) {
  const id = c.req.param("id");
  const conversation = await c.env.TARGET_DB.prepare(
    `SELECT id, project_id, title, updated_at FROM conversations WHERE id = ?`,
  )
    .bind(id)
    .first<ConversationRow>();
  if (!conversation) return c.json({ error: "Not found" }, 404);

  const { results } = await c.env.TARGET_DB.prepare(
    `SELECT items_json FROM conversation_messages WHERE conversation_id = ? ORDER BY created_at ASC`,
  )
    .bind(id)
    .all<{ items_json: string }>();

  const items: TranscriptItem[] = (results ?? []).flatMap((r) => JSON.parse(r.items_json) as TranscriptItem[]);

  return c.json({
    id: conversation.id,
    projectId: conversation.project_id,
    title: conversation.title,
    updatedAt: conversation.updated_at,
    items,
  });
}
