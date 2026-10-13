-- Add card reward reference to quiz questions
ALTER TABLE `quiz_questions` ADD COLUMN `cardRewardId` BIGINT UNSIGNED NULL;
CREATE INDEX `quiz_questions_card_reward_idx` ON `quiz_questions` (`cardRewardId`);
