import { useState, type FormEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

interface InvestigateFormProps {
  disabled: boolean;
  onSubmit: (message: string) => void;
}

export function InvestigateForm({ disabled, onSubmit }: InvestigateFormProps) {
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  }

  return (
    <form className="mx-auto flex w-full max-w-[760px] gap-2" onSubmit={handleSubmit}>
      <Input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Why did /api/orders get slower this week?"
        disabled={disabled}
        autoComplete="off"
        className="h-9"
      />
      <Button
        type="submit"
        size="icon-lg"
        disabled={disabled || !message.trim()}
        className="h-9 bg-white text-black hover:bg-white/90"
      >
        {disabled ? <Spinner /> : <ArrowUp />}
        <span className="sr-only">{disabled ? "Investigating…" : "Investigate"}</span>
      </Button>
    </form>
  );
}
