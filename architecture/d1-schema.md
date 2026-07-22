# D1 schema

One physical database (`millisecond-target-db`), bound into both
Workers, six logical owners:

| Table | Owner | Written by | Read by |
|---|---|---|---|
| `spans` | target/ | `spanMiddleware` (`target/src/middleware/spans.ts`) — once per request (`span_name='total'`), once per instrumented sub-operation | `getRouteMetrics`, `getTraceSpans` |
| `mastra_*` | Mastra `D1Store` | Mastra internals (thread/message state), `tablePrefix: "mastra_"` | Mastra internals only |
| `watchdog_runs` | agent/watchdog | `checkRoute.ts`, every cron tick | audit/debug only, no reader yet |
| `watchdog_alerts` | agent/watchdog | `runWatchdogCheck.ts`'s `triggerInvestigation`, only when `shouldTrigger` | `GET /api/alerts`, `/api/alerts/:id` |
| `deploys` | agent/postDeploy | `POST /api/deploys` (`routes/deploys.ts`), once per SHA | `resolveBaseline.ts`, `GET /api/deploys`, `/api/deploys/:sha` |
| `deploy_checks` | agent/postDeploy | `PostDeployCheckWorkflow`, every route check regardless of outcome | `GET /api/deploys`, `/api/deploys/:sha` |

`spans` (`target/migrations/0001_init.sql`):

```sql
CREATE TABLE spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  route TEXT NOT NULL,
  span_name TEXT NOT NULL,
  start_ms REAL NOT NULL,
  duration_ms REAL NOT NULL,
  ts INTEGER NOT NULL
);
```

`span_name = 'total'` rows are the request-level record (`spanMiddleware`
wraps the whole handler). Other `span_name` values are sub-operations
timed inline in route handlers (`kv.get:cart`, `d1.query:inventory-check`,
`fetch:payment-provider`). `getRouteMetrics` filters on `span_name='total'`
only; sub-operation spans are for `getTraceSpans`'s waterfall, not P50/P99.

`watchdog_runs` / `watchdog_alerts` (`agent/migrations/0001_watchdog.sql`):
both indexed on the columns `checkRoute`'s cooldown lookup and
`listAlertsRoute` actually query (`route, checked_at` / `detected_at`).

`deploys` / `deploy_checks` (`agent/migrations/0002_post_deploy.sql`,
see `architecture/post-deploy-triggers.md`): `deploys` indexed on
`deployed_at` (the baseline resolver's window lookups), `deploy_checks`
on `sha` (both the rollup `GROUP BY` in `listDeploysRoute` and the
detail lookup in `getDeployRoute`).

Two migration directories, one physical database. `wrangler d1
migrations apply` runs separately per-package against the same
`database_id` — no shared migration tracking between them. Collisions
are avoided by table-name convention (`spans` vs `mastra_*` vs
`watchdog_*`), not by tooling.
