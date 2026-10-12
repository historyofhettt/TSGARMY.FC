import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { publicRouter } from "./public-router";
import { adminRouter } from "./admin-router";
import { storageRouter } from "./storage-router";
import { communityRouter } from "./community-router";
import { userRouter } from "./user-router";
import { highlightsRouter } from "./highlights-router";
import { mediaRouter } from "./media-router";
import { fanSpotlightRouter } from "./fan-spotlight-router";
import { liveLinksRouter } from "./live-links-router";
import { commentReportsRouter } from "./comment-reports-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  public: publicRouter,
  admin: adminRouter,
  storage: storageRouter,
  community: communityRouter,
  user: userRouter,
  highlights: highlightsRouter,
  media: mediaRouter,
  fanSpotlight: fanSpotlightRouter,
  liveLinks: liveLinksRouter,
  commentReports: commentReportsRouter,
});

export type AppRouter = typeof appRouter;
