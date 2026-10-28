CREATE TABLE IF NOT EXISTS history (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  thumbnail    TEXT,
  format_id    TEXT NOT NULL DEFAULT '',
  quality      TEXT NOT NULL DEFAULT '',
  ext          TEXT NOT NULL DEFAULT '',
  file_size    TEXT NOT NULL DEFAULT '',
  file_path    TEXT NOT NULL,
  completed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS history_completed_at ON history (completed_at DESC);
