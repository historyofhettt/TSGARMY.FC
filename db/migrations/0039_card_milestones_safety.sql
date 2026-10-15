-- Migration 0039: Safety net for card milestone tables
-- Ensures all four card milestone/reward tables exist with correct schema,
-- including the isActive column, for any database state:
--   - Fresh DBs where migration 0017 was skipped (tables didn't exist)
--   - Production DBs where migration 0038 was never applied
--   - Any intermediate state where only some tables were created
-- This migration is fully idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS `streak_card_rewards` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `streakDays` INT NOT NULL,
  `cardId` BIGINT UNSIGNED NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `streak_card_rewards_card_idx` (`cardId`),
  UNIQUE KEY `streak_card_rewards_streak_idx` (`streakDays`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `xp_card_milestones` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `xpThreshold` INT NOT NULL,
  `cardId` BIGINT UNSIGNED NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `xp_card_milestones_card_idx` (`cardId`),
  UNIQUE KEY `xp_card_milestones_threshold_idx` (`xpThreshold`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `achievement_card_rewards` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `achievementId` BIGINT UNSIGNED NOT NULL,
  `cardId` BIGINT UNSIGNED NOT NULL,
  `isActive` TINYINT(1) NOT NULL DEFAULT 1,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `acr_achievement_idx` (`achievementId`),
  INDEX `acr_card_idx` (`cardId`),
  UNIQUE KEY `acr_achievement_unique_idx` (`achievementId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `milestone_rewards` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` BIGINT UNSIGNED NOT NULL,
  `rewardType` VARCHAR(32) NOT NULL,
  `rewardId` INT NOT NULL,
  `cardId` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `milestone_rewards_user_idx` (`userId`),
  UNIQUE KEY `milestone_rewards_user_type_id_idx` (`userId`, `rewardType`, `rewardId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure isActive column exists on xp_card_milestones (added by 0017 in production,
-- or by the CREATE TABLE above on fresh DBs). This is a no-op if already present.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'xp_card_milestones'
    AND column_name = 'isActive'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE xp_card_milestones ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "isActive already exists on xp_card_milestones, skipping" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure isActive column exists on achievement_card_rewards
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'achievement_card_rewards'
    AND column_name = 'isActive'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE achievement_card_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId',
  'SELECT "isActive already exists on achievement_card_rewards, skipping" AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
