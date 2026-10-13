ALTER TABLE achievements
  ADD COLUMN badge VARCHAR(128) NULL AFTER iconKey,
  ADD COLUMN tag VARCHAR(64) NULL AFTER badge,
  ADD COLUMN requirementType VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER category,
  ADD COLUMN requirementValue INT NULL AFTER requirementType,
  ADD COLUMN xpReward INT NOT NULL DEFAULT 0 AFTER requirementValue;

ALTER TABLE xp_card_milestones ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId;
ALTER TABLE achievement_card_rewards ADD COLUMN isActive TINYINT(1) NOT NULL DEFAULT 1 AFTER cardId;
