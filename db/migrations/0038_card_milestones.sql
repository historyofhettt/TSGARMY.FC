-- Migration 0038: Create card milestone tables that were missing from all prior migrations
-- The schema.ts references streak_card_rewards, xp_card_milestones, achievement_card_rewards,
-- and milestone_rewards tables, but no migration ever created them. Migration 0017 attempted
-- ALTER TABLE on xp_card_milestones and achievement_card_rewards assuming they already existed.
-- This migration creates all four tables for fresh databases.
-- Uses CREATE TABLE IF NOT EXISTS so it is safe on production where tables may already exist.

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
