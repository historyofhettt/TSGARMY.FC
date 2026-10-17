-- Migration 0043: Add footerLogoKey to org_settings table
-- Allows the organization to set a separate logo for the footer, distinct from the header logo.
-- Idempotent: only adds the column if it doesn't already exist (information_schema check).

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'org_settings'
    AND column_name = 'footerLogoKey'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE org_settings ADD COLUMN footerLogoKey VARCHAR(512)',
  'SELECT "footerLogoKey already exists on org_settings, skipping" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
