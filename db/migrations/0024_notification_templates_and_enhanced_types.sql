-- Migration: 0024_notification_templates_and_enhanced_types.sql
-- Add notification templates table and enhance notification_types with customization fields

-- Notification Templates — reusable templates for all notification types
CREATE TABLE `notification_templates` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `notificationTypeId` INT UNSIGNED NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `description` TEXT,
  `isDefault` BOOLEAN NOT NULL DEFAULT FALSE,
  `isArchived` BOOLEAN NOT NULL DEFAULT FALSE,
  `titleTemplate` VARCHAR(255) NOT NULL,
  `messageTemplate` TEXT NOT NULL,
  `imageKey` VARCHAR(512),
  `priority` ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  `linkUrl` VARCHAR(1024),
  `linkLabel` VARCHAR(128),
  `buttonStyle` ENUM('primary','outline','ghost') NOT NULL DEFAULT 'primary',
  `buttonIcon` VARCHAR(64),
  `youtubeEnabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `youtubeAutoThumbnail` BOOLEAN NOT NULL DEFAULT TRUE,
  `youtubeCustomThumbnailKey` VARCHAR(512),
  `layout` ENUM('compact','card','banner') NOT NULL DEFAULT 'compact',
  `createdById` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`notificationTypeId`) REFERENCES `notification_types`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `notification_templates_type_idx` ON `notification_templates` (`notificationTypeId`);
CREATE INDEX `notification_templates_default_idx` ON `notification_templates` (`notificationTypeId`, `isDefault`);
CREATE INDEX `notification_templates_archived_idx` ON `notification_templates` (`isArchived`);

-- Enhance notification_types with default template reference and customization fields
ALTER TABLE `notification_types`
  ADD COLUMN `defaultTemplateId` INT UNSIGNED NULL AFTER `isAutomatic`,
  ADD COLUMN `titleTemplate` VARCHAR(255) NULL AFTER `defaultTemplateId`,
  ADD COLUMN `messageTemplate` TEXT NULL AFTER `titleTemplate`,
  ADD COLUMN `imageKey` VARCHAR(512) NULL AFTER `messageTemplate`,
  ADD COLUMN `priority` ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal' AFTER `imageKey`,
  ADD COLUMN `linkUrl` VARCHAR(1024) NULL AFTER `priority`,
  ADD COLUMN `linkLabel` VARCHAR(128) NULL AFTER `linkUrl`,
  ADD COLUMN `buttonStyle` ENUM('primary','outline','ghost') NOT NULL DEFAULT 'primary' AFTER `linkLabel`,
  ADD COLUMN `buttonIcon` VARCHAR(64) NULL AFTER `buttonStyle`,
  ADD COLUMN `youtubeEnabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `buttonIcon`,
  ADD COLUMN `youtubeAutoThumbnail` BOOLEAN NOT NULL DEFAULT TRUE AFTER `youtubeEnabled`,
  ADD COLUMN `youtubeCustomThumbnailKey` VARCHAR(512) NULL AFTER `youtubeAutoThumbnail`,
  ADD COLUMN `layout` ENUM('compact','card','banner') NOT NULL DEFAULT 'compact' AFTER `youtubeCustomThumbnailKey`,
  ADD CONSTRAINT `fk_notification_types_default_template` FOREIGN KEY (`defaultTemplateId`) REFERENCES `notification_templates`(`id`) ON DELETE SET NULL;

-- Enhance announcements with button/link improvements
ALTER TABLE `announcements`
  ADD COLUMN `buttonStyle` ENUM('primary','outline','ghost') NOT NULL DEFAULT 'primary' AFTER `priority`,
  ADD COLUMN `buttonIcon` VARCHAR(64) NULL AFTER `buttonStyle`,
  ADD COLUMN `youtubeVideoId` VARCHAR(64) NULL AFTER `buttonIcon`,
  ADD COLUMN `youtubeAutoThumbnail` BOOLEAN NOT NULL DEFAULT TRUE AFTER `youtubeVideoId`,
  ADD COLUMN `youtubeCustomThumbnailKey` VARCHAR(512) NULL AFTER `youtubeAutoThumbnail`,
  ADD COLUMN `layout` ENUM('compact','card','banner') NOT NULL DEFAULT 'compact' AFTER `youtubeCustomThumbnailKey`;

-- Enhance announcement_links with button style and icon
ALTER TABLE `announcement_links`
  ADD COLUMN `buttonStyle` ENUM('primary','outline','ghost') NOT NULL DEFAULT 'primary' AFTER `label`,
  ADD COLUMN `icon` VARCHAR(64) NULL AFTER `buttonStyle`;

-- Enhance notifications with template reference and YouTube data
ALTER TABLE `notifications`
  ADD COLUMN `templateId` INT UNSIGNED NULL AFTER `notificationTypeId`,
  ADD COLUMN `youtubeVideoId` VARCHAR(64) NULL AFTER `linkLabel`,
  ADD COLUMN `youtubeThumbnailUrl` VARCHAR(1024) NULL AFTER `youtubeVideoId`,
  ADD COLUMN `layout` ENUM('compact','card','banner') NOT NULL DEFAULT 'compact' AFTER `youtubeThumbnailUrl`,
  ADD CONSTRAINT `fk_notifications_template` FOREIGN KEY (`templateId`) REFERENCES `notification_templates`(`id`) ON DELETE SET NULL;

-- Seed default templates for each notification type
INSERT INTO `notification_templates` (`notificationTypeId`, `name`, `description`, `isDefault`, `titleTemplate`, `messageTemplate`, `priority`, `linkLabel`, `buttonStyle`, `layout`, `createdById`)
SELECT 
  nt.id,
  'Default Template',
  'System default template',
  TRUE,
  CASE nt.slug
    WHEN 'admin_announcement' THEN '{{title}}'
    WHEN 'player_live' THEN '{{playerName}} is live'
    WHEN 'clutch_highlight' THEN '{{title}}'
    WHEN 'engagement' THEN '{{actorName}} {{action}} {{contentDesc}}'
  END,
  CASE nt.slug
    WHEN 'admin_announcement' THEN '{{message}}'
    WHEN 'player_live' THEN '{{playerName}} is now streaming. Come watch!'
    WHEN 'clutch_highlight' THEN 'New clutch/highlight available.'
    WHEN 'engagement' THEN '{{actorName}} {{action}} {{contentDesc}}.'
  END,
  'normal',
  CASE nt.slug
    WHEN 'admin_announcement' THEN 'Read More'
    WHEN 'player_live' THEN 'Watch Live'
    WHEN 'clutch_highlight' THEN 'Watch Highlight'
    WHEN 'engagement' THEN 'View'
  END,
  'primary',
  'compact',
  1
FROM `notification_types` nt;

-- Update notification_types to reference their default templates
UPDATE `notification_types` nt
JOIN `notification_templates` ntpl ON ntpl.notificationTypeId = nt.id AND ntpl.isDefault = TRUE
SET nt.defaultTemplateId = ntpl.id;