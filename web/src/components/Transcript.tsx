import type { TranscriptItem } from "../state";
import { ReasoningBlock } from "./ReasoningBlock";
import { AnswerBlock } from "./AnswerBlock";
import { ToolCallCard } from "./ToolCallCard";

export function Transcript({ items }: { items: TranscriptItem[] }) {
  return (
    <div className="transcript">
      {items.map((item) => {
        switch (item.kind) {
          case "reasoning":
            return <ReasoningBlock key={item.id} text={item.text} />;
          case "answer":
            return <AnswerBlock key={item.id} text={item.text} />;
          case "tool":
            return <ToolCallCard key={item.id} item={item} />;
        }
      })}
    </div>
  );
}
