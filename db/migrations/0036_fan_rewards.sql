-- Fan Rewards & Redemption system
-- Rewards that users can redeem using XP points, with redemption tracking

CREATE TABLE IF NOT EXISTS fan_rewards (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(128) NOT NULL,
  description TEXT NULL,
  photoKey VARCHAR(512) NULL,
  xpCost INT NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  claimedCount INT NOT NULL DEFAULT 0,
  isActive BOOLEAN DEFAULT 1 NOT NULL,
  eligibilityJson TEXT NULL,
  details TEXT NULL,
  createdById BIGINT UNSIGNED NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX fan_rewards_category_idx (category),
  INDEX fan_rewards_active_idx (isActive),
  INDEX fan_rewards_xp_idx (xpCost)
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rewardId INT UNSIGNED NOT NULL,
  userId INT UNSIGNED NOT NULL,
  instagramUsername VARCHAR(255) NULL,
  discordUsername VARCHAR(255) NULL,
  xpSpent INT NOT NULL,
  status ENUM('pending', 'approved', 'processing', 'completed', 'rejected') DEFAULT 'pending' NOT NULL,
  adminNotes TEXT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX reward_redemptions_reward_idx (rewardId),
  INDEX reward_redemptions_user_idx (userId),
  INDEX reward_redemptions_status_idx (status),
  INDEX reward_redemptions_created_idx (createdAt)
);

CREATE TABLE IF NOT EXISTS reward_redemption_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  redemptionId INT UNSIGNED NOT NULL,
  status ENUM('pending', 'approved', 'processing', 'completed', 'rejected') NOT NULL,
  changedById BIGINT UNSIGNED NULL,
  adminNotes TEXT NULL,
  changedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX reward_redemption_history_redemption_idx (redemptionId),
  INDEX reward_redemption_history_changed_idx (changedAt)
);
