import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery, moderatorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { commentReports, comments, users } from "../db/schema";

const CUSTOM_REASON_MAX = 500;

function isDuplicateReportError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "errno" in e &&
    (e as { errno: number }).errno === 1062
  );
}

function sanitize(text: string, max: number) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, max);
}

export const commentReportsRouter = createRouter({
  // -------------------------------------------------- report a comment
  reportComment: authedQuery
    .input(
      z.object({
        commentId: z.number().int().positive(),
        reason: z.enum(["spam", "harassment", "inappropriate", "offtopic", "other"]).default("other"),
        customReason: z.string().max(CUSTOM_REASON_MAX).nullish(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.banned) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your account has been restricted.",
        });
      }

      const db = getDb();

      // Verify the comment exists
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, input.commentId),
        columns: { id: true },
      });
      if (!comment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found." });
      }

      const customReason = input.customReason
        ? sanitize(input.customReason, CUSTOM_REASON_MAX)
        : null;

      try {
        const [{ id }] = await db
          .insert(commentReports)
          .values({
            commentId: input.commentId,
            reporterId: ctx.user.id,
            reason: input.reason,
            customReason,
          })
          .$returningId();
        return { id };
      } catch (e: unknown) {
        // Duplicate report (unique constraint on commentId + reporterId)
        if (isDuplicateReportError(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "You have already reported this comment.",
          });
        }
        throw e;
      }
    }),

  // ---------------------------------------------- admin/moderator list reports
  listReports: moderatorQuery.query(async () => {
    const db = getDb();
    const list = await db
      .select({
        id: commentReports.id,
        commentId: commentReports.commentId,
        reporterId: commentReports.reporterId,
        reporterName: users.name,
        reporterUsername: users.username,
        reason: commentReports.reason,
        customReason: commentReports.customReason,
        status: commentReports.status,
        createdAt: commentReports.createdAt,
        content: comments.content,
        commentUserId: comments.userId,
      })
      .from(commentReports)
      .innerJoin(comments, eq(commentReports.commentId, comments.id))
      .innerJoin(users, eq(commentReports.reporterId, users.id))
      .orderBy(desc(commentReports.createdAt))
      .limit(200);

    return list;
  }),

   // ---------------------------------------------- admin/moderator resolve report
   resolveReport: moderatorQuery
     .input(
       z.object({
         id: z.number().int().positive(),
         action: z.enum(["resolve", "dismiss", "delete_comment"]),
       }),
     )
      .mutation(async ({ input }) => {
       const db = getDb();
       const report = await db
        .select({ commentId: commentReports.commentId })
        .from(commentReports)
        .where(eq(commentReports.id, input.id))
        .limit(1);

      if (!report[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Report not found." });
      }

      if (input.action === "delete_comment") {
        // Delete the comment (cascade will remove reactions)
        await db
          .delete(comments)
          .where(eq(comments.id, report[0].commentId));
      }

      const newStatus =
        input.action === "resolve"
          ? "resolved"
          : input.action === "dismiss"
            ? "dismissed"
            : "resolved";

      await db
        .update(commentReports)
        .set({ status: newStatus })
        .where(eq(commentReports.id, input.id));

      return { ok: true };
    }),
});
