ALTER TABLE `player_achievements`
  ADD COLUMN `customTitle` varchar(255) NULL AFTER `achievementId`;

ALTER TABLE `team_achievements`
  ADD COLUMN `customTitle` varchar(255) NULL AFTER `achievementId`;