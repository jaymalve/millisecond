import type { TranscriptItem } from "../state";
import { QuestionBlock } from "./QuestionBlock";
import { ReasoningBlock } from "./ReasoningBlock";
import { AnswerBlock } from "./AnswerBlock";
import { ToolCallCard } from "./ToolCallCard";
import { MessageScrollerItem } from "./ui/message-scroller";

/** Renders each transcript item as a MessageScroller row — a "question" item starts a new turn, followed by that turn's reasoning/tool/answer blocks. The first item of whatever's currently displayed is the scroll anchor. `activeItemId` is the item still receiving deltas (only set while a fresh investigation is actually streaming) — it's the one whose reasoning label shimmers. */
export function Transcript({ items, activeItemId }: { items: TranscriptItem[]; activeItemId?: string }) {
  return (
    <>
      {items.map((item, index) => (
        <MessageScrollerItem key={item.id} messageId={item.id} scrollAnchor={index === 0}>
          {item.kind === "question" && <QuestionBlock text={item.text} />}
          {item.kind === "reasoning" && <ReasoningBlock text={item.text} active={item.id === activeItemId} />}
          {item.kind === "answer" && <AnswerBlock text={item.text} />}
          {item.kind === "tool" && <ToolCallCard item={item} />}
        </MessageScrollerItem>
      ))}
    </>
  );
}
