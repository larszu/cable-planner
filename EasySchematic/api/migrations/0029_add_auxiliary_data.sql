-- Aux data storage for published templates.
-- auxiliary_data holds a JSON array of rows: [{"text": "...", "position": "header"|"footer"}].
-- Each row owns its slot, so there's no separate aux_position column. Matches the
-- existing `ports` / `slots` / `search_terms` pattern of a single JSON text column.
ALTER TABLE templates ADD COLUMN auxiliary_data TEXT;
