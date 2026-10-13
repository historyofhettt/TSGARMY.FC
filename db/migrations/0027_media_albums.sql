-- Media Albums / Folder System
-- Adds media_albums (folders), media_album_links (labeled links per album),
-- and links existing media_items to albums via albumId.

CREATE TABLE media_albums (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  eventDate TIMESTAMP NULL,
  category VARCHAR(128) NULL,
  teamId BIGINT UNSIGNED NULL,
  tournamentId BIGINT UNSIGNED NULL,
  tags TEXT NULL,
  coverKey VARCHAR(512) NULL,
  status ENUM('published', 'draft') NOT NULL DEFAULT 'draft',
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX media_albums_status_idx (status),
  INDEX media_albums_team_idx (teamId),
  INDEX media_albums_tournament_idx (tournamentId),
  INDEX media_albums_order_idx (displayOrder)
);

CREATE TABLE media_album_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  albumId BIGINT UNSIGNED NOT NULL,
  label VARCHAR(128) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  displayOrder INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX media_album_links_album_idx (albumId)
);

-- Link existing media items to albums (nullable; items may stay ungrouped).
ALTER TABLE media_items ADD COLUMN albumId BIGINT UNSIGNED NULL AFTER tournamentId;
CREATE INDEX media_items_album_idx ON media_items(albumId);
