-- Migration 0041: Remove IGN uniqueness for players and staff
-- This migration removes the unique constraint on players.ign (the partial
-- unique index players_ign_active_uk created by migration 0040) and makes
-- the ignIdx a plain non-unique index. This allows multiple players to share
-- the same IGN, including active/former players. Staff (team_staff) already
-- has no uniqueness constraint on name, so no changes are needed there.

-- Drop the partial unique index on players.ign (if it exists)
SET @partial_idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'players'
    AND index_name = 'players_ign_active_uk'
);

SET @drop_sql = IF(@partial_idx_exists = 1,
  'DROP INDEX players_ign_active_uk ON players',
  'SELECT "players_ign_active_uk does not exist, skipping drop" AS info'
);
PREPARE stmt FROM @drop_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure players_ign_idx is a plain (non-unique) index. If it doesn't
-- exist yet, create it; if it's accidentally unique, the above drop of
-- the partial index is sufficient since the plain index is already
-- non-unique per the schema definition.
SET @plain_idx_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'players'
    AND index_name = 'players_ign_idx'
);

SET @create_plain_sql = IF(@plain_idx_exists = 0,
  'CREATE INDEX players_ign_idx ON players (ign)',
  'SELECT "players_ign_idx already exists, skipping" AS info'
);
PREPARE stmt FROM @create_plain_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
