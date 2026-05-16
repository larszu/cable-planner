-- Track who submitted each template (via approved submission)
ALTER TABLE templates ADD COLUMN submitted_by TEXT REFERENCES users(id);

-- Track who last edited each template (via approved update submission)
ALTER TABLE templates ADD COLUMN last_edited_by TEXT REFERENCES users(id);
