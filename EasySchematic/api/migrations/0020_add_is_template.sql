-- Add is_template flag for "new file template" feature
ALTER TABLE schematics ADD COLUMN is_template INTEGER NOT NULL DEFAULT 0;
