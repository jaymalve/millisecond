import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { TranscriptItem } from "../state";
import { Badge } from "./ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

type ToolItem = Extract<TranscriptItem, { kind: "tool" }>;

const STATUS_LABEL: Record<ToolItem["status"], string> = {
  running: "running",
  done: "done",
  error: "error",
};

const STATUS_CLASS: Record<ToolItem["status"], string> = {
  running: "text-muted-foreground",
  done: "border-(--success)/40 text-(--success)",
  error: "border-(--danger)/40 text-(--danger)",
};

export function ToolCallCard({ item }: { item: ToolItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 font-mono text-xs outline-none">
        <Badge variant="outline" className={`shrink-0 ${STATUS_CLASS[item.status]}`}>
          <span className={item.status === "running" ? "shimmer" : undefined}>{STATUS_LABEL[item.status]}</span>
        </Badge>
        <span className="font-semibold text-foreground">{item.toolName}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{summarize(item.args)}</span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-2.5 border-t border-border px-3 py-2.5">
        <div>
          <div className="mb-1 font-mono text-[0.7rem] tracking-wide text-muted-foreground/70 uppercase">args</div>
          <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap">
            {safeStringify(item.args)}
          </pre>
        </div>
        {item.status !== "running" && (
          <div>
            <div className="mb-1 font-mono text-[0.7rem] tracking-wide text-muted-foreground/70 uppercase">
              {item.status === "error" ? "error" : "result"}
            </div>
            <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[0.78rem] leading-relaxed whitespace-pre-wrap">
              {safeStringify(item.result)}
            </pre>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
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
