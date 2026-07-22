-- Every cheap regression check the scheduled watchdog runs, regardless
-- of whether it found anything — mostly for debugging the watchdog
-- itself (e.g. confirming it's actually running, seeing the false-alarm
-- rate over time).
CREATE TABLE watchdog_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route TEXT NOT NULL,
  checked_at INTEGER NOT NULL,
  regression_detected INTEGER NOT NULL,
  changepoint_label TEXT
);

CREATE INDEX idx_watchdog_runs_route_checked ON watchdog_runs (route, checked_at);

-- Only the triggered full investigations — what the UI's "Alerts"
-- section actually reads.
CREATE TABLE watchdog_alerts (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  detected_at INTEGER NOT NULL,
  report_text TEXT NOT NULL,
  transcript_json TEXT NOT NULL
);

CREATE INDEX idx_watchdog_alerts_detected_at ON watchdog_alerts (detected_at);
