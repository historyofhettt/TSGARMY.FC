ALTER TABLE achievements
  ADD COLUMN badge VARCHAR(128) NULL AFTER iconKey,
  ADD COLUMN tag VARCHAR(64) NULL AFTER badge,
  ADD COLUMN requirementType VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER category,
  ADD COLUMN requirementValue INT NULL AFTER requirementType,
  ADD COLUMN xpReward INT NOT NULL DEFAULT 0 AFTER requirementValue;

-- Add isActive to xp_card_milestones only if the table exists (it may not exist in fresh DBs).
-- On production, the table already exists and this column was already added.
SET @table_exists = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'xp_card_milestones'
);
SET @sql = IF(@table_exists > 0,
  'ALTER TABLE xp_card_milestones ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "Table xp_card_milestones does not exist yet, skipping isActive addition" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Same for achievement_card_rewards
SET @table_exists = (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'achievement_card_rewards'
);
SET @sql = IF(@table_exists > 0,
  'ALTER TABLE achievement_card_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "Table achievement_card_rewards does not exist yet, skipping isActive addition" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
