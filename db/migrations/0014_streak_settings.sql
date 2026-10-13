-- Streak settings columns for org_settings
ALTER TABLE `org_settings`
  ADD COLUMN `dailyLoginXp` INT NOT NULL DEFAULT 10,
  ADD COLUMN `streakBonusXp` INT NOT NULL DEFAULT 5,
  ADD COLUMN `maxStreakDays` INT NOT NULL DEFAULT 7;