-- Daily Login Streaks
CREATE TABLE `user_streaks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` BIGINT UNSIGNED NOT NULL,
  `currentStreak` INT NOT NULL DEFAULT 0,
  `longestStreak` INT NOT NULL DEFAULT 0,
  `lastLoginDate` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `user_streaks_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Comment XP Rewards
CREATE TABLE `comment_xp_rewards` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `commentId` BIGINT UNSIGNED NOT NULL,
  `awardedById` BIGINT UNSIGNED NOT NULL,
  `amount` INT NOT NULL,
  `reason` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `comment_xp_rewards_comment_idx` (`commentId`),
  KEY `comment_xp_rewards_awarded_by_idx` (`awardedById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tournament Match Predictions
CREATE TABLE `predictions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tournamentId` BIGINT UNSIGNED NOT NULL,
  `question` TEXT NOT NULL,
  `xpReward` INT NOT NULL DEFAULT 0,
  `status` ENUM('open', 'closed', 'answered') NOT NULL DEFAULT 'open',
  `closesAt` TIMESTAMP NOT NULL,
  `correctOptionId` BIGINT UNSIGNED NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `predictions_tournament_idx` (`tournamentId`),
  KEY `predictions_status_idx` (`status`),
  KEY `predictions_closes_at_idx` (`closesAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `prediction_options` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `predictionId` BIGINT UNSIGNED NOT NULL,
  `text` VARCHAR(255) NOT NULL,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `prediction_options_prediction_idx` (`predictionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `prediction_votes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `predictionId` BIGINT UNSIGNED NOT NULL,
  `optionId` BIGINT UNSIGNED NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `prediction_votes_uniq_idx` (`predictionId`, `userId`),
  KEY `prediction_votes_prediction_idx` (`predictionId`),
  KEY `prediction_votes_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TSG Quiz
CREATE TABLE `quiz_questions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `question` TEXT NOT NULL,
  `xpReward` INT NOT NULL DEFAULT 0,
  `timerSeconds` INT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `quiz_questions_active_idx` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `quiz_options` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `questionId` BIGINT UNSIGNED NOT NULL,
  `text` VARCHAR(255) NOT NULL,
  `isCorrect` BOOLEAN NOT NULL DEFAULT FALSE,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `quiz_options_question_idx` (`questionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `quiz_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `questionId` BIGINT UNSIGNED NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `optionId` BIGINT UNSIGNED NOT NULL,
  `isCorrect` BOOLEAN NOT NULL,
  `xpAwarded` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `quiz_attempts_uniq_idx` (`questionId`, `userId`),
  KEY `quiz_attempts_question_idx` (`questionId`),
  KEY `quiz_attempts_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Guess the Player
CREATE TABLE `guess_player_questions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `question` TEXT NOT NULL,
  `xpReward` INT NOT NULL DEFAULT 0,
  `timerSeconds` INT NULL,
  `correctPersonId` BIGINT UNSIGNED NOT NULL,
  `personKind` ENUM('owner', 'legend', 'player', 'staff') NOT NULL DEFAULT 'player',
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `guess_player_questions_active_idx` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `guess_player_options` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `questionId` BIGINT UNSIGNED NOT NULL,
  `personId` BIGINT UNSIGNED NOT NULL,
  `personKind` ENUM('owner', 'legend', 'player', 'staff') NOT NULL DEFAULT 'player',
  `displayOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `guess_player_options_question_idx` (`questionId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `guess_player_attempts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `questionId` BIGINT UNSIGNED NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `optionId` BIGINT UNSIGNED NOT NULL,
  `isCorrect` BOOLEAN NOT NULL,
  `xpAwarded` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `guess_player_attempts_uniq_idx` (`questionId`, `userId`),
  KEY `guess_player_attempts_question_idx` (`questionId`),
  KEY `guess_player_attempts_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- XP Tasks
CREATE TABLE `xp_tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `actionUrl` VARCHAR(1024) NULL,
  `xpReward` INT NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `displayOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `xp_tasks_active_idx` (`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `user_task_completions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `taskId` BIGINT UNSIGNED NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `xpAwarded` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `user_task_completions_uniq_idx` (`taskId`, `userId`),
  KEY `user_task_completions_task_idx` (`taskId`),
  KEY `user_task_completions_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Weekly Top Fan
CREATE TABLE `weekly_top_fan` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `weekStart` TIMESTAMP NOT NULL,
  `weekEnd` TIMESTAMP NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `userXp` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `weekly_top_fan_week_idx` (`weekStart`),
  KEY `weekly_top_fan_user_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;