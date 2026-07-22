# Streaming pipeline

```
agent.stream() → stream.fullStream (Mastra ChunkType)
  → toWireEvent()            agent/src/lib/wireEvents.ts   → WireEvent
  → toNdjsonLines()                                        → NDJSON HTTP body
  → investigate()            web/src/api.ts                → parsed WireEvent
  → investigationReducer()   web/src/state.ts               → TranscriptItem[]
  → React render
```

Three narrowing steps, each deliberate:

1. **`ChunkType` → `WireEvent`.** Mastra's `ChunkType` union has ~25
   variants (`step-start`, `tool-call-delta`, `object-result`,
   background-task events, etc.). `WireEvent` keeps six: `tool-call`,
   `tool-result`, `reasoning-delta`, `text-delta`, `error`, `finish`.
   Everything else is dropped in `toWireEvent`'s `default: return null`.
   The frontend never needs Mastra's internal vocabulary.
2. **`WireEvent` stream → NDJSON.** One JSON object per line, streamed as
   the HTTP response body (`content-type: application/x-ndjson`). Chosen
   over SSE for simplicity — no `event:`/`data:` framing, `api.ts` just
   splits on `\n`.
3. **`WireEvent[]` → `TranscriptItem[]`.** `investigationReducer`
   collapses consecutive `reasoning-delta`/`text-delta` events sharing an
   `id` into one growing string (`appendToTextBlock`) instead of
   rendering hundreds of tiny fragments as separate blocks. `tool-call`
   opens a block; the matching `tool-result` (matched on `toolCallId`)
   closes it.

`agent/src/lib/transcript.ts`'s `TranscriptBuilder` is the same merge
logic as `investigationReducer`, duplicated server-side for the watchdog
(`runWatchdogCheck.ts`), which has no browser to run a React reducer in.
Not shared as a package between `agent/` and `web/` — two independent
copies, kept in sync by hand. Both packages' `CLAUDE.md` flag this.
