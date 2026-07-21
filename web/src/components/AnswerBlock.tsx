import { Markdown } from "./Markdown";

export function AnswerBlock({ text }: { text: string }) {
  return (
    <div className="answer-block">
      <Markdown text={text} />
    </div>
  );
}
