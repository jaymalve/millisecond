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
- [tool-agent-design.md](tool-agent-design.md) — the seven-tool registry,
  model/provider setup, and the system prompt's non-obvious constraints.
- [streaming-pipeline.md](streaming-pipeline.md) — the three narrowing
  steps from Mastra's raw event stream to rendered React state.
- [watchdog-regression-detection.md](watchdog-regression-detection.md) —
  the cron-triggered, LLM-free cheap tier that decides when the
  expensive tier (a full agent investigation) is worth running.
- [gotchas.md](gotchas.md) — three bugs found only by deploying and
  exercising the real system.
