import { useState } from "react";
import type { TranscriptItem } from "../state";

type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;

const STATUS_ICON: Record<ToolItem["status"], string> = {
  running: "○",
  done: "✓",
  error: "✕",
};

export function ToolCallCard({ item }: { item: ToolItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`tool-card tool-card--${item.status}`}>
      <button className="tool-card__header" onClick={() => setExpanded((v) => !v)}>
        <span className="tool-card__status">{STATUS_ICON[item.status]}</span>
        <span className="tool-card__name">{item.toolName}</span>
        <span className="tool-card__summary">{summarize(item.args)}</span>
        <span className="tool-card__chevron">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="tool-card__body">
          <div className="tool-card__section">
            <div className="tool-card__label">args</div>
            <pre>{safeStringify(item.args)}</pre>
          </div>
          {item.status !== "running" && (
            <div className="tool-card__section">
              <div className="tool-card__label">{item.status === "error" ? "error" : "result"}</div>
              <pre>{safeStringify(item.result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function summarize(args: unknown): string {
  const text = safeStringify(args);
  return text.length > 60 ? text.slice(0, 60) + "…" : text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "undefined";
  } catch {
    return String(value);
  }
}
