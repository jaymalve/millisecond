import { useState, type FormEvent } from "react";

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
    <form className="investigate-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Why did /api/orders get slower this week?"
        disabled={disabled}
        autoComplete="off"
      />
      <button type="submit" disabled={disabled || !message.trim()}>
        {disabled ? "Investigating…" : "Investigate"}
      </button>
    </form>
  );
}
