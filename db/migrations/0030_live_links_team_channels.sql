-- Migration 0030: Extend live_links and notification_rules for multi-role team channels.
-- Adds: teamId, ownershipType, isManuallyLive to live_links
-- Adds: ownershipType, targetTeamId, titleTemplate, messageTemplate, buttonText,
--       linkLabel, emoji to notification_rules
-- All new columns are nullable or have defaults — no existing data is affected.

-- ------------------------------------------------------------------
-- live_links extensions
-- ------------------------------------------------------------------

ALTER TABLE live_links
  ADD COLUMN teamId BIGINT UNSIGNED NULL,
  ADD COLUMN ownershipType ENUM('personal', 'team') NOT NULL DEFAULT 'personal',
  ADD COLUMN isManuallyLive BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE live_links
  ADD INDEX live_links_team_idx (teamId),
  ADD INDEX live_links_ownership_idx (ownershipType);

-- ------------------------------------------------------------------
-- notification_rules extensions
-- ------------------------------------------------------------------

ALTER TABLE notification_rules
  ADD COLUMN ownershipType ENUM('personal', 'team', 'any') NOT NULL DEFAULT 'any',
  ADD COLUMN targetTeamId BIGINT UNSIGNED NULL,
  ADD COLUMN titleTemplate VARCHAR(255) NULL,
  ADD COLUMN messageTemplate TEXT NULL,
  ADD COLUMN buttonText VARCHAR(128) NULL,
  ADD COLUMN linkLabel VARCHAR(128) NULL,
  ADD COLUMN emoji VARCHAR(16) NULL;

ALTER TABLE notification_rules
  ADD INDEX notification_rules_ownership_idx (ownershipType),
  ADD INDEX notification_rules_team_idx (targetTeamId);
