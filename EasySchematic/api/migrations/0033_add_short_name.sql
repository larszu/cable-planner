ALTER TABLE templates ADD COLUMN short_name TEXT;
UPDATE templates
   SET short_name = model_number
 WHERE short_name IS NULL
   AND model_number IS NOT NULL
   AND model_number != label;
