CREATE TABLE IF NOT EXISTS support_emails (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  headers TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'new',
  reply_text TEXT,
  replied_at TEXT
);

CREATE INDEX idx_support_emails_status ON support_emails(status);
CREATE INDEX idx_support_emails_received ON support_emails(received_at);
