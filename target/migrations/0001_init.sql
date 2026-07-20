-- Stand-in for a distributed tracing backend: every subrequest-ish
-- operation in a route handler records one row here via SpanRecorder.
CREATE TABLE spans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  route TEXT NOT NULL,
  span_name TEXT NOT NULL,
  start_ms REAL NOT NULL,
  duration_ms REAL NOT NULL,
  ts INTEGER NOT NULL
);

CREATE INDEX idx_spans_route_ts ON spans (route, ts);
CREATE INDEX idx_spans_request_id ON spans (request_id);
