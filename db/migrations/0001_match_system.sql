CREATE TABLE match_players (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  matchId BIGINT UNSIGNED NOT NULL,
  playerId BIGINT UNSIGNED NOT NULL,
  lineupStatus ENUM('played', 'bench', 'dnp') NOT NULL DEFAULT 'played',
  kills INT NOT NULL DEFAULT 0,
  placement INT NULL,
  placementPoints INT NOT NULL DEFAULT 0,
  finishPoints INT NOT NULL DEFAULT 0,
  totalPoints INT NOT NULL DEFAULT 0,
  officialTotalPoints INT NULL,
  specialMoment VARCHAR(255) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX mp_match_idx (matchId),
  INDEX mp_player_idx (playerId)
);
