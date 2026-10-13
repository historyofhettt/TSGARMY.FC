-- Add displayPlatform column to live_links table
-- Stores the original platform name (kick, facebook, etc.) even when mapped to 'other' in DB enum
ALTER TABLE live_links ADD COLUMN IF NOT EXISTS displayPlatform VARCHAR(64) NULL;

-- Expand platform enum on notification_rules to support kick, facebook, other
ALTER TABLE notification_rules
  MODIFY COLUMN platform ENUM('youtube', 'instagram', 'twitch', 'kick', 'facebook', 'other', 'any') NOT NULL DEFAULT 'any';

-- Add 'team' to targetType enum to support team-targeted notifications
ALTER TABLE notification_rules
  MODIFY COLUMN targetType ENUM('everyone', 'role', 'users', 'followers', 'team') NOT NULL DEFAULT 'everyone';
