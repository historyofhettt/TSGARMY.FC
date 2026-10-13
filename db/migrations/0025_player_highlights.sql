-- Player Highlights / Clutch Moments
-- Adds userId link from players to platform users, plus highlight tables.

ALTER TABLE players ADD COLUMN userId BIGINT UNSIGNED NULL AFTER teamId;

CREATE INDEX players_user_idx ON players(userId);

CREATE TABLE player_highlights (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  playerId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  videoType ENUM('youtube', 'upload') NOT NULL,
  youtubeVideoId VARCHAR(64) NULL,
  videoKey VARCHAR(512) NULL,
  thumbnailKey VARCHAR(512) NULL,
  views INT NOT NULL DEFAULT 0,
  likes INT NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX player_highlights_player_idx (playerId),
  INDEX player_highlights_user_idx (userId),
  INDEX player_highlights_active_idx (isActive),
  INDEX player_highlights_created_idx (createdAt)
);

CREATE TABLE highlight_comments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  highlightId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  parentId BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  hidden BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX highlight_comments_highlight_idx (highlightId),
  INDEX highlight_comments_user_idx (userId),
  INDEX highlight_comments_parent_idx (parentId)
);

CREATE TABLE highlight_comment_reactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  commentId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY highlight_reaction_comment_user_idx (commentId, userId),
  INDEX highlight_reaction_comment_idx (commentId)
);

CREATE TABLE highlight_likes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  highlightId BIGINT UNSIGNED NOT NULL,
  userId BIGINT UNSIGNED NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY highlight_likes_uniq_idx (highlightId, userId),
  INDEX highlight_likes_highlight_idx (highlightId),
  INDEX highlight_likes_user_idx (userId)
);
