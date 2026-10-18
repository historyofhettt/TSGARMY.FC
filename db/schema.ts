import {
  mysqlTable,
  mysqlEnum,
  serial,
  bigint,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/mysql-core";

import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Auth users (platform-managed)
// ---------------------------------------------------------------------------
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  bio: text("bio"),
  instagram: varchar("instagram", { length: 512 }),
   role: varchar("role", { length: 64 })
    .default("fan")
    .notNull(),
  banned: boolean("banned").default(false).notNull(),
  provider: mysqlEnum("provider", ["google", "discord", "local"])
    .default("google"),
  providerId: varchar("providerId", { length: 255 }),
  username: varchar("username", { length: 255 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  xp: int("xp").notNull().default(0),
  usernameLower: varchar("usernameLower", { length: 255 }).generatedAlwaysAs(sql`LOWER(username)`, { mode: "stored" }),
  featuredCardIds: text("featuredCardIds"),
  hiddenCardIds: text("hiddenCardIds"),
}, (t) => ({
  providerIdx: uniqueIndex("users_provider_idx").on(t.provider, t.providerId),
  usernameIdx: uniqueIndex("users_username_idx").on(t.username),
  usernameLowerIdx: uniqueIndex("users_username_lower_idx").on(t.usernameLower),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Custom Roles & Permissions
// ---------------------------------------------------------------------------
export const roles = mysqlTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("isActive").default(true).notNull(),
    isBuiltIn: boolean("isBuiltIn").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugIdx: uniqueIndex("roles_slug_idx").on(t.slug),
    activeIdx: index("roles_active_idx").on(t.isActive),
  }),
);

export type RoleRecord = typeof roles.$inferSelect;
export type InsertRole = typeof roles.$inferInsert;

export const rolePermissions = mysqlTable(
  "role_permissions",
  {
    roleId: bigint("roleId", { mode: "number", unsigned: true }).notNull(),
    permission: varchar("permission", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey(t.roleId, t.permission),
    roleIdx: index("role_permissions_role_idx").on(t.roleId),
  }),
);

export type RolePermission = typeof rolePermissions.$inferSelect;

export const userRoles = mysqlTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    roleId: bigint("roleId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    assignedById: bigint("assignedById", { mode: "number", unsigned: true }),
  },
  (t) => ({
    userIdx: index("user_roles_user_idx").on(t.userId),
    roleIdx: index("user_roles_role_idx").on(t.roleId),
    userRoleUniq: uniqueIndex("user_roles_user_role_idx").on(t.userId, t.roleId),
  }),
);

export type UserRole = typeof userRoles.$inferSelect;

// ---------------------------------------------------------------------------
// XP history (fan XP / admin adjustments)
// ---------------------------------------------------------------------------
export const xpHistory = mysqlTable(
  "xp_history",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    amount: int("amount").notNull(),
    reason: varchar("reason", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("xp_history_user_idx").on(t.userId),
    userCreatedIdx: index("xp_history_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type XpHistory = typeof xpHistory.$inferSelect;

// ---------------------------------------------------------------------------
// Password reset tokens (OTP-based, single-use)
// ---------------------------------------------------------------------------
export const passwordResets = mysqlTable("password_resets", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  tokenIdx: uniqueIndex("password_resets_token_idx").on(t.token),
  emailIdx: index("password_resets_email_idx").on(t.email),
}));

export type PasswordReset = typeof passwordResets.$inferSelect;
export type InsertPasswordReset = typeof passwordResets.$inferInsert;

// ---------------------------------------------------------------------------
// Refresh tokens ("Remember me" functionality)
// ---------------------------------------------------------------------------
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  userAgent: text("userAgent"),
}, (t) => ({
  tokenIdx: uniqueIndex("refresh_tokens_token_idx").on(t.token),
  userIdx: index("refresh_tokens_user_idx").on(t.userId),
}));

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;

// ---------------------------------------------------------------------------
// Organization (single row settings)
// ---------------------------------------------------------------------------
export const orgSettings = mysqlTable("org_settings", {
  id: serial("id").primaryKey(),
  orgName: varchar("orgName", { length: 255 }).notNull().default("Two Side Gamers"),
  shortName: varchar("shortName", { length: 32 }).notNull().default("TSG"),
  tagline: varchar("tagline", { length: 255 })
    .notNull()
    .default("Built for Competition. Driven by Legacy."),
  description: text("description"),
  logoKey: varchar("logoKey", { length: 512 }),
  footerLogoKey: varchar("footerLogoKey", { length: 512 }),
  youtube: varchar("youtube", { length: 512 }),
  instagram: varchar("instagram", { length: 512 }),
  x: varchar("x", { length: 512 }),
  discord: varchar("discord", { length: 512 }),
  xpEnabledRoles: text("xpEnabledRoles"),
  liveSectionEnabledRoles: text("liveSectionEnabledRoles"),
  dailyLoginXp: int("dailyLoginXp").notNull().default(10),
  streakBonusXp: int("streakBonusXp").notNull().default(5),
  maxStreakDays: int("maxStreakDays").notNull().default(7),
  streakEnabled: boolean("streakEnabled").notNull().default(true),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type OrgSettings = typeof orgSettings.$inferSelect;

// ---------------------------------------------------------------------------
// People — owners & the TSG Legend
// ---------------------------------------------------------------------------
export const people = mysqlTable(
  "people",
  {
    id: serial("id").primaryKey(),
    kind: mysqlEnum("kind", ["owner", "legend"]).notNull().default("owner"),
    name: varchar("name", { length: 255 }).notNull(),
    position: varchar("position", { length: 255 }),
    description: text("description"),
    photoKey: varchar("photoKey", { length: 512 }),
    instagram: varchar("instagram", { length: 512 }),
    youtube: varchar("youtube", { length: 512 }),
    x: varchar("x", { length: 512 }),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    kindIdx: index("people_kind_idx").on(t.kind),
  }),
);

export type Person = typeof people.$inferSelect;

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
export const teams = mysqlTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    category: varchar("category", { length: 128 }).notNull().default("Esports Team"),
    tagline: varchar("tagline", { length: 255 }),
    description: text("description"),
    logoKey: varchar("logoKey", { length: 512 }),
    accent: mysqlEnum("accent", ["blue", "red"]).notNull().default("blue"),
    instagram: varchar("instagram", { length: 512 }),
    youtube: varchar("youtube", { length: 512 }),
    x: varchar("x", { length: 512 }),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugIdx: uniqueIndex("teams_slug_idx").on(t.slug),
  }),
);

export type Team = typeof teams.$inferSelect;

// ---------------------------------------------------------------------------
// Team Staff (coaches, analysts, managers, etc.)
// ---------------------------------------------------------------------------
export const teamStaff = mysqlTable(
  "team_staff",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    role: varchar("role", { length: 128 }).notNull().default("Other"),
    photoKey: varchar("photoKey", { length: 512 }),
    bio: text("bio"),
    joinedDate: timestamp("joinedDate"),
    status: mysqlEnum("status", ["active", "former"])
      .notNull()
      .default("active"),
    instagram: varchar("instagram", { length: 512 }),
    youtube: varchar("youtube", { length: 512 }),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    teamIdx: index("team_staff_team_idx").on(t.teamId),
    statusIdx: index("team_staff_status_idx").on(t.status),
  }),
);

export type TeamStaff = typeof teamStaff.$inferSelect;

// ---------------------------------------------------------------------------
// Team Media
// ---------------------------------------------------------------------------
export const teamMedia = mysqlTable(
  "team_media",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    date: timestamp("date"),
    photos: text("photos"),
    link: varchar("link", { length: 1024 }),
    isActive: mysqlEnum("isActive", ["active", "hidden"])
      .notNull()
      .default("active"),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    teamIdx: index("team_media_team_idx").on(t.teamId),
    statusIdx: index("team_media_status_idx").on(t.isActive),
  }),
);

export type TeamMedia = typeof teamMedia.$inferSelect;

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------
export const players = mysqlTable(
  "players",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    realName: varchar("realName", { length: 255 }),
    ign: varchar("ign", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    role: varchar("role", { length: 128 }),
    photoKey: varchar("photoKey", { length: 512 }),
    bio: text("bio"),
    instagram: varchar("instagram", { length: 512 }),
    youtube: varchar("youtube", { length: 512 }),
    x: varchar("x", { length: 512 }),
    status: mysqlEnum("status", ["active", "substitute", "former"])
      .notNull()
      .default("active"),
    joinedDate: timestamp("joinedDate"),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    teamIdx: index("players_team_idx").on(t.teamId),
    userIdIdx: index("players_user_idx").on(t.userId),
    ignIdx: index("players_ign_idx").on(t.ign),
    slugIdx: uniqueIndex("players_slug_idx").on(t.slug),
  }),
);

export type Player = typeof players.$inferSelect;

// ---------------------------------------------------------------------------
// Player slug redirects — preserves old profile URLs when a player's IGN/slug
// changes, so that shared links don't break.
// ---------------------------------------------------------------------------
export const playerSlugRedirects = mysqlTable(
  "player_slug_redirects",
  {
    id: serial("id").primaryKey(),
    oldSlug: varchar("oldSlug", { length: 255 }).notNull(),
    playerId: bigint("playerId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    oldSlugIdx: uniqueIndex("player_slug_redirects_old_slug_idx").on(t.oldSlug),
    playerIdx: index("player_slug_redirects_player_idx").on(t.playerId),
  }),
);

export type PlayerSlugRedirect = typeof playerSlugRedirects.$inferSelect;

// ---------------------------------------------------------------------------
// Tournaments (each belongs to exactly one team)
// ---------------------------------------------------------------------------
export const tournaments = mysqlTable(
  "tournaments",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    logoKey: varchar("logoKey", { length: 512 }),
    description: text("description"),
    startDate: timestamp("startDate"),
    startTime: varchar("startTime", { length: 32 }),
    status: mysqlEnum("status", ["upcoming", "ongoing", "completed"])
      .notNull()
      .default("upcoming"),
    youtubeLiveUrl: varchar("youtubeLiveUrl", { length: 512 }),
    instagramLiveUrl: varchar("instagramLiveUrl", { length: 512 }),
    numberOfMatches: int("numberOfMatches").notNull().default(0),
    pointTableKey: varchar("pointTableKey", { length: 512 }),
    mvpPlayerId: bigint("mvpPlayerId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    teamIdx: index("tournaments_team_idx").on(t.teamId),
    statusIdx: index("tournaments_status_idx").on(t.status),
    slugIdx: uniqueIndex("tournaments_slug_idx").on(t.slug),
    dateIdx: index("tournaments_date_idx").on(t.startDate),
    mvpPlayerIdx: index("tournaments_mvp_player_idx").on(t.mvpPlayerId),
  }),
);

export type Tournament = typeof tournaments.$inferSelect;

// ---------------------------------------------------------------------------
// Matches (any number per tournament)
// ---------------------------------------------------------------------------
export const matches = mysqlTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }).notNull(),
    matchNumber: int("matchNumber").notNull(),
    mapId: bigint("mapId", { mode: "number", unsigned: true }),
    mapName: varchar("mapName", { length: 128 }),
    specialMoment: varchar("specialMoment", { length: 255 }),
    placementPoints: int("placementPoints").notNull().default(0),
    finishPoints: int("finishPoints").notNull().default(0),
    totalPoints: int("totalPoints").notNull().default(0),
    officialTotalPoints: int("officialTotalPoints"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tournamentIdx: index("matches_tournament_idx").on(t.tournamentId),
    mapIdx: index("matches_map_idx").on(t.mapId),
  }),
);

export type Match = typeof matches.$inferSelect;

// ---------------------------------------------------------------------------
// Global map library (upload once, reuse across matches)
// ---------------------------------------------------------------------------
export const maps = mysqlTable(
  "maps",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    imageKey: varchar("imageKey", { length: 512 }),
    displayOrder: int("displayOrder").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    orderIdx: index("maps_order_idx").on(t.displayOrder),
  }),
);

export type GameMap = typeof maps.$inferSelect;

// ---------------------------------------------------------------------------
// Per-player match performance
// ---------------------------------------------------------------------------
export const matchPlayers = mysqlTable(
  "match_players",
  {
    id: serial("id").primaryKey(),
    matchId: bigint("matchId", { mode: "number", unsigned: true }).notNull(),
    playerId: bigint("playerId", { mode: "number", unsigned: true }).notNull(),
    lineupStatus: mysqlEnum("lineupStatus", ["played", "bench", "dnp"])
      .notNull()
      .default("played"),
    kills: int("kills").notNull().default(0),
    placement: int("placement"),
    placementPoints: int("placementPoints").notNull().default(0),
    finishPoints: int("finishPoints").notNull().default(0),
    totalPoints: int("totalPoints").notNull().default(0),
    officialTotalPoints: int("officialTotalPoints"),
    specialMoment: varchar("specialMoment", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    matchIdx: index("mp_match_idx").on(t.matchId),
    playerIdx: index("mp_player_idx").on(t.playerId),
  }),
);

export type MatchPlayer = typeof matchPlayers.$inferSelect;

// ---------------------------------------------------------------------------
// Media library
// ---------------------------------------------------------------------------
export const media = mysqlTable(
  "media",
  {
    id: serial("id").primaryKey(),
    fileKey: varchar("fileKey", { length: 512 }).notNull(),
    fileName: varchar("fileName", { length: 512 }).notNull(),
    category: mysqlEnum("category", [
      "team-logos",
      "player-photos",
      "owner-photos",
      "tournament-logos",
      "point-tables",
      "achievement-images",
      "card-artwork",
      "user-avatars",
      "team-media",
      "other",
    ])
      .notNull()
      .default("other"),
    size: int("size").notNull().default(0),
    contentType: varchar("contentType", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    keyIdx: uniqueIndex("media_key_idx").on(t.fileKey),
    catIdx: index("media_category_idx").on(t.category),
  }),
);

export type Media = typeof media.$inferSelect;

// ---------------------------------------------------------------------------
// Media gallery — the TSG Media Page content.
// Each row is one gallery entry: an uploaded photo/video, a YouTube link,
// or a Google Drive share link. Optional team/tournament association and
// TSG ARMY / TSG ARTEMIS tagging.
// ---------------------------------------------------------------------------
export const mediaItems = mysqlTable(
  "media_items",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // What kind of entry this is.
    type: mysqlEnum("type", ["photo", "video", "youtube", "drive"])
      .notNull()
      .default("photo"),
    // Uploaded file (photo/video) — key into the media library / storage.
    fileKey: varchar("fileKey", { length: 512 }),
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    // YouTube video id (when type = "youtube").
    youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
    // Google Drive file id / share url (when type = "drive").
    driveUrl: varchar("driveUrl", { length: 1024 }),
    // Optional categorization.
    category: varchar("category", { length: 128 }),
    // Optional associations.
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }),
    // Parent album (when grouped into an album).
    albumId: bigint("albumId", { mode: "number", unsigned: true }),
    // TSG ARMY / TSG ARTEMIS tagging (stored as JSON array of strings).
    tags: text("tags"),
    // Gallery presentation.
    featured: boolean("featured").default(false).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    // Explicit upload date (defaults to creation).
    uploadDate: timestamp("uploadDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    activeIdx: index("media_items_active_idx").on(t.isActive),
    featuredIdx: index("media_items_featured_idx").on(t.featured),
    teamIdx: index("media_items_team_idx").on(t.teamId),
    tournamentIdx: index("media_items_tournament_idx").on(t.tournamentId),
    albumIdx: index("media_items_album_idx").on(t.albumId),
    orderIdx: index("media_items_order_idx").on(t.displayOrder),
  }),
);

export type MediaItem = typeof mediaItems.$inferSelect;

// ---------------------------------------------------------------------------
// Media Albums — folders that group media items together.
// An album has a title, description, event date, category, optional
// team/tournament, tags, a custom cover image, and a published/draft
// status. Albums work on the global Media Page and on team media
// sections without duplicating media records.
// ---------------------------------------------------------------------------
export const mediaAlbums = mysqlTable(
  "media_albums",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // Event date shown on the album card.
    eventDate: timestamp("eventDate"),
    // Optional categorization.
    category: varchar("category", { length: 128 }),
    // Optional associations.
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }),
    // TSG ARMY / TSG ARTEMIS tagging (JSON array of strings).
    tags: text("tags"),
    // Custom cover / preview image (storage key).
    coverKey: varchar("coverKey", { length: 512 }),
    // published | draft
    status: mysqlEnum("status", ["published", "draft"]).notNull().default("draft"),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("media_albums_status_idx").on(t.status),
    teamIdx: index("media_albums_team_idx").on(t.teamId),
    tournamentIdx: index("media_albums_tournament_idx").on(t.tournamentId),
    orderIdx: index("media_albums_order_idx").on(t.displayOrder),
  }),
);

export type MediaAlbum = typeof mediaAlbums.$inferSelect;

// ---------------------------------------------------------------------------
// Album links — multiple editable, labeled links per album
// (e.g. "Watch Full Match", "Tournament Results", "Download Photos").
// ---------------------------------------------------------------------------
export const mediaAlbumLinks = mysqlTable(
  "media_album_links",
  {
    id: serial("id").primaryKey(),
    albumId: bigint("albumId", { mode: "number", unsigned: true }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    displayOrder: int("displayOrder").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    albumIdx: index("media_album_links_album_idx").on(t.albumId),
  }),
);

export type MediaAlbumLink = typeof mediaAlbumLinks.$inferSelect;

// ---------------------------------------------------------------------------
// Media page configuration — every optional feature of the public Media
// Page is individually enableable/disableable from the Admin Panel.
// Stored as a single JSON blob so new toggles can be added without a
// schema migration.
// ---------------------------------------------------------------------------
export const mediaPageConfig = mysqlTable(
  "media_page_config",
  {
    id: serial("id").primaryKey(),
    // JSON object of feature flags (see MEDIA_PAGE_DEFAULT_CONFIG).
    config: text("config").notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export type MediaPageConfig = typeof mediaPageConfig.$inferSelect;

// ---------------------------------------------------------------------------
// Community comments (per tournament)
// ---------------------------------------------------------------------------
export const comments = mysqlTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    parentId: bigint("parentId", { mode: "number", unsigned: true }),
    content: text("content").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tournamentIdx: index("comments_tournament_idx").on(t.tournamentId),
    userIdx: index("comments_user_idx").on(t.userId),
    hiddenCreatedIdx: index("comments_hidden_created_idx").on(t.hidden, t.createdAt),
  }),
);

export type Comment = typeof comments.$inferSelect;

export const commentReactions = mysqlTable(
  "comment_reactions",
  {
    id: serial("id").primaryKey(),
    commentId: bigint("commentId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("reaction_comment_user_idx").on(t.commentId, t.userId),
    commentIdx: index("reaction_comment_idx").on(t.commentId),
  }),
);

export type CommentReaction = typeof commentReactions.$inferSelect;

export const achievements = mysqlTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    iconKey: varchar("iconKey", { length: 512 }),
    badge: varchar("badge", { length: 128 }),
    tag: varchar("tag", { length: 64 }),
    category: varchar("category", { length: 128 }),
    requirementType: mysqlEnum("requirementType", ["xp_milestone", "login_streak", "quiz_completion", "task_completion", "manual"]).default("manual"),
    requirementValue: int("requirementValue"),
    xpReward: int("xpReward").default(0).notNull(),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    categoryIdx: index("achievements_category_idx").on(t.category),
    activeIdx: index("achievements_active_idx").on(t.isActive),
  }),
);

export type Achievement = typeof achievements.$inferSelect;

export const playerAchievements = mysqlTable(
  "player_achievements",
  {
    id: serial("id").primaryKey(),
    playerId: bigint("playerId", { mode: "number", unsigned: true }).notNull(),
    achievementId: bigint("achievementId", { mode: "number", unsigned: true }),
    customTitle: varchar("customTitle", { length: 255 }),
    earnedAt: timestamp("earnedAt").notNull(),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }),
    matchId: bigint("matchId", { mode: "number", unsigned: true }),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    playerIdx: index("pa_player_idx").on(t.playerId),
    achievementIdx: index("pa_achievement_idx").on(t.achievementId),
    tournamentIdx: index("pa_tournament_idx").on(t.tournamentId),
    matchIdx: index("pa_match_idx").on(t.matchId),
    uniqueKey: uniqueIndex("pa_player_achievement_unique").on(
      t.playerId,
      t.achievementId,
      t.tournamentId,
      t.matchId,
    ),
  }),
);

export type PlayerAchievement = typeof playerAchievements.$inferSelect;

// ---------------------------------------------------------------------------
// User achievements (fan/user-level achievement tracking)
// ---------------------------------------------------------------------------
export const userAchievements = mysqlTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    achievementId: bigint("achievementId", { mode: "number", unsigned: true }).notNull(),
    earnedAt: timestamp("earnedAt").defaultNow().notNull(),
    progress: int("progress").default(0).notNull(),
    metadata: text("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("ua_user_idx").on(t.userId),
    achievementIdx: index("ua_achievement_idx").on(t.achievementId),
    uniqueKey: uniqueIndex("ua_user_achievement_unique").on(t.userId, t.achievementId),
  }),
);

export type UserAchievement = typeof userAchievements.$inferSelect;

export const teamAchievements = mysqlTable(
  "team_achievements",
  {
    id: serial("id").primaryKey(),
    teamId: bigint("teamId", { mode: "number", unsigned: true }).notNull(),
    achievementId: bigint("achievementId", { mode: "number", unsigned: true }),
    customTitle: varchar("customTitle", { length: 255 }),
    earnedAt: timestamp("earnedAt").notNull(),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }),
    metadata: text("metadata"),
    placement: int("placement"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    teamIdx: index("ta_team_idx").on(t.teamId),
    achievementIdx: index("ta_achievement_idx").on(t.achievementId),
    tournamentIdx: index("ta_tournament_idx").on(t.tournamentId),
    uniqueKey: uniqueIndex("ta_team_achievement_unique").on(
      t.teamId,
      t.achievementId,
      t.tournamentId,
    ),
  }),
);

export type TeamAchievement = typeof teamAchievements.$inferSelect;

// ---------------------------------------------------------------------------
// Daily Login Streaks
// ---------------------------------------------------------------------------
export const userStreaks = mysqlTable(
  "user_streaks",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    currentStreak: int("currentStreak").notNull().default(0),
    longestStreak: int("longestStreak").notNull().default(0),
    lastLoginDate: timestamp("lastLoginDate"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: uniqueIndex("user_streaks_user_idx").on(t.userId),
  }),
);

export type UserStreak = typeof userStreaks.$inferSelect;

// ---------------------------------------------------------------------------
// Tournament Match Predictions
// ---------------------------------------------------------------------------
export const predictions = mysqlTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    tournamentId: bigint("tournamentId", { mode: "number", unsigned: true }).notNull(),
    question: text("question").notNull(),
    xpReward: int("xpReward").notNull().default(0),
    status: mysqlEnum("status", ["open", "closed", "answered"])
      .notNull()
      .default("open"),
    closesAt: timestamp("closesAt").notNull(),
    timerSeconds: int("timerSeconds"),
    correctOptionId: bigint("correctOptionId", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    tournamentIdx: index("predictions_tournament_idx").on(t.tournamentId),
    statusIdx: index("predictions_status_idx").on(t.status),
    closesAtIdx: index("predictions_closes_at_idx").on(t.closesAt),
  }),
);

export type Prediction = typeof predictions.$inferSelect;

export const predictionOptions = mysqlTable(
  "prediction_options",
  {
    id: serial("id").primaryKey(),
    predictionId: bigint("predictionId", { mode: "number", unsigned: true }).notNull(),
    text: varchar("text", { length: 255 }).notNull(),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    predictionIdx: index("prediction_options_prediction_idx").on(t.predictionId),
  }),
);

export type PredictionOption = typeof predictionOptions.$inferSelect;

export const predictionVotes = mysqlTable(
  "prediction_votes",
  {
    id: serial("id").primaryKey(),
    predictionId: bigint("predictionId", { mode: "number", unsigned: true }).notNull(),
    optionId: bigint("optionId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("prediction_votes_uniq_idx").on(t.predictionId, t.userId),
    predictionIdx: index("prediction_votes_prediction_idx").on(t.predictionId),
    userIdx: index("prediction_votes_user_idx").on(t.userId),
  }),
);

export type PredictionVote = typeof predictionVotes.$inferSelect;

// ---------------------------------------------------------------------------
// TSG Quiz
// ---------------------------------------------------------------------------
export const quizQuestions = mysqlTable(
  "quiz_questions",
  {
    id: serial("id").primaryKey(),
    question: text("question").notNull(),
    xpReward: int("xpReward").notNull().default(0),
    cardRewardId: bigint("cardRewardId", { mode: "number", unsigned: true }),
    timerSeconds: int("timerSeconds"),
    isActive: boolean("isActive").notNull().default(true),
    imageKey: varchar("imageKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    activeIdx: index("quiz_questions_active_idx").on(t.isActive),
    cardRewardIdx: index("quiz_questions_card_reward_idx").on(t.cardRewardId),
  }),
);

export type QuizQuestion = typeof quizQuestions.$inferSelect;

export const quizOptions = mysqlTable(
  "quiz_options",
  {
    id: serial("id").primaryKey(),
    questionId: bigint("questionId", { mode: "number", unsigned: true }).notNull(),
    text: varchar("text", { length: 255 }).notNull(),
    isCorrect: boolean("isCorrect").notNull().default(false),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    questionIdx: index("quiz_options_question_idx").on(t.questionId),
  }),
);

export type QuizOption = typeof quizOptions.$inferSelect;

export const quizAttempts = mysqlTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    questionId: bigint("questionId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    optionId: bigint("optionId", { mode: "number", unsigned: true }).notNull(),
    isCorrect: boolean("isCorrect").notNull(),
    xpAwarded: int("xpAwarded").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("quiz_attempts_uniq_idx").on(t.questionId, t.userId),
    questionIdx: index("quiz_attempts_question_idx").on(t.questionId),
    userIdx: index("quiz_attempts_user_idx").on(t.userId),
  }),
);

export type QuizAttempt = typeof quizAttempts.$inferSelect;

// ---------------------------------------------------------------------------
// Guess the Player
// ---------------------------------------------------------------------------
export const guessPlayerQuestions = mysqlTable(
  "guess_player_questions",
  {
    id: serial("id").primaryKey(),
    question: text("question").notNull(),
    xpReward: int("xpReward").notNull().default(0),
    timerSeconds: int("timerSeconds"),
    correctPersonId: bigint("correctPersonId", { mode: "number", unsigned: true }).notNull(),
    personKind: mysqlEnum("personKind", ["owner", "legend", "player", "staff"])
      .notNull()
      .default("player"),
    isActive: boolean("isActive").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    activeIdx: index("guess_player_questions_active_idx").on(t.isActive),
  }),
);

export type GuessPlayerQuestion = typeof guessPlayerQuestions.$inferSelect;

export const guessPlayerOptions = mysqlTable(
  "guess_player_options",
  {
    id: serial("id").primaryKey(),
    questionId: bigint("questionId", { mode: "number", unsigned: true }).notNull(),
    personId: bigint("personId", { mode: "number", unsigned: true }).notNull(),
    personKind: mysqlEnum("personKind", ["owner", "legend", "player", "staff"])
      .notNull()
      .default("player"),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    questionIdx: index("guess_player_options_question_idx").on(t.questionId),
  }),
);

export type GuessPlayerOption = typeof guessPlayerOptions.$inferSelect;

export const guessPlayerAttempts = mysqlTable(
  "guess_player_attempts",
  {
    id: serial("id").primaryKey(),
    questionId: bigint("questionId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    optionId: bigint("optionId", { mode: "number", unsigned: true }).notNull(),
    isCorrect: boolean("isCorrect").notNull(),
    xpAwarded: int("xpAwarded").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("guess_player_attempts_uniq_idx").on(t.questionId, t.userId),
    questionIdx: index("guess_player_attempts_question_idx").on(t.questionId),
    userIdx: index("guess_player_attempts_user_idx").on(t.userId),
  }),
);

export type GuessPlayerAttempt = typeof guessPlayerAttempts.$inferSelect;

// ---------------------------------------------------------------------------
// XP Tasks (One-time tasks like follow Instagram, subscribe YouTube, etc.)
// ---------------------------------------------------------------------------
export const xpTasks = mysqlTable(
  "xp_tasks",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    actionUrl: varchar("actionUrl", { length: 1024 }),
    xpReward: int("xpReward").notNull().default(0),
    isActive: boolean("isActive").notNull().default(true),
    displayOrder: int("displayOrder").notNull().default(0),
    deadlineAt: timestamp("deadlineAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    activeIdx: index("xp_tasks_active_idx").on(t.isActive),
  }),
);

export type XpTask = typeof xpTasks.$inferSelect;

export const userTaskCompletions = mysqlTable(
  "user_task_completions",
  {
    id: serial("id").primaryKey(),
    taskId: bigint("taskId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    xpAwarded: int("xpAwarded").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("user_task_completions_uniq_idx").on(t.taskId, t.userId),
    taskIdx: index("user_task_completions_task_idx").on(t.taskId),
    userIdx: index("user_task_completions_user_idx").on(t.userId),
  }),
);

export type UserTaskCompletion = typeof userTaskCompletions.$inferSelect;

// ---------------------------------------------------------------------------
// Weekly Top Fan
// ---------------------------------------------------------------------------
export const weeklyTopFan = mysqlTable(
  "weekly_top_fan",
  {
    id: serial("id").primaryKey(),
    weekStart: timestamp("weekStart").notNull(),
    weekEnd: timestamp("weekEnd").notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    userXp: int("userXp").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    weekIdx: uniqueIndex("weekly_top_fan_week_idx").on(t.weekStart),
    userIdx: index("weekly_top_fan_user_idx").on(t.userId),
  }),
);

export type WeeklyTopFan = typeof weeklyTopFan.$inferSelect;

// ---------------------------------------------------------------------------
// TSG Fan Card Collection
// ---------------------------------------------------------------------------
export const cards = mysqlTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageKey: varchar("imageKey", { length: 512 }),
    category: mysqlEnum("category", ["common", "rare", "epic", "legendary", "event", "exclusive"])
      .default("common")
      .notNull(),
    totalSupply: int("totalSupply").notNull(),
    claimedSupply: int("claimedSupply").notNull().default(0),
    unlockMethod: varchar("unlockMethod", { length: 64 }).notNull(),
    unlockRequirement: varchar("unlockRequirement", { length: 255 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugIdx: uniqueIndex("cards_slug_idx").on(t.slug),
    categoryIdx: index("cards_category_idx").on(t.category),
    activeIdx: index("cards_active_idx").on(t.isActive),
  }),
);

export type Card = typeof cards.$inferSelect;
export type InsertCard = typeof cards.$inferInsert;

// ---------------------------------------------------------------------------
// Streak milestones → card rewards
// ---------------------------------------------------------------------------
export const streakCardRewards = mysqlTable(
  "streak_card_rewards",
  {
    id: serial("id").primaryKey(),
    streakDays: int("streakDays").notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    streakIdx: uniqueIndex("streak_card_rewards_streak_idx").on(t.streakDays),
    cardIdx: index("streak_card_rewards_card_idx").on(t.cardId),
  }),
);

export type StreakCardReward = typeof streakCardRewards.$inferSelect;

// ---------------------------------------------------------------------------
// XP milestones → card rewards
// ---------------------------------------------------------------------------
export const xpCardMilestones = mysqlTable(
  "xp_card_milestones",
  {
    id: serial("id").primaryKey(),
    xpThreshold: int("xpThreshold").notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    xpIdx: uniqueIndex("xp_card_milestones_threshold_idx").on(t.xpThreshold),
    cardIdx: index("xp_card_milestones_card_idx").on(t.cardId),
  }),
);

export type XpCardMilestone = typeof xpCardMilestones.$inferSelect;

// ---------------------------------------------------------------------------
// Achievement → card rewards (one achievement can optionally reward a card)
// ---------------------------------------------------------------------------
export const achievementCardRewards = mysqlTable(
  "achievement_card_rewards",
  {
    id: serial("id").primaryKey(),
    achievementId: bigint("achievementId", { mode: "number", unsigned: true }).notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    achievementIdx: uniqueIndex("acr_achievement_idx").on(t.achievementId),
    cardIdx: index("acr_card_idx").on(t.cardId),
  }),
);

export type AchievementCardReward = typeof achievementCardRewards.$inferSelect;

// ---------------------------------------------------------------------------
// User card collection (each user's holdings)
// ---------------------------------------------------------------------------
export const userCards = mysqlTable(
  "user_cards",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    quantity: int("quantity").notNull().default(1),
    copyNumber: int("copyNumber").notNull().default(1),
    acquiredAt: timestamp("acquiredAt").defaultNow().notNull(),
    source: varchar("source", { length: 255 }),
    revoked: boolean("revoked").default(false).notNull(),
    revokedAt: timestamp("revokedAt"),
    revokedById: bigint("revokedById", { mode: "number", unsigned: true }),
    revokeReason: text("revokeReason"),
  },
  (t) => ({
    userCardIdx: index("user_cards_user_card_idx").on(t.userId, t.cardId),
    userCardCopyIdx: uniqueIndex("user_cards_user_card_copy_idx").on(t.userId, t.cardId, t.copyNumber),
    userIdx: index("user_cards_user_idx").on(t.userId),
    cardIdx: index("user_cards_card_idx").on(t.cardId),
  }),
);

export type UserCard = typeof userCards.$inferSelect;

// ---------------------------------------------------------------------------
// Card grant history (audit trail)
// ---------------------------------------------------------------------------
export const cardGrants = mysqlTable(
  "card_grants",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    quantity: int("quantity").notNull(),
    source: varchar("source", { length: 255 }).notNull(),
    note: text("note"),
    grantedById: bigint("grantedById", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("card_grants_user_idx").on(t.userId),
    cardIdx: index("card_grants_card_idx").on(t.cardId),
    grantedByIdx: index("card_grants_granted_by_idx").on(t.grantedById),
  }),
);

export type CardGrant = typeof cardGrants.$inferSelect;

// ---------------------------------------------------------------------------
// Card events (audit trail for grants / revocations / milestones)
// ---------------------------------------------------------------------------
export const cardEvents = mysqlTable(
  "card_events",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    copyNumber: int("copyNumber").notNull(),
    action: mysqlEnum("action", ["grant", "revoke", "milestone_grant", "streak_claim", "xp_milestone", "achievement"]).notNull(),
    reason: text("reason"),
    performedById: bigint("performedById", { mode: "number", unsigned: true }),
    source: varchar("source", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("card_events_user_idx").on(t.userId),
    cardIdx: index("card_events_card_idx").on(t.cardId),
    performedByIdx: index("card_events_performed_by_idx").on(t.performedById),
  }),
);

export type CardEvent = typeof cardEvents.$inferSelect;

// ---------------------------------------------------------------------------
// Milestone reward tracking (prevent duplicate milestone rewards per user)
// ---------------------------------------------------------------------------
export const milestoneRewards = mysqlTable(
  "milestone_rewards",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    rewardType: mysqlEnum("rewardType", ["streak", "xp", "achievement"]).notNull(),
    rewardId: int("rewardId").notNull(),
    cardId: bigint("cardId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userRewardIdx: uniqueIndex("milestone_rewards_user_type_id_idx").on(
      t.userId,
      t.rewardType,
      t.rewardId,
    ),
    userIdx: index("milestone_rewards_user_idx").on(t.userId),
  }),
);

// ---------------------------------------------------------------------------
// Player Highlights / Clutch Moments
// ---------------------------------------------------------------------------
export const playerHighlights = mysqlTable(
  "player_highlights",
  {
    id: serial("id").primaryKey(),
    playerId: bigint("playerId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    videoType: mysqlEnum("videoType", ["youtube", "upload"]).notNull(),
    youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
    videoKey: varchar("videoKey", { length: 512 }),
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    views: int("views").default(0).notNull(),
    likes: int("likes").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    playerIdx: index("player_highlights_player_idx").on(t.playerId),
    userIdx: index("player_highlights_user_idx").on(t.userId),
    activeIdx: index("player_highlights_active_idx").on(t.isActive),
    createdIdx: index("player_highlights_created_idx").on(t.createdAt),
  }),
);

export type PlayerHighlight = typeof playerHighlights.$inferSelect;

export const highlightComments = mysqlTable(
  "highlight_comments",
  {
    id: serial("id").primaryKey(),
    highlightId: bigint("highlightId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    parentId: bigint("parentId", { mode: "number", unsigned: true }),
    content: text("content").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    highlightIdx: index("highlight_comments_highlight_idx").on(t.highlightId),
    userIdx: index("highlight_comments_user_idx").on(t.userId),
    parentIdx: index("highlight_comments_parent_idx").on(t.parentId),
  }),
);

export type HighlightComment = typeof highlightComments.$inferSelect;

export const highlightCommentReactions = mysqlTable(
  "highlight_comment_reactions",
  {
    id: serial("id").primaryKey(),
    commentId: bigint("commentId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("highlight_reaction_comment_user_idx").on(t.commentId, t.userId),
    commentIdx: index("highlight_reaction_comment_idx").on(t.commentId),
  }),
);

export type HighlightCommentReaction = typeof highlightCommentReactions.$inferSelect;

export const highlightLikes = mysqlTable(
  "highlight_likes",
  {
    id: serial("id").primaryKey(),
    highlightId: bigint("highlightId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    uniq: uniqueIndex("highlight_likes_uniq_idx").on(t.highlightId, t.userId),
    highlightIdx: index("highlight_likes_highlight_idx").on(t.highlightId),
    userIdx: index("highlight_likes_user_idx").on(t.userId),
  }),
);

export type HighlightLike = typeof highlightLikes.$inferSelect;

// ---------------------------------------------------------------------------
// Unified Notification System
// ---------------------------------------------------------------------------

/**
 * Notification type definitions — the ONLY notification types that exist.
 * Admin can activate/deactivate each type and choose automatic vs manual.
 * Each type can have a default template and override fields for fully
 * customizable notification appearance and behavior.
 */
export const notificationTypes = mysqlTable(
  "notification_types",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 64 }),
    isActive: boolean("isActive").default(true).notNull(),
    isAutomatic: boolean("isAutomatic").default(false).notNull(),
    defaultTemplateId: bigint("defaultTemplateId", { mode: "number", unsigned: true }),
    titleTemplate: varchar("titleTemplate", { length: 255 }),
    messageTemplate: text("messageTemplate"),
    imageKey: varchar("imageKey", { length: 512 }),
    priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
    linkUrl: varchar("linkUrl", { length: 1024 }),
    linkLabel: varchar("linkLabel", { length: 128 }),
    buttonStyle: mysqlEnum("buttonStyle", ["primary", "outline", "ghost"]).default("primary").notNull(),
    buttonIcon: varchar("buttonIcon", { length: 64 }),
    youtubeEnabled: boolean("youtubeEnabled").default(false).notNull(),
    youtubeAutoThumbnail: boolean("youtubeAutoThumbnail").default(true).notNull(),
    youtubeCustomThumbnailKey: varchar("youtubeCustomThumbnailKey", { length: 512 }),
    layout: mysqlEnum("layout", ["compact", "card", "banner"]).default("compact").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    slugIdx: uniqueIndex("notification_types_slug_idx").on(t.slug),
    activeIdx: index("notification_types_active_idx").on(t.isActive),
    defaultTemplateIdx: index("notification_types_default_template_idx").on(t.defaultTemplateId),
  }),
);

export type NotificationType = typeof notificationTypes.$inferSelect;

/**
 * Notification Templates — reusable, customizable templates for each
 * notification type. Admins create/edit/duplicate/preview/archive/send.
 */
export const notificationTemplates = mysqlTable(
  "notification_templates",
  {
    id: serial("id").primaryKey(),
    notificationTypeId: bigint("notificationTypeId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    isDefault: boolean("isDefault").default(false).notNull(),
    isArchived: boolean("isArchived").default(false).notNull(),
    titleTemplate: varchar("titleTemplate", { length: 255 }).notNull(),
    messageTemplate: text("messageTemplate").notNull(),
    imageKey: varchar("imageKey", { length: 512 }),
    priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
    linkUrl: varchar("linkUrl", { length: 1024 }),
    linkLabel: varchar("linkLabel", { length: 128 }),
    buttonStyle: mysqlEnum("buttonStyle", ["primary", "outline", "ghost"]).default("primary").notNull(),
    buttonIcon: varchar("buttonIcon", { length: 64 }),
    youtubeEnabled: boolean("youtubeEnabled").default(false).notNull(),
    youtubeAutoThumbnail: boolean("youtubeAutoThumbnail").default(true).notNull(),
    youtubeCustomThumbnailKey: varchar("youtubeCustomThumbnailKey", { length: 512 }),
    layout: mysqlEnum("layout", ["compact", "card", "banner"]).default("compact").notNull(),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    typeIdx: index("notification_templates_type_idx").on(t.notificationTypeId),
    defaultIdx: index("notification_templates_default_idx").on(t.notificationTypeId, t.isDefault),
    archivedIdx: index("notification_templates_archived_idx").on(t.isArchived),
  }),
);

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;

/**
 * Announcements — admin-created messages with rich content, targeting, and scheduling.
 * Enhanced with button styles, YouTube support, and layout options.
 */
export const announcements = mysqlTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    imageKey: varchar("imageKey", { length: 512 }),
    priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
    buttonStyle: mysqlEnum("buttonStyle", ["primary", "outline", "ghost"]).default("primary").notNull(),
    buttonIcon: varchar("buttonIcon", { length: 64 }),
    youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
    youtubeAutoThumbnail: boolean("youtubeAutoThumbnail").default(true).notNull(),
    youtubeCustomThumbnailKey: varchar("youtubeCustomThumbnailKey", { length: 512 }),
    layout: mysqlEnum("layout", ["compact", "card", "banner"]).default("compact").notNull(),
    status: mysqlEnum("status", ["draft", "scheduled", "published", "archived"]).default("draft").notNull(),
    scheduledAt: timestamp("scheduledAt"),
    publishedAt: timestamp("publishedAt"),
    targetType: mysqlEnum("targetType", ["everyone", "role", "users"]).default("everyone").notNull(),
    targetRole: varchar("targetRole", { length: 64 }),
    createdById: bigint("createdById", { mode: "number", unsigned: true }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("announcements_status_idx").on(t.status),
    priorityIdx: index("announcements_priority_idx").on(t.priority),
    activeIdx: index("announcements_active_idx").on(t.isActive),
    createdByIdIdx: index("announcements_created_by_idx").on(t.createdById),
  }),
);

export type Announcement = typeof announcements.$inferSelect;

/**
 * Announcement links — multiple links with custom button text, style, and icon.
 */
export const announcementLinks = mysqlTable(
  "announcement_links",
  {
    id: serial("id").primaryKey(),
    announcementId: bigint("announcementId", { mode: "number", unsigned: true }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    label: varchar("label", { length: 128 }).notNull(),
    buttonStyle: mysqlEnum("buttonStyle", ["primary", "outline", "ghost"]).default("primary").notNull(),
    icon: varchar("icon", { length: 64 }),
    displayOrder: int("displayOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    announcementIdx: index("announcement_links_announcement_idx").on(t.announcementId),
    orderIdx: index("announcement_links_order_idx").on(t.displayOrder),
  }),
);

export type AnnouncementLink = typeof announcementLinks.$inferSelect;

/**
 * Announcement targeting — when targetType is "users", this lists the targeted user IDs.
 */
export const announcementTargets = mysqlTable(
  "announcement_targets",
  {
    id: serial("id").primaryKey(),
    announcementId: bigint("announcementId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    announcementIdx: index("announcement_targets_announcement_idx").on(t.announcementId),
    userIdx: index("announcement_targets_user_idx").on(t.userId),
    uniq: uniqueIndex("announcement_targets_uniq_idx").on(t.announcementId, t.userId),
  }),
);

export type AnnouncementTarget = typeof announcementTargets.$inferSelect;

/**
 * Notifications — the unified notification record delivered to each user.
 * One row per user per notification event.
 */
export const notifications = mysqlTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    notificationTypeId: bigint("notificationTypeId", { mode: "number", unsigned: true }).notNull(),
    templateId: bigint("templateId", { mode: "number", unsigned: true }),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    imageKey: varchar("imageKey", { length: 512 }),
    linkUrl: varchar("linkUrl", { length: 1024 }),
    linkLabel: varchar("linkLabel", { length: 128 }),
    youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
    youtubeThumbnailUrl: varchar("youtubeThumbnailUrl", { length: 1024 }),
    layout: mysqlEnum("layout", ["compact", "card", "banner"]).default("compact").notNull(),
    priority: mysqlEnum("priority", ["normal", "important", "urgent"]).default("normal").notNull(),
    isRead: boolean("isRead").default(false).notNull(),
    readAt: timestamp("readAt"),
    clickedAt: timestamp("clickedAt"),
    sourceType: varchar("sourceType", { length: 64 }),
    sourceId: varchar("sourceId", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    typeIdx: index("notifications_type_idx").on(t.notificationTypeId),
    templateIdx: index("notifications_template_idx").on(t.templateId),
    readIdx: index("notifications_read_idx").on(t.isRead),
    userReadIdx: index("notifications_user_read_idx").on(t.userId, t.isRead),
  }),
);

export type Notification = typeof notifications.$inferSelect;

// ---------------------------------------------------------------------------
// Fan Spotlight — community creator recognition.
// Showcases fan edits, art, videos, reels and other creative contributions.
// Admins manage entries via the admin panel — no public submission.
// ---------------------------------------------------------------------------
export const fanSpotlight = mysqlTable(
  "fan_spotlight",
  {
    id: serial("id").primaryKey(),
    // The fan who created this work (links to platform users, optional for external creators).
    userId: bigint("userId", { mode: "number", unsigned: true }),
    // Display name for the creator (overrides user name when set).
    fanName: varchar("fanName", { length: 255 }),
    // Optional profile link for the creator.
    creatorProfileUrl: varchar("creatorProfileUrl", { length: 1024 }),
    // Title of the work.
    title: varchar("title", { length: 255 }).notNull(),
    // Optional subtitle / tagline.
    subtitle: varchar("subtitle", { length: 255 }),
    // Short description / caption.
    description: text("description"),
    // Category of the work.
    category: varchar("category", { length: 128 }),
    // Comma-separated tags.
    tags: text("tags"),
    // Original content URL (YouTube, Instagram, Twitter, etc.).
    contentUrl: varchar("contentUrl", { length: 1024 }),
    // YouTube video ID (when the content is a YouTube video, for embedding).
    youtubeVideoId: varchar("youtubeVideoId", { length: 64 }),
    // Optional embed URL (iframe-compatible).
    embedUrl: varchar("embedUrl", { length: 1024 }),
    // Optional thumbnail image — either a storage key (tsg/media/...),
    // or an external URL (YouTube thumbnail, Instagram preview, etc.).
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
    // Optional media_items reference for selecting an existing media image.
    mediaItemId: bigint("mediaItemId", { mode: "number", unsigned: true }),
    // Optional additional image keys (comma-separated storage keys).
    additionalImageKeys: text("additionalImageKeys"),
    // Custom button text (defaults to "Watch Original").
    buttonText: varchar("buttonText", { length: 128 }),
    // Custom button URL (defaults to contentUrl).
    buttonUrl: varchar("buttonUrl", { length: 1024 }),
    // Optional accent color override (hex).
    accentColor: varchar("accentColor", { length: 16 }),
    // Card display style.
    cardStyle: mysqlEnum("cardStyle", ["grid", "card", "banner"])
      .default("card")
      .notNull(),
    // Is this entry approved and visible on the public page?
    isApproved: boolean("isApproved").default(false).notNull(),
    // Is this the "main" / primary featured work on the spotlight page?
    isFeatured: boolean("isFeatured").default(false).notNull(),
    // Display order for the curated spotlight grid.
    displayOrder: int("displayOrder").default(0).notNull(),
    // Optional publish date (for scheduling).
    publishDate: timestamp("publishDate"),
    // Submission status.
    status: mysqlEnum("status", ["draft", "pending", "approved", "rejected"])
      .notNull()
      .default("draft"),
    // Admin moderation notes (internal only).
    adminNotes: text("adminNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("fan_spotlight_user_idx").on(t.userId),
    mediaItemIdx: index("fan_spotlight_media_idx").on(t.mediaItemId),
    approvedIdx: index("fan_spotlight_approved_idx").on(t.isApproved),
    featuredIdx: index("fan_spotlight_featured_idx").on(t.isFeatured),
    statusIdx: index("fan_spotlight_status_idx").on(t.status),
    orderIdx: index("fan_spotlight_order_idx").on(t.displayOrder),
    publishDateIdx: index("fan_spotlight_publish_date_idx").on(t.publishDate),
  }),
);

export type FanSpotlight = typeof fanSpotlight.$inferSelect;

// ---------------------------------------------------------------------------
// Live Links — stream platform URLs managed by players/owners/staff
// ---------------------------------------------------------------------------
export const liveLinks = mysqlTable(
  "live_links",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    playerId: bigint("playerId", { mode: "number", unsigned: true }),
    teamId: bigint("teamId", { mode: "number", unsigned: true }),
    ownershipType: mysqlEnum("ownershipType", ["personal", "team"])
      .notNull()
      .default("personal"),
    platform: mysqlEnum("platform", ["youtube", "instagram", "twitch", "discord", "other"])
      .notNull()
      .default("youtube"),
    displayPlatform: varchar("displayPlatform", { length: 64 }),
    liveUrl: varchar("liveUrl", { length: 1024 }).notNull(),
    isLive: boolean("isLive").default(false).notNull(),
    isManuallyLive: boolean("isManuallyLive").default(false).notNull(),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    viewerCount: int("viewerCount").default(0).notNull(),
    thumbnailKey: varchar("thumbnailKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    userIdx: index("live_links_user_idx").on(t.userId),
    playerIdx: index("live_links_player_idx").on(t.playerId),
    teamIdx: index("live_links_team_idx").on(t.teamId),
    platformIdx: index("live_links_platform_idx").on(t.platform),
    liveIdx: index("live_links_is_live_idx").on(t.isLive),
    ownershipIdx: index("live_links_ownership_idx").on(t.ownershipType),
    userPlatformIdx: index("live_links_user_platform_idx").on(t.userId, t.platform),
  }),
);

export type LiveLink = typeof liveLinks.$inferSelect;

// ---------------------------------------------------------------------------
// Comment Reports — users report comments; moderators/admins review
// ---------------------------------------------------------------------------
export const commentReports = mysqlTable(
  "comment_reports",
  {
    id: serial("id").primaryKey(),
    commentId: bigint("commentId", { mode: "number", unsigned: true }).notNull(),
    reporterId: bigint("reporterId", { mode: "number", unsigned: true }).notNull(),
    reason: mysqlEnum("reason", [
      "spam",
      "harassment",
      "inappropriate",
      "offtopic",
      "other",
    ])
      .notNull()
      .default("other"),
    customReason: text("customReason"),
    status: mysqlEnum("status", ["pending", "resolved", "dismissed"])
      .notNull()
      .default("pending"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    commentIdx: index("comment_reports_comment_idx").on(t.commentId),
    reporterIdx: index("comment_reports_reporter_idx").on(t.reporterId),
    statusIdx: index("comment_reports_status_idx").on(t.status),
    uniqReport: uniqueIndex("comment_reports_uniq_idx").on(
      t.commentId,
      t.reporterId,
    ),
  }),
);

export type CommentReport = typeof commentReports.$inferSelect;

// ---------------------------------------------------------------------------
// Notification Rules — trigger notifications when players go live
// Based on platform, role, and target audience
// ---------------------------------------------------------------------------
export const notificationRules = mysqlTable(
  "notification_rules",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    notificationTypeId: bigint("notificationTypeId", {
      mode: "number",
      unsigned: true,
    })
      .notNull()
      .references(() => notificationTypes.id),
    platform: mysqlEnum("platform", ["youtube", "instagram", "twitch", "kick", "facebook", "other", "any"])
      .notNull()
      .default("any"),
    triggerRole: mysqlEnum("triggerRole", ["player", "co-owner", "owner", "staff", "any"])
      .notNull()
      .default("any"),
    ownershipType: mysqlEnum("ownershipType", ["personal", "team", "any"])
      .notNull()
      .default("any"),
    targetType: mysqlEnum("targetType", ["everyone", "role", "users", "followers", "team"])
      .notNull()
      .default("everyone"),
    targetRole: varchar("targetRole", { length: 64 }),
    targetTeamId: bigint("targetTeamId", { mode: "number", unsigned: true }),
    targetUserIds: text("targetUserIds"),
    titleTemplate: varchar("titleTemplate", { length: 255 }),
    messageTemplate: text("messageTemplate"),
    buttonText: varchar("buttonText", { length: 128 }),
    linkLabel: varchar("linkLabel", { length: 128 }),
    emoji: varchar("emoji", { length: 16 }),
    cooldownMinutes: int("cooldownMinutes").default(30).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    typeIdx: index("notification_rules_type_idx").on(t.notificationTypeId),
    platformIdx: index("notification_rules_platform_idx").on(t.platform),
    activeIdx: index("notification_rules_active_idx").on(t.isActive),
    ownershipIdx: index("notification_rules_ownership_idx").on(t.ownershipType),
    teamIdx: index("notification_rules_team_idx").on(t.targetTeamId),
  }),
);

export type NotificationRule = typeof notificationRules.$inferSelect;

// ---------------------------------------------------------------------------
// Notification Rule Logs — track when rules fire and what was sent
// ---------------------------------------------------------------------------
export const notificationRuleLogs = mysqlTable(
  "notification_rule_logs",
  {
    id: serial("id").primaryKey(),
    ruleId: bigint("ruleId", { mode: "number", unsigned: true }).notNull(),
    liveLinkId: bigint("liveLinkId", { mode: "number", unsigned: true }).notNull(),
    triggeredAt: timestamp("triggeredAt").defaultNow().notNull(),
    deliveredCount: int("deliveredCount").default(0).notNull(),
    skipped: boolean("skipped").default(false).notNull(),
    skipReason: text("skipReason"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    ruleIdx: index("notification_rule_logs_rule_idx").on(t.ruleId),
    liveLinkIdx: index("notification_rule_logs_live_link_idx").on(t.liveLinkId),
    createdAtIdx: index("notification_rule_logs_created_idx").on(t.createdAt),
  }),
);

export type NotificationRuleLog = typeof notificationRuleLogs.$inferSelect;

// ---------------------------------------------------------------------------
// Comments (v2) — generic, attachable to any content type
// ---------------------------------------------------------------------------
export const contentComments = mysqlTable(
  "content_comments",
  {
    id: serial("id").primaryKey(),
    refTable: varchar("refTable", { length: 64 }).notNull(),
    refId: bigint("refId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    parentId: bigint("parentId", { mode: "number", unsigned: true }),
    content: text("content").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    likes: int("likes").default(0).notNull(),
    likedByUserIds: text("likedByUserIds"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    refIdx: index("content_comments_ref_idx").on(t.refTable, t.refId, t.hidden),
    userIdx: index("content_comments_user_idx").on(t.userId),
    parentIdx: index("content_comments_parent_idx").on(t.parentId),
    pinnedIdx: index("content_comments_pinned_idx").on(t.refTable, t.refId, t.pinned),
    refCreatedIdx: index("content_comments_ref_created_idx").on(t.refTable, t.refId, t.createdAt),
  }),
);

export type ContentComment = typeof contentComments.$inferSelect;

// Comment reports — users report comments for admin review
export const contentCommentReports = mysqlTable(
  "content_comment_reports",
  {
    id: serial("id").primaryKey(),
    commentId: bigint("commentId", { mode: "number", unsigned: true }).notNull(),
    reporterId: bigint("reporterId", { mode: "number", unsigned: true }).notNull(),
    reason: varchar("reason", { length: 64 }).notNull(),
    customReason: text("customReason"),
    status: mysqlEnum("status", ["pending", "resolved", "dismissed"])
      .default("pending")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    commentIdx: index("content_comment_reports_comment_idx").on(t.commentId),
    reporterIdx: index("content_comment_reports_reporter_idx").on(t.reporterId),
    statusIdx: index("content_comment_reports_status_idx").on(t.status),
  }),
);

export type ContentCommentReport = typeof contentCommentReports.$inferSelect;

// ---------------------------------------------------------------------------
// Sponsored Ads — campaign management
// ---------------------------------------------------------------------------
export const adCampaigns = mysqlTable(
  "ad_campaigns",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    advertiser: varchar("advertiser", { length: 255 }),
    description: text("description"),
    status: mysqlEnum("status", ["draft", "scheduled", "active", "paused", "completed", "cancelled"])
      .default("draft")
      .notNull(),
    placement: mysqlEnum("placement", ["sidebar", "header", "between_media_items", "feed_top", "feed_bottom"])
      .default("sidebar")
      .notNull(),
    targetPages: text("targetPages"),
    budget: int("budget").default(0).notNull(),
    spent: int("spent").default(0).notNull(),
    impressions: int("impressions").default(0).notNull(),
    clicks: int("clicks").default(0).notNull(),
    dismissals: int("dismissals").default(0).notNull(),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    frequencyCap: int("frequencyCap").default(3).notNull(),
    priority: int("priority").default(0).notNull(),
    impressionLimit: int("impressionLimit"),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    statusIdx: index("ad_campaigns_status_idx").on(t.status),
    activeIdx: index("ad_campaigns_active_idx").on(t.isActive),
    datesIdx: index("ad_campaigns_dates_idx").on(t.startDate, t.endDate),
  }),
);

export type AdCampaign = typeof adCampaigns.$inferSelect;

// Ad creatives linked to campaigns
export const adCreatives = mysqlTable(
  "ad_creatives",
  {
    id: serial("id").primaryKey(),
    campaignId: bigint("campaignId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    mediaKey: varchar("mediaKey", { length: 512 }),
    mediaType: mysqlEnum("mediaType", ["image", "video"]).default("image").notNull(),
    destinationUrl: varchar("destinationUrl", { length: 1024 }).notNull(),
    buttonText: varchar("buttonText", { length: 128 }),
    linkLabel: varchar("linkLabel", { length: 128 }),
    bodyText: text("bodyText"),
    isAdminOnly: boolean("isAdminOnly").default(false).notNull(),
    advertiser: varchar("advertiser", { length: 255 }),
    layout: mysqlEnum("layout", ["banner", "card", "image_only", "video", "native"])
      .default("card")
      .notNull(),
    logoKey: varchar("logoKey", { length: 512 }),
    secondaryLinkUrl: varchar("secondaryLinkUrl", { length: 1024 }),
    secondaryLinkLabel: varchar("secondaryLinkLabel", { length: 128 }),
    targetPages: text("targetPages"),
    desktopVisible: boolean("desktopVisible").default(true).notNull(),
    mobileVisible: boolean("mobileVisible").default(true).notNull(),
    width: varchar("width", { length: 64 }),
    height: varchar("height", { length: 64 }),
    aspectRatio: varchar("aspectRatio", { length: 32 }),
    alignment: mysqlEnum("alignment", ["left", "center", "right"]).default("center").notNull(),
    backgroundColor: varchar("backgroundColor", { length: 64 }),
    borderColor: varchar("borderColor", { length: 64 }),
    textColor: varchar("textColor", { length: 64 }),
    showBorder: boolean("showBorder").default(false).notNull(),
    showShadow: boolean("showShadow").default(false).notNull(),
    textPosition: mysqlEnum("textPosition", ["top", "bottom", "overlay", "outside"])
      .default("bottom")
      .notNull(),
    ctaStyle: mysqlEnum("ctaStyle", ["filled", "outline", "text"]).default("filled").notNull(),
    previewImageKey: varchar("previewImageKey", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    campaignIdx: index("ad_creatives_campaign_idx").on(t.campaignId),
  }),
);

export type AdCreative = typeof adCreatives.$inferSelect;

// Ad metrics log — historical impressions/clicks/dismissals
export const adMetrics = mysqlTable(
  "ad_metrics",
  {
    id: serial("id").primaryKey(),
    campaignId: bigint("campaignId", { mode: "number", unsigned: true }).notNull(),
    creativeId: bigint("creativeId", { mode: "number", unsigned: true }),
    eventType: mysqlEnum("eventType", ["impression", "click", "dismissal"]).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    sessionId: varchar("sessionId", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    campaignIdx: index("ad_metrics_campaign_idx").on(t.campaignId, t.eventType),
    userIdx: index("ad_metrics_user_idx").on(t.userId),
    createdIdx: index("ad_metrics_created_idx").on(t.createdAt),
  }),
);

export type AdMetric = typeof adMetrics.$inferSelect;

// ---------------------------------------------------------------------------
// Developer / Website Credits
// ---------------------------------------------------------------------------
export const developerInfo = mysqlTable("developer_info", {
  id: serial("id").primaryKey(),
  developerName: varchar("developerName", { length: 255 }).notNull().default("TSG Developer"),
  developerPhotoKey: varchar("developerPhotoKey", { length: 512 }),
  bio: text("bio"),
  instagramUrl: varchar("instagramUrl", { length: 512 }),
  youtubeUrl: varchar("youtubeUrl", { length: 512 }),
  discordUrl: varchar("discordUrl", { length: 512 }),
  portfolioUrl: varchar("portfolioUrl", { length: 512 }),
  showOnHomePage: boolean("showOnHomePage").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type DeveloperInfo = typeof developerInfo.$inferSelect;

// ---------------------------------------------------------------------------
// Fan Rewards & Redemption
// ---------------------------------------------------------------------------
export const fanRewards = mysqlTable(
  "fan_rewards",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 128 }).notNull().default("Merchandise"),
    description: text("description"),
    photoKey: varchar("photoKey", { length: 512 }),
    xpCost: int("xpCost").notNull().default(0),
    stock: int("stock").notNull().default(0),
    claimedCount: int("claimedCount").notNull().default(0),
    isActive: boolean("isActive").default(true).notNull(),
    eligibilityJson: text("eligibilityJson"),
    details: text("details"),
    createdById: bigint("createdById", { mode: "number", unsigned: true }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    categoryIdx: index("fan_rewards_category_idx").on(t.category),
    activeIdx: index("fan_rewards_active_idx").on(t.isActive),
    xpIdx: index("fan_rewards_xp_idx").on(t.xpCost),
  }),
);

export type FanReward = typeof fanRewards.$inferSelect;
export type InsertFanReward = typeof fanRewards.$inferInsert;

export const rewardRedemptions = mysqlTable(
  "reward_redemptions",
  {
    id: serial("id").primaryKey(),
    rewardId: bigint("rewardId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    instagramUsername: varchar("instagramUsername", { length: 255 }),
    discordUsername: varchar("discordUsername", { length: 255 }),
    xpSpent: int("xpSpent").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "processing", "completed", "rejected"])
      .default("pending")
      .notNull(),
    adminNotes: text("adminNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    rewardIdx: index("reward_redemptions_reward_idx").on(t.rewardId),
    userIdx: index("reward_redemptions_user_idx").on(t.userId),
    statusIdx: index("reward_redemptions_status_idx").on(t.status),
    createdIdx: index("reward_redemptions_created_idx").on(t.createdAt),
    userRewardStatusIdx: index("idx_reward_redemptions_user_reward_status").on(t.userId, t.rewardId, t.status),
  }),
);

export type RewardRedemption = typeof rewardRedemptions.$inferSelect;
export type InsertRewardRedemption = typeof rewardRedemptions.$inferInsert;

export const rewardRedemptionHistory = mysqlTable(
  "reward_redemption_history",
  {
    id: serial("id").primaryKey(),
    redemptionId: bigint("redemptionId", { mode: "number", unsigned: true }).notNull(),
    status: mysqlEnum("status", ["pending", "approved", "processing", "completed", "rejected"]).notNull(),
    changedById: bigint("changedById", { mode: "number", unsigned: true }),
    adminNotes: text("adminNotes"),
    changedAt: timestamp("changedAt").defaultNow().notNull(),
  },
  (t) => ({
    redemptionIdx: index("reward_redemption_history_redemption_idx").on(t.redemptionId),
    changedIdx: index("reward_redemption_history_changed_idx").on(t.changedAt),
  }),
);

export type RewardRedemptionHistory = typeof rewardRedemptionHistory.$inferSelect;
