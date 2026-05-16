CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  device_type TEXT NOT NULL,
  label TEXT NOT NULL,
  manufacturer TEXT,
  model_number TEXT,
  color TEXT,
  image_url TEXT,
  search_terms TEXT,
  ports TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_templates_device_type ON templates(device_type);
