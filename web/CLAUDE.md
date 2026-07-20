# web/

React UI for millisecond.dev. Talks to `agent/`'s `/api/investigate` over
HTTP, nothing else — no direct Cloudflare/OpenAI/GitHub access from the
browser.

## Structure

- `src/App.tsx` — page composition only.
- `src/state.ts` — a single reducer for investigation state (`idle` /
  `streaming` / `done` / `error` + accumulated steps). All state
  transitions happen here, driven by explicit actions dispatched from
  event handlers — not from `useEffect`.
- `src/api.ts` — one function, `investigate(message, onChunk)`. Owns the
  `fetch` + stream-reading loop. Nothing in here touches React.
- `src/components/*.tsx` — one component per file, presentational only.
  `Skeleton.tsx` is the one reusable primitive; everything else composes it.

## Conventions specific to this package

- State changes belong in the event handler that caused them (form
  submit → dispatch `start`; stream chunk arrives → dispatch
  `append-step`). If you find yourself writing a `useEffect` that watches
  state to trigger more state, that's a sign the logic belongs in the
  handler or reducer instead.
- Skeleton loaders match the shape of what's coming: a step skeleton looks
  like a step (icon + one line), not a generic gray box.
- Aesthetic: dark background, thin 1px borders (no shadows), 6-8px
  radius, a single restrained accent color, system font stack for UI text
  and a monospace stack for tool calls/output. Keep the spacing scale
  tight and consistent — this is a developer tool, not a marketing page.
