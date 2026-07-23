import { Skeleton } from "./ui/skeleton";

/** Shown between submit and the first streamed event — no transcript shape to mimic yet, just activity. */
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Skeleton className="size-4 rounded-full" />
      <span>Investigating…</span>
    </div>
  );
}
