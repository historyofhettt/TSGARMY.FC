ALTER TABLE `tsgdb`.`users`
  ADD COLUMN `instagram` varchar(512) NULL AFTER `bio`,
  ADD COLUMN `featuredCardIds` text NULL AFTER `instagram`,
  ADD COLUMN `hiddenCardIds` text NULL AFTER `featuredCardIds`;