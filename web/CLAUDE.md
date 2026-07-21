# web/

React UI for millisecond.dev — a Cursor-style agentic chat transcript.
Talks to `agent/`'s `POST /api/investigate` over HTTP (NDJSON stream),
nothing else — no direct Cloudflare/OpenAI/GitHub access from the browser.

## Structure

- `src/App.tsx` — page composition only.
- `src/wireEvents.ts` — the `WireEvent` type the backend streams. Kept in
  sync by hand with `agent/src/lib/wireEvents.ts` — no shared package
  exists between the two yet.
- `src/state.ts` — a single reducer building a `TranscriptItem[]` (
  `reasoning` / `tool` / `answer` blocks) from incoming `WireEvent`s. All
  state transitions happen here, driven by explicit actions dispatched
  from event handlers — not from `useEffect`. Consecutive deltas with the
  same `id` extend the last block; a new `id` starts a new one.
- `src/api.ts` — one function, `investigate(message, onEvent)`. Owns the
  `fetch` + NDJSON line-splitting loop. Nothing in here touches React.
- `src/components/*.tsx` — one component per file, presentational only.
  `Transcript.tsx` maps `TranscriptItem`s to `ReasoningBlock` / `ToolCallCard`
  / `AnswerBlock`. `Skeleton.tsx` is the one reusable shimmer primitive.
  `Sidebar.tsx` lists past investigations.
- `src/lib/history.ts` — investigation history, persisted to
  `localStorage` (no backend/auth, so it's per-device). Pure functions
  only; `App.tsx` owns the actual `history`/`selectedId` React state.

## Conventions specific to this package

- State changes belong in the event handler that caused them (form
  submit → dispatch `start`; a stream event arrives → dispatch `event`).
  If you find yourself writing a `useEffect` that watches state to
  trigger more state, that's a sign the logic belongs in the handler or
  reducer instead.
- `ToolCallCard`'s expand/collapse is local `useState` in the component,
  not global state — it's pure presentation, not investigation state.
- `App.tsx`'s `handleSubmit` calls `investigationReducer` directly (in
  addition to `dispatch`) to capture the finished transcript for
  persisting to history. This reuses the reducer as a plain pure
  function rather than duplicating its event-handling logic — don't
  "fix" this by writing a second copy of the switch statement.
- Aesthetic: dark background, thin 1px borders (no shadows), 6-8px
  radius, a single restrained accent color, system font stack for UI text
  and a monospace stack for tool calls/reasoning/answers. Keep the
  spacing scale tight and consistent — this is a developer tool, not a
  marketing page.
