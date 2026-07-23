import type { TranscriptItem } from "../state";
import { ReasoningBlock } from "./ReasoningBlock";
import { AnswerBlock } from "./AnswerBlock";
import { ToolCallCard } from "./ToolCallCard";
import { MessageScrollerItem } from "./ui/message-scroller";

/** Renders each transcript item as a MessageScroller row. The first item of whatever's currently displayed is the scroll anchor — this app has no rendered "user message" row to anchor on, so the start of a fresh investigation's own output is the natural turn boundary. `activeItemId` is the item still receiving deltas (only set while a fresh investigation is actually streaming) — it's the one whose reasoning label shimmers. */
export function Transcript({ items, activeItemId }: { items: TranscriptItem[]; activeItemId?: string }) {
  return (
    <>
      {items.map((item, index) => (
        <MessageScrollerItem key={item.id} messageId={item.id} scrollAnchor={index === 0}>
          {item.kind === "reasoning" && <ReasoningBlock text={item.text} active={item.id === activeItemId} />}
          {item.kind === "answer" && <AnswerBlock text={item.text} />}
          {item.kind === "tool" && <ToolCallCard item={item} />}
        </MessageScrollerItem>
      ))}
    </>
  );
}
