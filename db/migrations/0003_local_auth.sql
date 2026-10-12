-- Local username/password authentication support
ALTER TABLE users
  ADD COLUMN username VARCHAR(255) NULL,
  ADD COLUMN passwordHash VARCHAR(255) NULL,
  ADD COLUMN emailVerified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
  MODIFY COLUMN provider ENUM('google', 'discord', 'local') NOT NULL DEFAULT 'google';

CREATE UNIQUE INDEX users_username_idx ON users (username);

CREATE TABLE password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY password_resets_token_idx (token),
  KEY password_resets_email_idx (email)
);

CREATE TABLE refresh_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  userAgent TEXT NULL,
  UNIQUE KEY refresh_tokens_token_idx (token),
  KEY refresh_tokens_user_idx (userId)
);