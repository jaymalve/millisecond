import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

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
    <Collapsible open={expanded} onOpenChange={setExpanded} className="flex flex-col gap-1">
      <CollapsibleTrigger className="group inline-flex max-w-full items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground">
        <span className="truncate">{label}</span>
        <ChevronRight className="size-3.5 shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 text-[0.82rem] leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
        {body}
      </CollapsibleContent>
    </Collapsible>
  );
}
