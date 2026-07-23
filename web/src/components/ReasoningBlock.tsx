import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Marker, MarkerContent } from "./ui/marker";

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

/** `active` is true only while this block is still receiving reasoning deltas — the label shimmers like Cursor/Claude Code's live action verb, then settles once the model moves on to the next block. */
export function ReasoningBlock({ text, active = false }: { text: string; active?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  const { label, body } = splitTitle(text);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className="flex flex-col gap-1">
      <CollapsibleTrigger className="group w-full text-left outline-none">
        <Marker className="text-xs group-hover:text-foreground">
          <MarkerContent className={active ? "shimmer" : undefined}>{label}</MarkerContent>
          <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90" />
        </Marker>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-[0.82rem] leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
        {body}
      </CollapsibleContent>
    </Collapsible>
  );
}
