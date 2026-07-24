/** Marks the start of a turn in a multi-turn conversation — just the question text with a top divider, not a chat bubble; this is a developer tool, not a messaging app. */
export function QuestionBlock({ text }: { text: string }) {
  return (
    <div className="border-t border-border pt-4 text-[0.92rem] font-medium text-foreground first:border-t-0 first:pt-0">
      {text}
    </div>
  );
}
