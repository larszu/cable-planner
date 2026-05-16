-- Append-only audit log of moderator actions on submissions.
-- Never UPDATE or DELETE rows in this table from app code — it's the historical record.
CREATE TABLE IF NOT EXISTS mod_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moderator_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,                -- 'approve' | 'reject' | 'defer'
  submission_id TEXT REFERENCES submissions(id),
  template_id TEXT REFERENCES templates(id),
  before_data TEXT,                    -- JSON snapshot of prior template state (update-approves only)
  after_data TEXT,                     -- JSON snapshot of approved/applied template data
  submission_data_override TEXT,       -- JSON of moderator's edits to submission data before approve, if any
  note TEXT,                           -- reviewer note (reject/defer)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON mod_actions(moderator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mod_actions_submission ON mod_actions(submission_id);
CREATE INDEX IF NOT EXISTS idx_mod_actions_created ON mod_actions(created_at DESC);
