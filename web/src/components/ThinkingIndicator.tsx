import { Skeleton } from "./Skeleton";

/** Shown between submit and the first streamed event — no transcript shape to mimic yet, just activity. */
export function ThinkingIndicator() {
  return (
    <div className="thinking-indicator">
      <Skeleton width="1em" height="1em" />
      <span>Investigating…</span>
    </div>
  );
}
