import type { WireEvent } from "./wireEvents";

const API_URL = import.meta.env.VITE_AGENT_API_URL;

/** POSTs a message to the agent and calls onEvent for each NDJSON WireEvent as it streams in. */
export async function investigate(
  message: string,
  onEvent: (event: WireEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/investigate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`Investigation failed (${res.status}): ${body}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) onEvent(JSON.parse(line) as WireEvent);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  if (buffer.trim()) onEvent(JSON.parse(buffer) as WireEvent);
}
