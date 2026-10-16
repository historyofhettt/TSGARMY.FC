-- Migration 0042: Add missing updatedAt column to card milestone tables
-- The xp_card_milestones and streak_card_rewards tables were created by earlier
-- migrations (or production setup) without the updatedAt column that schema.ts
-- expects. Migrations 0038/0039 used CREATE TABLE IF NOT EXISTS, which would not
-- add columns to an already-existing table.
-- This migration adds updatedAt to both tables if missing, using safe
-- IF NOT EXISTS checks via information_schema, matching the idempotent pattern
-- established by migrations 0017 and 0039.

-- Add updatedAt to xp_card_milestones if it doesn't exist
SET @xp_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'xp_card_milestones'
    AND column_name = 'updatedAt'
);
SET @xp_sql = IF(@xp_col_exists = 0,
  'ALTER TABLE xp_card_milestones ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT "updatedAt already exists on xp_card_milestones, skipping" AS info'
);
PREPARE stmt FROM @xp_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updatedAt to streak_card_rewards if it doesn't exist
SET @streak_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'streak_card_rewards'
    AND column_name = 'updatedAt'
);
SET @streak_sql = IF(@streak_col_exists = 0,
  'ALTER TABLE streak_card_rewards ADD COLUMN updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
  'SELECT "updatedAt already exists on streak_card_rewards, skipping" AS info'
);
PREPARE stmt FROM @streak_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add isActive to achievement_card_rewards if it doesn't exist
-- (migration 0039 adds this, but if the table pre-existed it may be missing)
SET @acr_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'achievement_card_rewards'
    AND column_name = 'isActive'
);
SET @acr_sql = IF(@acr_col_exists = 0,
  'ALTER TABLE achievement_card_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "isActive already exists on achievement_card_rewards, skipping" AS info'
);
PREPARE stmt FROM @acr_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add isActive to milestone_rewards if it doesn't exist
SET @mr_col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'milestone_rewards'
    AND column_name = 'isActive'
);
SET @mr_sql = IF(@mr_col_exists = 0,
  'ALTER TABLE milestone_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "isActive already exists on milestone_rewards, skipping" AS info'
);
PREPARE stmt FROM @mr_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
