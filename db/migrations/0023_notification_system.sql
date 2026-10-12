-- ---------------------------------------------------------------
-- Unified Notification System
-- ---------------------------------------------------------------

-- Notification type definitions (the ONLY notification types)
CREATE TABLE `notification_types` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `icon` varchar(64),
  `isActive` tinyint NOT NULL DEFAULT 1,
  `isAutomatic` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_types_slug_idx` (`slug`),
  KEY `notification_types_active_idx` (`isActive`)
) ENGINE=InnoDB;

-- Seed the four notification types
INSERT INTO `notification_types` (`slug`, `name`, `description`, `icon`, `isActive`, `isAutomatic`) VALUES
  ('admin_announcement', 'Admin Announcement', 'Official announcements from the TSG admin team', 'megaphone', 1, 0),
  ('player_live', 'Player Live', 'Player is live streaming', 'radio', 1, 1),
  ('clutch_highlight', 'New Clutch/Highlight', 'New clutch or highlight content available', 'video', 1, 1),
  ('engagement', 'Engagement', 'Likes, comments, and replies on your content', 'heart', 1, 1);

-- Announcements — admin-created messages with rich content
CREATE TABLE `announcements` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `imageKey` varchar(512),
  `priority` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
  `status` enum('draft','scheduled','published','archived') NOT NULL DEFAULT 'draft',
  `scheduledAt` timestamp NULL,
  `publishedAt` timestamp NULL,
  `targetType` enum('everyone','role','users') NOT NULL DEFAULT 'everyone',
  `targetRole` varchar(64),
  `createdById` int unsigned NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `announcements_status_idx` (`status`),
  KEY `announcements_priority_idx` (`priority`),
  KEY `announcements_active_idx` (`isActive`),
  KEY `announcements_created_by_idx` (`createdById`)
) ENGINE=InnoDB;

-- Announcement links — multiple links with custom button text
CREATE TABLE `announcement_links` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `announcementId` int unsigned NOT NULL,
  `url` varchar(1024) NOT NULL,
  `label` varchar(128) NOT NULL,
  `displayOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `announcement_links_announcement_idx` (`announcementId`),
  KEY `announcement_links_order_idx` (`displayOrder`)
) ENGINE=InnoDB;

-- Announcement targets — when targetType is "users"
CREATE TABLE `announcement_targets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `announcementId` int unsigned NOT NULL,
  `userId` int unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `announcement_targets_announcement_idx` (`announcementId`),
  KEY `announcement_targets_user_idx` (`userId`),
  UNIQUE KEY `announcement_targets_uniq_idx` (`announcementId`, `userId`)
) ENGINE=InnoDB;

-- Notifications — unified notification record per user
CREATE TABLE `notifications` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `notificationTypeId` int unsigned NOT NULL,
  `userId` int unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text,
  `imageKey` varchar(512),
  `linkUrl` varchar(1024),
  `linkLabel` varchar(128),
  `priority` enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
  `isRead` tinyint NOT NULL DEFAULT 0,
  `readAt` timestamp NULL,
  `clickedAt` timestamp NULL,
  `sourceType` varchar(64),
  `sourceId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `notifications_user_idx` (`userId`),
  KEY `notifications_type_idx` (`notificationTypeId`),
  KEY `notifications_read_idx` (`isRead`),
  KEY `notifications_user_read_idx` (`userId`, `isRead`)
) ENGINE=InnoDB;
