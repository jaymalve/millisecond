# Architecture

Technical reference for how millisecond.dev works internally. Assumes
familiarity with the codebase; see the root [`CLAUDE.md`](../CLAUDE.md)
for engineering principles and package-level `CLAUDE.md` files for
per-package conventions.

- [two-worker-split.md](two-worker-split.md) — why `target/` and
  `agent/` are separate Workers, how they share one D1 database, and the
  `cloudflare:workers` env-access pattern this forces.
- [d1-schema.md](d1-schema.md) — all four tables across the shared
  database, who owns each, who reads/writes it.
- [tool-agent-design.md](tool-agent-design.md) — the tool registry,
  model/provider setup, and the system prompt's non-obvious constraints.
- [agent-skills.md](agent-skills.md) — why domain-specific investigation
  playbooks (tool order, evidence bar) live in a `loadSkill`-fetched
  registry instead of a single growing system prompt.
- [streaming-pipeline.md](streaming-pipeline.md) — the three narrowing
  steps from Mastra's raw event stream to rendered React state.
- [watchdog-regression-detection.md](watchdog-regression-detection.md) —
  the cron-triggered, LLM-free cheap tier that decides when the
  expensive tier (a full agent investigation) is worth running.
- [regression-score-interpretation.md](regression-score-interpretation.md) —
  what the changepoint score actually measures (an effect size, not a
  p-value) and why the alert thresholds sit where they do.
- [post-deploy-triggers.md](post-deploy-triggers.md) — a CI-triggered
  regression check tied to a specific deploy SHA, reusing the watchdog's
  two-tier detection.
- [github-action.md](github-action.md) — the composite GitHub Action
  (`action/`) other repos use to call `POST /api/deploys`; why composite
  over a JS action, and its fire-and-confirm (not fail-on-regression)
  boundary.
- [debug.md](debug.md) — three bugs found only by deploying and
  exercising the real system.
