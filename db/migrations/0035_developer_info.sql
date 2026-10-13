-- Developer / Website Credits table
-- Stores editable developer information shown on the home page footer
CREATE TABLE IF NOT EXISTS developer_info (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  developerName VARCHAR(255) NOT NULL DEFAULT 'TSG Developer',
  developerPhotoKey VARCHAR(512) NULL,
  bio TEXT NULL,
  instagramUrl VARCHAR(512) NULL,
  youtubeUrl VARCHAR(512) NULL,
  discordUrl VARCHAR(512) NULL,
  portfolioUrl VARCHAR(512) NULL,
  showOnHomePage TINYINT(1) DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

-- Seed a single default row (empty developer info, hidden until configured)
INSERT INTO developer_info (developerName, bio, showOnHomePage)
  SELECT 'TSG Developer', NULL, FALSE
  WHERE NOT EXISTS (SELECT 1 FROM developer_info);
