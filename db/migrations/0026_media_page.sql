-- TSG Media Page
-- Adds media_items (gallery entries) and media_page_config (feature toggles).

CREATE TABLE media_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  type ENUM('photo', 'video', 'youtube', 'drive') NOT NULL DEFAULT 'photo',
  fileKey VARCHAR(512) NULL,
  thumbnailKey VARCHAR(512) NULL,
  youtubeVideoId VARCHAR(64) NULL,
  driveUrl VARCHAR(1024) NULL,
  category VARCHAR(128) NULL,
  teamId BIGINT UNSIGNED NULL,
  tournamentId BIGINT UNSIGNED NULL,
  tags TEXT NULL,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  displayOrder INT NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  uploadDate TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX media_items_active_idx (isActive),
  INDEX media_items_featured_idx (featured),
  INDEX media_items_team_idx (teamId),
  INDEX media_items_tournament_idx (tournamentId),
  INDEX media_items_order_idx (displayOrder)
);

CREATE TABLE media_page_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  config TEXT NOT NULL,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
