-- Comments v2: generic comments attachable to any content
CREATE TABLE IF NOT EXISTS content_comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  refTable VARCHAR(64) NOT NULL,
  refId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  parentId BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  pinned TINYINT(1) DEFAULT 0 NOT NULL,
  hidden TINYINT(1) DEFAULT 0 NOT NULL,
  likes INT DEFAULT 0 NOT NULL,
  likedByUserIds TEXT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX content_comments_ref_idx (refTable, refId, hidden),
  INDEX content_comments_user_idx (userId),
  INDEX content_comments_parent_idx (parentId),
  INDEX content_comments_pinned_idx (refTable, refId, pinned)
);

-- Comment reports for content comments
CREATE TABLE IF NOT EXISTS content_comment_reports (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  commentId BIGINT UNSIGNED NOT NULL,
  reporterId BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(64) NOT NULL,
  customReason TEXT NULL,
  status ENUM('pending', 'resolved', 'dismissed') DEFAULT 'pending' NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX content_comment_reports_comment_idx (commentId),
  INDEX content_comment_reports_reporter_idx (reporterId),
  INDEX content_comment_reports_status_idx (status)
);

-- Sponsored Ads: campaign management
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  advertiser VARCHAR(255) NULL,
  description TEXT NULL,
  status ENUM('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled') DEFAULT 'draft' NOT NULL,
  placement ENUM('sidebar', 'header', 'between_media_items', 'feed_top', 'feed_bottom') DEFAULT 'sidebar' NOT NULL,
  targetPages TEXT NULL,
  budget INT DEFAULT 0 NOT NULL,
  spent INT DEFAULT 0 NOT NULL,
  impressions INT DEFAULT 0 NOT NULL,
  clicks INT DEFAULT 0 NOT NULL,
  dismissals INT DEFAULT 0 NOT NULL,
  startDate TIMESTAMP NULL,
  endDate TIMESTAMP NULL,
  frequencyCap INT DEFAULT 3 NOT NULL,
  isActive TINYINT(1) DEFAULT 1 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX ad_campaigns_status_idx (status),
  INDEX ad_campaigns_active_idx (isActive),
  INDEX ad_campaigns_dates_idx (startDate, endDate)
);

-- Ad creatives linked to campaigns
CREATE TABLE IF NOT EXISTS ad_creatives (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaignId BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  mediaKey VARCHAR(512) NULL,
  mediaType ENUM('image', 'video') DEFAULT 'image' NOT NULL,
  destinationUrl VARCHAR(1024) NOT NULL,
  buttonText VARCHAR(128) NULL,
  linkLabel VARCHAR(128) NULL,
  bodyText TEXT NULL,
  isAdminOnly TINYINT(1) DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX ad_creatives_campaign_idx (campaignId)
);

-- Ad metrics log
CREATE TABLE IF NOT EXISTS ad_metrics (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  campaignId BIGINT UNSIGNED NOT NULL,
  creativeId BIGINT UNSIGNED NULL,
  eventType ENUM('impression', 'click', 'dismissal') NOT NULL,
  userId BIGINT UNSIGNED NULL,
  sessionId VARCHAR(255) NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX ad_metrics_campaign_idx (campaignId, eventType),
  INDEX ad_metrics_user_idx (userId),
  INDEX ad_metrics_created_idx (createdAt)
);
