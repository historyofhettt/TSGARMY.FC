import { relations } from "drizzle-orm";
import {
  teams,
  teamStaff,
  teamMedia,
  players,
  tournaments,
  matches,
  matchPlayers,
  comments,
  commentReactions,
  users,
  refreshTokens,
  achievements,
  playerAchievements,
  teamAchievements,
} from "./schema";

export const teamsRelations = relations(teams, ({ many }) => ({
  staff: many(teamStaff),
  media: many(teamMedia),
  players: many(players),
  tournaments: many(tournaments),
}));

export const teamStaffRelations = relations(teamStaff, ({ one }) => ({
  team: one(teams, { fields: [teamStaff.teamId], references: [teams.id] }),
}));

export const teamMediaRelations = relations(teamMedia, ({ one }) => ({
  team: one(teams, { fields: [teamMedia.teamId], references: [teams.id] }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  team: one(teams, { fields: [players.teamId], references: [teams.id] }),
  user: one(users, { fields: [players.userId], references: [users.id] }),
  performances: many(matchPlayers),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  team: one(teams, { fields: [tournaments.teamId], references: [teams.id] }),
  matches: many(matches),
  comments: many(comments),
  mvpPlayer: one(players, { fields: [tournaments.mvpPlayerId], references: [players.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  matchPlayers: many(matchPlayers),
}));

export const matchPlayersRelations = relations(
  matchPlayers,
  ({ one }) => ({
    match: one(matches, {
      fields: [matchPlayers.matchId],
      references: [matches.id],
    }),
    player: one(players, {
      fields: [matchPlayers.playerId],
      references: [players.id],
    }),
  }),
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [comments.tournamentId],
    references: [tournaments.id],
  }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
  reactions: many(commentReactions),
}));

export const commentReactionsRelations = relations(
  commentReactions,
  ({ one }) => ({
    comment: one(comments, {
      fields: [commentReactions.commentId],
      references: [comments.id],
    }),
    user: one(users, { fields: [commentReactions.userId], references: [users.id] }),
  }),
);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  playerAchievements: many(playerAchievements),
  teamAchievements: many(teamAchievements),
}));

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  player: one(players, {
    fields: [playerAchievements.playerId],
    references: [players.id],
  }),
  achievement: one(achievements, {
    fields: [playerAchievements.achievementId],
    references: [achievements.id],
  }),
  tournament: one(tournaments, {
    fields: [playerAchievements.tournamentId],
    references: [tournaments.id],
  }),
  match: one(matches, {
    fields: [playerAchievements.matchId],
    references: [matches.id],
  }),
}));

export const teamAchievementsRelations = relations(teamAchievements, ({ one }) => ({
  team: one(teams, {
    fields: [teamAchievements.teamId],
    references: [teams.id],
  }),
  achievement: one(achievements, {
    fields: [teamAchievements.achievementId],
    references: [achievements.id],
  }),
  tournament: one(tournaments, {
    fields: [teamAchievements.tournamentId],
    references: [tournaments.id],
  }),
}));
