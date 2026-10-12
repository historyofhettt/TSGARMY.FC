-- Fan Spotlight — community creator recognition feature.
-- Admin-managed showcase of fan creative works (edits, art, videos, reels).
--
-- This migration extends the fan_spotlight table with additional optional fields
-- for the advanced editor. All new columns are nullable with defaults, so
-- existing records remain valid. No data is lost or reset.

CREATE TABLE IF NOT EXISTS fan_spotlight (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NULL,
  fanName VARCHAR(255) NULL,
  creatorProfileUrl VARCHAR(1024) NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NULL,
  description TEXT NULL,
  category VARCHAR(128) NULL,
  tags TEXT NULL,
  contentUrl VARCHAR(1024) NULL,
  youtubeVideoId VARCHAR(64) NULL,
  embedUrl VARCHAR(1024) NULL,
  thumbnailKey VARCHAR(512) NULL,
  thumbnailUrl VARCHAR(1024) NULL,
  mediaItemId BIGINT UNSIGNED NULL,
  additionalImageKeys TEXT NULL,
  buttonText VARCHAR(128) NULL,
  buttonUrl VARCHAR(1024) NULL,
  accentColor VARCHAR(16) NULL,
  cardStyle ENUM('grid', 'card', 'banner') NOT NULL DEFAULT 'card',
  isApproved BOOLEAN NOT NULL DEFAULT FALSE,
  isFeatured BOOLEAN NOT NULL DEFAULT FALSE,
  displayOrder INT NOT NULL DEFAULT 0,
  publishDate TIMESTAMP NULL,
  status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
  adminNotes TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX fan_spotlight_user_idx (userId),
  INDEX fan_spotlight_media_idx (mediaItemId),
  INDEX fan_spotlight_approved_idx (isApproved),
  INDEX fan_spotlight_featured_idx (isFeatured),
  INDEX fan_spotlight_status_idx (status),
  INDEX fan_spotlight_order_idx (displayOrder),
  INDEX fan_spotlight_publish_date_idx (publishDate)
);

-- Backward-compatible column additions for existing tables.
-- These are safe to run even if the columns already exist (MySQL allows
-- multiple ALTER TABLE statements but we guard with IF NOT EXISTS where possible).

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'fanName');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN fanName VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'creatorProfileUrl');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN creatorProfileUrl VARCHAR(1024) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'subtitle');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN subtitle VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'tags');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN tags TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'embedUrl');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN embedUrl VARCHAR(1024) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'additionalImageKeys');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN additionalImageKeys TEXT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'buttonText');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN buttonText VARCHAR(128) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'buttonUrl');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN buttonUrl VARCHAR(1024) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'accentColor');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN accentColor VARCHAR(16) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'cardStyle');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN cardStyle ENUM(\'grid\', \'card\', \'banner\') NOT NULL DEFAULT \'card\'',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'publishDate');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD COLUMN publishDate TIMESTAMP NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_check = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'fan_spotlight' AND COLUMN_NAME = 'publish_date_idx');
SET @sql = IF(@col_check = 0,
  'ALTER TABLE fan_spotlight ADD INDEX fan_spotlight_publish_date_idx (publishDate)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing rows: set status to 'approved' where isApproved is true
UPDATE fan_spotlight SET status = 'approved' WHERE isApproved = TRUE AND (status IS NULL OR status = '');
-- Set publishDate for already-approved entries
UPDATE fan_spotlight SET publishDate = createdAt WHERE isApproved = TRUE AND publishDate IS NULL;
