import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { hasAtLeastRole } from "@contracts/constants";
import { getDb } from "./queries/connection";
import { comments, commentReactions, users, tournaments } from "../db/schema";
import { notifyEngagement } from "./queries/notifications";

// Basic in-memory anti-spam: one comment per user every 8 seconds.
const lastCommentAt = new Map<number, number>();

function sanitize(text: string) {
  // Strip control characters, trim, and hard-cap length.
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 2000);
}

export const communityRouter = createRouter({
  list: publicQuery
    .input(z.object({ tournamentId: z.number() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const list = await db
        .select({
          id: comments.id,
          content: comments.content,
          parentId: comments.parentId,
          pinned: comments.pinned,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          userId: users.id,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          userRole: users.role,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(and(eq(comments.tournamentId, input.tournamentId), eq(comments.hidden, false)))
        .orderBy(desc(comments.pinned), desc(comments.createdAt))
        .limit(300);

      const ids = list.map((c) => c.id);
      const reactionCounts = new Map<number, number>();
      const myReactions = new Set<number>();
      if (ids.length > 0) {
        const rows = await db
          .select()
          .from(commentReactions)
          .where(
            sql`${commentReactions.commentId} in (${sql.join(
              ids.map((i) => sql`${i}`),
              sql`, `,
            )})`,
          );
        for (const r of rows) {
          reactionCounts.set(r.commentId, (reactionCounts.get(r.commentId) ?? 0) + 1);
          if (ctx.user && r.userId === ctx.user.id) myReactions.add(r.commentId);
        }
      }
      return list.map((c) => ({
        ...c,
        reactions: reactionCounts.get(c.id) ?? 0,
        reactedByMe: myReactions.has(c.id),
        mine: ctx.user?.id === c.userId,
      }));
    }),

  latestComments: publicQuery
    .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
    .query(async ({ input }) => {
      const db = getDb();
      const list = await db
        .select({
          id: comments.id,
          content: comments.content,
          createdAt: comments.createdAt,
          userId: users.id,
          userName: users.name,
          userUsername: users.username,
          userAvatar: users.avatar,
          userRole: users.role,
          tournamentId: tournaments.id,
          tournamentName: tournaments.name,
          tournamentSlug: tournaments.slug,
        })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .innerJoin(tournaments, eq(comments.tournamentId, tournaments.id))
        .where(eq(comments.hidden, false))
        .orderBy(desc(comments.createdAt))
        .limit(input.limit);

      return list;
    }),

  create: authedQuery
    .input(
      z.object({
        tournamentId: z.number(),
        parentId: z.number().nullish(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted from commenting.",
        });
      }
      const now = Date.now();
      const last = lastCommentAt.get(ctx.user.id) ?? 0;
      if (now - last < 8000) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait a few seconds before commenting again.",
        });
      }
      const content = sanitize(input.content);
      if (!content) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Comment cannot be empty." });
      }
      lastCommentAt.set(ctx.user.id, now);
      const [{ id }] = await getDb()
        .insert(comments)
        .values({
          tournamentId: input.tournamentId,
          userId: ctx.user.id,
          parentId: input.parentId ?? null,
          content,
        })
        .$returningId();

      // Engagement notification: reply to another user's comment,
      // or a new comment on a tournament (notify tournament-related authors).
      if (input.parentId) {
        const parent = await getDb().query.comments.findFirst({
          where: eq(comments.id, input.parentId),
        });
        if (parent && parent.userId !== ctx.user.id) {
          const actor = await getDb().query.users.findFirst({
            where: eq(users.id, ctx.user.id),
          });
          const tournament = await getDb().query.tournaments.findFirst({
            where: eq(tournaments.id, input.tournamentId),
          });
          await notifyEngagement({
            recipientUserId: parent.userId,
            actorName: actor?.name ?? "Someone",
            action: "reply",
            contentDesc: `your comment on ${tournament?.name ?? "a tournament"}`,
            linkUrl: tournament?.slug ? `/tournaments/${tournament.slug}` : null,
          });
        }
      }

      return { id };
    }),

  update: authedQuery
    .input(z.object({ id: z.number(), content: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted from commenting.",
        });
      }
      const db = getDb();
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, input.id),
      });
      if (!comment || comment.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const content = sanitize(input.content);
      await db.update(comments).set({ content }).where(eq(comments.id, input.id));
      return { ok: true };
    }),

  remove: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, input.id),
      });
      // Authors can delete their own comments; moderators and admins can
      // remove any comment. Enforced server-side against the DB role.
      const canModerate = hasAtLeastRole(ctx.user.role, "moderator");
      if (!comment || (comment.userId !== ctx.user.id && !canModerate)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await db.delete(commentReactions).where(eq(commentReactions.commentId, input.id));
      await db.delete(comments).where(eq(comments.id, input.id));
      return { ok: true };
    }),

  react: authedQuery
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted from reacting.",
        });
      }
      const db = getDb();
      const existing = await db.query.commentReactions.findFirst({
        where: and(
          eq(commentReactions.commentId, input.commentId),
          eq(commentReactions.userId, ctx.user.id),
        ),
      });
      if (existing) {
        await db.delete(commentReactions).where(eq(commentReactions.id, existing.id));
        return { reacted: false };
      }
      await db
        .insert(commentReactions)
        .values({ commentId: input.commentId, userId: ctx.user.id });

      // Engagement notification: notify the comment author of the like.
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, input.commentId),
      });
      if (comment && comment.userId !== ctx.user.id) {
        const actor = await db.query.users.findFirst({
          where: eq(users.id, ctx.user.id),
        });
        const tournament = await db.query.tournaments.findFirst({
          where: eq(tournaments.id, comment.tournamentId),
        });
        await notifyEngagement({
          recipientUserId: comment.userId,
          actorName: actor?.name ?? "Someone",
          action: "like",
          contentDesc: `your comment on ${tournament?.name ?? "a tournament"}`,
          linkUrl: tournament?.slug ? `/tournaments/${tournament.slug}` : null,
        });
      }

      return { reacted: true };
    }),
});
