-- Migration 0045: Update player slugs to match current IGNs
-- Many players have slugs derived from previous usernames (e.g., TSG VORTEX → tsg-vortex).
-- This migration updates each player's slug to match their current IGN and preserves
-- the old slug as a redirect, so shared links don't break.

-- Step 1: Collect old slugs into redirects BEFORE changing slugs.
--         Process in order to avoid duplicate-slug conflicts:
--         TSG DIPS (id=6) holds 'tsg-nova' which TSG NOVA wants.
--         We move TSG DIPS to 'tsg-dips' first, then TSG NOVA can claim 'tsg-nova'.

-- TSG ARJUN: tsg-vortex → tsg-arjun
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-vortex', 1)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-arjun' WHERE id = 1 AND slug = 'tsg-vortex';

-- TSG DIPS: tsg-nova → tsg-dips (must happen BEFORE TSG NOVA takes 'tsg-nova')
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-nova', 6)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-dips' WHERE id = 6 AND slug = 'tsg-nova';

-- TSG PRIAA: tsg-valkyrie → tsg-priaa
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-valkyrie', 7)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-priaa' WHERE id = 7 AND slug = 'tsg-valkyrie';

-- TSG KITKATT: tsg-aria → tsg-kitkatt
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-aria', 10)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-kitkatt' WHERE id = 10 AND slug = 'tsg-aria';

-- TSG AKSHII: tsg-luna → tsg-akshii
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-luna', 8)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-akshii' WHERE id = 8 AND slug = 'tsg-luna';

-- TSG ELSAA: tsg-ember → tsg-elsaa
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-ember', 9)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-elsaa' WHERE id = 9 AND slug = 'tsg-ember';

-- TSG SOMI: tsg-frost → tsg-somi
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-frost', 3)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-somi' WHERE id = 3 AND slug = 'tsg-frost';

-- TSG BLOOD: tsg-blaze → tsg-blood
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-blaze', 2)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-blood' WHERE id = 2 AND slug = 'tsg-blaze';

-- TSG STRUGGLE: tsg-rogue → tsg-struggle
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-rogue', 4)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-struggle' WHERE id = 4 AND slug = 'tsg-rogue';

-- TSG SALLU: tsg-titan → tsg-sallu
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-titan', 5)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-sallu' WHERE id = 5 AND slug = 'tsg-titan';

-- TSG NOVA: tsg-novaa → tsg-nova (now available since TSG DIPS moved to tsg-dips)
INSERT INTO player_slug_redirects (oldSlug, playerId)
  VALUES ('tsg-novaa', 5003531)
  ON DUPLICATE KEY UPDATE playerId = VALUES(playerId);
UPDATE players SET slug = 'tsg-nova' WHERE id = 5003531 AND slug = 'tsg-novaa';
