-- ---------------------------------------------------------------
-- Custom roles & permissions system
-- ---------------------------------------------------------------

CREATE TABLE `roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `slug` varchar(128) NOT NULL,
  `description` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `isBuiltIn` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_slug_idx` (`slug`),
  KEY `roles_active_idx` (`isActive`)
) ENGINE=InnoDB;

CREATE TABLE `role_permissions` (
  `roleId` int unsigned NOT NULL,
  `permission` varchar(128) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`roleId`, `permission`),
  KEY `role_permissions_role_idx` (`roleId`)
) ENGINE=InnoDB;

CREATE TABLE `user_roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `userId` int unsigned NOT NULL,
  `roleId` int unsigned NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `assignedById` int unsigned,
  PRIMARY KEY (`id`),
  KEY `user_roles_user_idx` (`userId`),
  KEY `user_roles_role_idx` (`roleId`),
  UNIQUE KEY `user_roles_user_role_idx` (`userId`, `roleId`)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Change users.role from enum to varchar to support custom role slugs
-- ---------------------------------------------------------------
ALTER TABLE `users` MODIFY COLUMN `role` varchar(64) NOT NULL DEFAULT 'fan';

-- ---------------------------------------------------------------
-- Seed built-in roles with their permissions
-- ---------------------------------------------------------------
INSERT INTO `roles` (`name`, `slug`, `description`, `isActive`, `isBuiltIn`) VALUES
  ('Fan', 'fan', 'Default role for all users', 1, 1),
  ('Player', 'player', 'Users who have completed username selection', 1, 1),
  ('Moderator', 'moderator', 'Community moderators who can manage comments', 1, 1),
  ('Admin', 'admin', 'Full system administrators', 1, 1);

-- Fan: no extra permissions
-- Player: no extra permissions
-- Moderator: moderate comments
INSERT INTO `role_permissions` (`roleId`, `permission`)
  SELECT r.id, 'community:moderate_comments'
  FROM roles r WHERE r.slug = 'moderator';

-- Admin: all permissions
INSERT INTO `role_permissions` (`roleId`, `permission`)
  SELECT r.id, p.permission FROM roles r
  CROSS JOIN (
    SELECT 'content:manage_teams' AS permission UNION ALL
    SELECT 'content:manage_players' UNION ALL
    SELECT 'content:manage_tournaments' UNION ALL
    SELECT 'content:manage_maps' UNION ALL
    SELECT 'content:manage_achievements' UNION ALL
    SELECT 'content:manage_cards' UNION ALL
    SELECT 'content:manage_xp_tasks' UNION ALL
    SELECT 'content:manage_predictions' UNION ALL
    SELECT 'content:manage_quiz' UNION ALL
    SELECT 'content:manage_staff' UNION ALL
    SELECT 'content:manage_team_media' UNION ALL
    SELECT 'community:moderate_comments' UNION ALL
    SELECT 'xp:manage_settings' UNION ALL
    SELECT 'xp:manage_streak' UNION ALL
    SELECT 'xp:manage_weekly_top_fan'
  ) p
  WHERE r.slug = 'admin';

-- Admin-only permissions (stored separately so they can be validated as off-limits for custom roles)
INSERT INTO `role_permissions` (`roleId`, `permission`)
  SELECT r.id, p.permission FROM roles r
  CROSS JOIN (
    SELECT 'community:manage_users' UNION ALL
    SELECT 'roles:manage_roles' UNION ALL
    SELECT 'roles:assign_roles' UNION ALL
    SELECT 'org:manage_settings' UNION ALL
    SELECT 'org:manage_people' UNION ALL
    SELECT 'content:manage_media' UNION ALL
    SELECT 'xp:adjust_user_xp'
  ) p
  WHERE r.slug = 'admin';
