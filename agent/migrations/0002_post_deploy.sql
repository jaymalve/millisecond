-- One row per deploy the system was told about (via POST /api/deploys).
-- The baseline resolver turns a SHA into a time window by looking up
-- this deploy's deployed_at and the next row chronologically after it.
CREATE TABLE deploys (
  sha TEXT PRIMARY KEY,
  deployed_at INTEGER NOT NULL
);

CREATE INDEX idx_deploys_deployed_at ON deploys (deployed_at);

-- One row per (deploy, route) check. Unlike watchdog_alerts, every check
-- is recorded here — not just the ones that escalate — since "no
-- regression found" is itself a useful CI-visible result.
CREATE TABLE deploy_checks (
  id TEXT PRIMARY KEY,
  sha TEXT NOT NULL,
  route TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  regression_detected INTEGER NOT NULL,
  changepoint_label TEXT,
  baseline_sha TEXT,
  alert_id TEXT -- watchdog_alerts.id when escalated, else NULL
);

CREATE INDEX idx_deploy_checks_sha ON deploy_checks (sha);
