export const Session = {
  cookieName: "tsg_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

// ---------------------------------------------------------------------------
// Roles
//
// The application has a fixed hierarchy of built-in roles:
//   admin > moderator > player > fan
//
// In addition to the built-in roles, admins can create *custom roles* with
// granular permissions (see PERMISSIONS below). Custom roles are stored in the
// `roles` DB table and can only be assigned a subset of permissions that are
// strictly less privileged than admin-only capabilities.
//
// The `users.role` column stores the user's effective role slug:
//  - Built-in roles:  "admin" | "moderator" | "player" | "fan"
//  - Custom roles:    the custom role's slug (e.g. "content-manager")
// ---------------------------------------------------------------------------

export const Roles = {
  Admin: "admin",
  Moderator: "moderator",
  Player: "player",
  Fan: "fan",
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

/** Every valid built-in role value, ordered from lowest to highest privilege. */
export const allRoles: readonly Role[] = [
  Roles.Fan,
  Roles.Player,
  Roles.Moderator,
  Roles.Admin,
];

const roleRank: Record<Role, number> = {
  [Roles.Fan]: 0,
  [Roles.Player]: 1,
  [Roles.Moderator]: 2,
  [Roles.Admin]: 3,
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (allRoles as readonly string[]).includes(value)
  );
}

/** True when `role` is exactly one of `allowed`. */
export function hasRole(role: string | null | undefined, ...allowed: Role[]) {
  return !!role && (allowed as string[]).includes(role);
}

/** True when `role` is `min` or higher in the hierarchy. */
export function hasAtLeastRole(
  role: string | null | undefined,
  min: Role,
): boolean {
  return isRole(role) && roleRank[role] >= roleRank[min];
}

// ---------------------------------------------------------------------------
// Permissions
//
// Permissions are the atomic capabilities that can be granted to a role.
// Built-in roles have fixed permission sets (see BUILTIN_ROLE_PERMISSIONS).
// Custom roles can be created with any subset of non-admin-only permissions.
// ---------------------------------------------------------------------------

export const PERMISSIONS = {
  // Content management
  CONTENT_MANAGE_TEAMS: "content:manage_teams",
  CONTENT_MANAGE_PLAYERS: "content:manage_players",
  CONTENT_MANAGE_TOURNAMENTS: "content:manage_tournaments",
  CONTENT_MANAGE_MAPS: "content:manage_maps",
  CONTENT_MANAGE_ACHIEVEMENTS: "content:manage_achievements",
  CONTENT_MANAGE_CARDS: "content:manage_cards",
  CONTENT_MANAGE_XP_TASKS: "content:manage_xp_tasks",
  CONTENT_MANAGE_PREDICTIONS: "content:manage_predictions",
  CONTENT_MANAGE_QUIZ: "content:manage_quiz",
  CONTENT_MANAGE_STAFF: "content:manage_staff",
  CONTENT_MANAGE_TEAM_MEDIA: "content:manage_team_media",
  CONTENT_MANAGE_MEDIA: "content:manage_media",
  CONTENT_MANAGE_HIGHLIGHTS: "content:manage_highlights",

  // Community management
  COMMUNITY_MODERATE_COMMENTS: "community:moderate_comments",
  COMMUNITY_MANAGE_USERS: "community:manage_users",

  // Role & permission management (admin-only)
  ROLES_MANAGE_ROLES: "roles:manage_roles",
  ROLES_ASSIGN_ROLES: "roles:assign_roles",

  // XP & rewards management
  XP_MANAGE_SETTINGS: "xp:manage_settings",
  XP_MANAGE_STREAK: "xp:manage_streak",
  XP_ADJUST_USER_XP: "xp:adjust_user_xp",
  XP_MANAGE_WEEKLY_TOP_FAN: "xp:manage_weekly_top_fan",

  // Org settings
  ORG_MANAGE_SETTINGS: "org:manage_settings",
  ORG_MANAGE_PEOPLE: "org:manage_people",

  // Notifications
  NOTIFICATIONS_MANAGE: "notifications:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Permissions that are reserved for the built-in "admin" role only.
 * Custom roles can never be granted any of these permissions.
 */
export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.ROLES_MANAGE_ROLES,
  PERMISSIONS.ROLES_ASSIGN_ROLES,
  PERMISSIONS.ORG_MANAGE_SETTINGS,
  PERMISSIONS.ORG_MANAGE_PEOPLE,
  PERMISSIONS.CONTENT_MANAGE_MEDIA,
  PERMISSIONS.XP_ADJUST_USER_XP,
  PERMISSIONS.COMMUNITY_MANAGE_USERS,
  PERMISSIONS.NOTIFICATIONS_MANAGE,
];

/** Whether a permission is admin-only and cannot be assigned to custom roles. */
export function isAdminOnlyPermission(permission: Permission): boolean {
  return (ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(permission);
}

/** Human-readable labels for permissions, grouped by category. */
export const PERMISSION_GROUPS: { category: string; permissions: { key: Permission; label: string; description: string }[] }[] =
  [
    {
      category: "Content Management",
      permissions: [
        { key: PERMISSIONS.CONTENT_MANAGE_TEAMS, label: "Manage Teams", description: "Create, edit, and delete esports teams" },
        { key: PERMISSIONS.CONTENT_MANAGE_PLAYERS, label: "Manage Players", description: "Create, edit, and delete players" },
        { key: PERMISSIONS.CONTENT_MANAGE_TOURNAMENTS, label: "Manage Tournaments", description: "Create, edit, and delete tournaments" },
        { key: PERMISSIONS.CONTENT_MANAGE_MAPS, label: "Manage Maps", description: "Add, edit, and delete map library entries" },
        { key: PERMISSIONS.CONTENT_MANAGE_ACHIEVEMENTS, label: "Manage Achievements", description: "Create, edit, and delete achievements" },
        { key: PERMISSIONS.CONTENT_MANAGE_CARDS, label: "Manage Cards", description: "Create, edit, and delete fan card collection" },
        { key: PERMISSIONS.CONTENT_MANAGE_XP_TASKS, label: "Manage XP Tasks", description: "Create, edit, and delete XP tasks" },
        { key: PERMISSIONS.CONTENT_MANAGE_PREDICTIONS, label: "Manage Predictions", description: "Create and manage tournament predictions" },
        { key: PERMISSIONS.CONTENT_MANAGE_QUIZ, label: "Manage Quiz", description: "Create and manage TSG Quiz questions" },
        { key: PERMISSIONS.CONTENT_MANAGE_STAFF, label: "Manage Staff", description: "Create, edit, and delete team staff" },
        { key: PERMISSIONS.CONTENT_MANAGE_TEAM_MEDIA, label: "Manage Team Media", description: "Add, edit, and delete team media" },
        { key: PERMISSIONS.CONTENT_MANAGE_HIGHLIGHTS, label: "Manage Highlights", description: "Feature, hide, and delete player highlights" },
      ],
    },
    {
      category: "Community",
      permissions: [
        { key: PERMISSIONS.COMMUNITY_MODERATE_COMMENTS, label: "Moderate Comments", description: "View, pin, hide, and delete community comments" },
      ],
    },
    {
      category: "XP & Rewards",
      permissions: [
        { key: PERMISSIONS.XP_MANAGE_STREAK, label: "Manage Streak Settings", description: "Configure daily streak XP rewards" },
        { key: PERMISSIONS.XP_MANAGE_WEEKLY_TOP_FAN, label: "Manage Weekly Top Fan", description: "Configure weekly top fan settings" },
      ],
    },
    {
      category: "Admin-Only",
      permissions: [
        { key: PERMISSIONS.ROLES_MANAGE_ROLES, label: "Manage Roles", description: "Create, edit, and delete custom roles (admin only)" },
        { key: PERMISSIONS.ROLES_ASSIGN_ROLES, label: "Assign Roles", description: "Assign roles to users (admin only)" },
        { key: PERMISSIONS.ORG_MANAGE_SETTINGS, label: "Org Settings", description: "Manage organization settings (admin only)" },
        { key: PERMISSIONS.ORG_MANAGE_PEOPLE, label: "Manage People", description: "Manage owners and legend profiles (admin only)" },
        { key: PERMISSIONS.CONTENT_MANAGE_MEDIA, label: "Media Library", description: "Manage media library (admin only)" },
        { key: PERMISSIONS.XP_ADJUST_USER_XP, label: "Adjust User XP", description: "Adjust any user's XP (admin only)" },
        { key: PERMISSIONS.COMMUNITY_MANAGE_USERS, label: "Manage Users", description: "Ban/unban and delete users (admin only)" },
        { key: PERMISSIONS.NOTIFICATIONS_MANAGE, label: "Manage Notifications", description: "Manage notification types and announcements (admin only)" },
      ],
    },
  ];

/** Permissions granted to each built-in role. */
export const BUILTIN_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Roles.Fan]: [],
  [Roles.Player]: [],
  [Roles.Moderator]: [PERMISSIONS.COMMUNITY_MODERATE_COMMENTS],
  [Roles.Admin]: [
    // Admin implicitly has ALL permissions
    ...Object.values(PERMISSIONS),
  ],
};

/**
 * Check whether a user role (which may be built-in or a custom role slug)
 * possesses a given permission. For built-in roles, consult
 * BUILTIN_ROLE_PERMISSIONS. For custom roles, the caller must pass the
 * resolved permission set via the third argument.
 */
export function userHasPermission(
  role: string | null | undefined,
  permission: Permission,
  customPermissions: readonly Permission[] = [],
): boolean {
  if (!role) return false;

  // Built-in roles
  if (isRole(role)) {
    return (BUILTIN_ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
  }

  // Custom roles: check the resolved permission set
  return (customPermissions as readonly string[]).includes(permission);
}

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
  googleCallback: "/api/oauth/google/callback",
  discordCallback: "/api/oauth/discord/callback",
} as const;

// ---------------------------------------------------------------------------
// Notification Types
//
// The ONLY notification types that exist in the system.
// Admin can activate/deactivate each type and choose automatic vs manual.
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPES = {
  ADMIN_ANNOUNCEMENT: "admin_announcement",
  PLAYER_LIVE: "player_live",
  CLUTCH_HIGHLIGHT: "clutch_highlight",
  ENGAGEMENT: "engagement",
} as const;

export type NotificationTypeSlug = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

/** All valid notification type slugs. */
export const allNotificationTypes: readonly NotificationTypeSlug[] = [
  NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
  NOTIFICATION_TYPES.PLAYER_LIVE,
  NOTIFICATION_TYPES.CLUTCH_HIGHLIGHT,
  NOTIFICATION_TYPES.ENGAGEMENT,
];

/** Notification type metadata for display. */
export const NOTIFICATION_TYPE_META: Record<NotificationTypeSlug, { name: string; icon: string; description: string }> = {
  [NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT]: {
    name: "Admin Announcement",
    icon: "megaphone",
    description: "Official announcements from the TSG admin team",
  },
  [NOTIFICATION_TYPES.PLAYER_LIVE]: {
    name: "Player Live",
    icon: "radio",
    description: "Player is live streaming",
  },
  [NOTIFICATION_TYPES.CLUTCH_HIGHLIGHT]: {
    name: "New Clutch/Highlight",
    icon: "video",
    description: "New clutch or highlight content available",
  },
  [NOTIFICATION_TYPES.ENGAGEMENT]: {
    name: "Engagement",
    icon: "heart",
    description: "Likes, comments, and replies on your content",
  },
};

/** Notification priority levels. */
export const NOTIFICATION_PRIORITIES = ["normal", "important", "urgent"] as const;
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

/** Announcement status values. */
export const ANNOUNCEMENT_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

/** Announcement target types. */
export const ANNOUNCEMENT_TARGET_TYPES = ["everyone", "role", "users"] as const;
export type AnnouncementTargetType = (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

/** Button style variants. */
export const BUTTON_STYLES = ["primary", "outline", "ghost"] as const;
export type ButtonStyle = (typeof BUTTON_STYLES)[number];

/** Notification display layouts. */
export const NOTIFICATION_LAYOUTS = ["compact", "card", "banner"] as const;
export type NotificationLayout = (typeof NOTIFICATION_LAYOUTS)[number];

// ---------------------------------------------------------------------------
// Media Page
//
// The TSG Media Page is fully configurable from the Admin Panel. Every
// optional feature is individually enableable/disableable. The flags below
// are the defaults; the persisted configuration lives in the
// `media_page_config` table as a JSON blob.
// ---------------------------------------------------------------------------

/** Media entry types supported by the gallery. */
export const MEDIA_TYPES = ["photo", "video", "youtube", "drive"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** Optional TSG tags that can be applied to media entries. */
export const MEDIA_TAGS = ["TSG ARMY", "TSG PROS", "TSG ARTEMIS"] as const;
export type MediaTag = (typeof MEDIA_TAGS)[number];

/**
 * Default Media Page configuration. Each flag controls whether a feature
 * or section appears on the public page. Admins toggle these in the
 * Admin Panel; unused fields/sections are never forced to appear.
 */
export const MEDIA_PAGE_DEFAULT_CONFIG = {
  // Gallery sections
  showFeaturedSection: true,
  showGallery: true,
  // Filters
  showTeamFilter: true,
  showCategoryFilter: true,
  showTournamentFilter: true,
  showTagFilter: true,
  // Discovery
  showSearch: true,
  showSorting: true,
  // Metadata
  showDescriptions: true,
  showUploadDates: true,
  // Presentation
  showFullscreenPreview: true,
  showMediaCount: true,
  // Content sources
  includeHighlights: false,
} as const;

export type MediaPageConfig = {
  -readonly [K in keyof typeof MEDIA_PAGE_DEFAULT_CONFIG]?: boolean;
};

/** Sort options for the gallery. */
export const MEDIA_SORT_OPTIONS = [
  "newest",
  "oldest",
  "featured",
  "title",
] as const;
export type MediaSortOption = (typeof MEDIA_SORT_OPTIONS)[number];

// ---------------------------------------------------------------------------
// Media Albums
// ---------------------------------------------------------------------------

/** Album publication status. */
export const ALBUM_STATUSES = ["published", "draft"] as const;
export type AlbumStatus = (typeof ALBUM_STATUSES)[number];

/**
 * Default album categories. Admins can also type a custom category;
 * these are offered as quick picks in the Admin Panel.
 */
export const ALBUM_CATEGORIES = [
  "Matches",
  "Highlights",
  "Photos",
  "Videos",
  "Streams",
  "Behind the Scenes",
  "Interviews",
  "Events",
  "Other",
] as const;

/** Max photos/videos that can be bulk-uploaded in one request. */
export const ALBUM_BULK_UPLOAD_LIMIT = 20;
