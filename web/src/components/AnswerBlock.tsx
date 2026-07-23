import { Card, CardContent } from "./ui/card";
import { Markdown } from "./Markdown";

export function AnswerBlock({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="answer-block text-[0.88rem] leading-relaxed">
        <Markdown text={text} />
      </CardContent>
    </Card>
  );
}
