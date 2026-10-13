ALTER TABLE players MODIFY COLUMN teamId BIGINT UNSIGNED NULL;

CREATE UNIQUE INDEX players_ign_idx ON players (ign);

ALTER TABLE tournaments MODIFY COLUMN teamId BIGINT UNSIGNED NULL;

ALTER TABLE tournaments ADD COLUMN mvpPlayerId BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_tournaments_mvp_player FOREIGN KEY (mvpPlayerId) REFERENCES players(id) ON DELETE SET NULL;

CREATE TABLE achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  iconKey VARCHAR(512) NULL,
  category VARCHAR(128) NULL,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE player_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  playerId BIGINT UNSIGNED NOT NULL,
  achievementId BIGINT UNSIGNED NOT NULL,
  earnedAt TIMESTAMP NOT NULL,
  tournamentId BIGINT UNSIGNED NULL,
  matchId BIGINT UNSIGNED NULL,
  metadata TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX pa_player_idx (playerId),
  INDEX pa_achievement_idx (achievementId),
  INDEX pa_tournament_idx (tournamentId),
  INDEX pa_match_idx (matchId),
  UNIQUE KEY pa_player_achievement_unique (playerId, achievementId, tournamentId, matchId),
  CONSTRAINT fk_pa_player FOREIGN KEY (playerId) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_achievement FOREIGN KEY (achievementId) REFERENCES achievements(id) ON DELETE CASCADE,
  CONSTRAINT fk_pa_tournament FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE SET NULL,
  CONSTRAINT fk_pa_match FOREIGN KEY (matchId) REFERENCES matches(id) ON DELETE SET NULL
);

CREATE TABLE team_achievements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teamId BIGINT UNSIGNED NOT NULL,
  achievementId BIGINT UNSIGNED NOT NULL,
  earnedAt TIMESTAMP NOT NULL,
  tournamentId BIGINT UNSIGNED NULL,
  metadata TEXT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ta_team_idx (teamId),
  INDEX ta_achievement_idx (achievementId),
  INDEX ta_tournament_idx (tournamentId),
  UNIQUE KEY ta_team_achievement_unique (teamId, achievementId, tournamentId),
  CONSTRAINT fk_ta_team FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_achievement FOREIGN KEY (achievementId) REFERENCES achievements(id) ON DELETE CASCADE,
  CONSTRAINT fk_ta_tournament FOREIGN KEY (tournamentId) REFERENCES tournaments(id) ON DELETE SET NULL
);
