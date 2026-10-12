-- Advanced Comments, Live Links & Notifications system.
-- Adds tables for:
--   1. live_links   — stream platform URLs managed by players/owners/staff
--   2. comment_reports — report flags for comments with moderation status
--   3. notification_rules — auto-notification trigger rules for live streams
--   4. notification_rule_logs — audit trail of rule firings
--
-- All new tables use CREATE TABLE IF NOT EXISTS and are self-contained.
-- No existing tables are modified or data is lost.

-- ------------------------------------------------------------------
-- Live Links
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  playerId BIGINT UNSIGNED NULL,
  platform ENUM('youtube', 'instagram', 'twitch', 'discord', 'other') NOT NULL DEFAULT 'youtube',
  liveUrl VARCHAR(1024) NOT NULL,
  isLive BOOLEAN NOT NULL DEFAULT FALSE,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  viewerCount INT NOT NULL DEFAULT 0,
  thumbnailKey VARCHAR(512) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX live_links_user_idx (userId),
  INDEX live_links_player_idx (playerId),
  INDEX live_links_platform_idx (platform),
  INDEX live_links_is_live_idx (isLive),
  UNIQUE KEY live_links_user_platform_idx (userId, platform),
  FOREIGN KEY live_links_user_fk (userId) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- Comment Reports
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comment_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  commentId BIGINT UNSIGNED NOT NULL,
  reporterId BIGINT UNSIGNED NOT NULL,
  reason ENUM('spam', 'harassment', 'inappropriate', 'offtopic', 'other') NOT NULL DEFAULT 'other',
  customReason TEXT NULL,
  status ENUM('pending', 'resolved', 'dismissed') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX comment_reports_comment_idx (commentId),
  INDEX comment_reports_reporter_idx (reporterId),
  INDEX comment_reports_status_idx (status),
  UNIQUE KEY comment_reports_uniq_idx (commentId, reporterId),
  FOREIGN KEY comment_reports_comment_fk (commentId) REFERENCES comments(id) ON DELETE CASCADE,
  FOREIGN KEY comment_reports_reporter_fk (reporterId) REFERENCES users(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------------
-- Notification Rules (auto-trigger when players go live)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  notificationTypeId INT UNSIGNED NOT NULL,
  platform ENUM('youtube', 'instagram', 'twitch', 'any') NOT NULL DEFAULT 'any',
  triggerRole ENUM('player', 'co-owner', 'owner', 'staff', 'any') NOT NULL DEFAULT 'any',
  targetType ENUM('everyone', 'role', 'users', 'followers') NOT NULL DEFAULT 'everyone',
  targetRole VARCHAR(64) NULL,
  targetUserIds TEXT NULL,
  cooldownMinutes INT NOT NULL DEFAULT 30,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX notification_rules_type_idx (notificationTypeId),
  INDEX notification_rules_platform_idx (platform),
  INDEX notification_rules_active_idx (isActive),
  FOREIGN KEY notification_rules_type_fk (notificationTypeId) REFERENCES notification_types(id) ON DELETE RESTRICT
);

-- ------------------------------------------------------------------
-- Notification Rule Logs (audit trail)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_rule_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ruleId INT UNSIGNED NOT NULL,
  liveLinkId BIGINT UNSIGNED NOT NULL,
  triggeredAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deliveredCount INT NOT NULL DEFAULT 0,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  skipReason TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX notification_rule_logs_rule_idx (ruleId),
  INDEX notification_rule_logs_live_link_idx (liveLinkId),
  INDEX notification_rule_logs_created_idx (createdAt),
  FOREIGN KEY notification_rule_logs_rule_fk (ruleId) REFERENCES notification_rules(id) ON DELETE CASCADE,
  FOREIGN KEY notification_rule_logs_live_link_fk (liveLinkId) REFERENCES live_links(id) ON DELETE CASCADE
);
