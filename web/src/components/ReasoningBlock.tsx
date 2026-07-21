import { useState } from "react";

const TITLE_PATTERN = /^\*\*(.+?)\*\*\n*/;

/** OpenAI's reasoning summaries lead with a short bold title (e.g. "**Evaluating cart and inventory process**") followed by the full narrative — use that title as the toggle label instead of a generic "Reasoning" caption. */
function splitTitle(text: string): { label: string; body: string } {
  const match = TITLE_PATTERN.exec(text);
  if (match) {
    return { label: match[1], body: text.slice(match[0].length).trim() };
  }
  const firstLine = text.trim().split("\n")[0] ?? "";
  return { label: firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine || "Reasoning", body: text };
}

export function ReasoningBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);
  const { label, body } = splitTitle(text);

  return (
    <div className="reasoning-accordion">
      <button className="reasoning-accordion__toggle" onClick={() => setExpanded((v) => !v)}>
        <span className="reasoning-accordion__label">{label}</span>
        <span className={`reasoning-accordion__chevron ${expanded ? "reasoning-accordion__chevron--open" : ""}`}>
          ›
        </span>
      </button>
      {expanded && <p className="reasoning-block">{body}</p>}
    </div>
  );
}
