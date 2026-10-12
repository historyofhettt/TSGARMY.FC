import { appRouter } from "../api/router";
import { createContext } from "../api/context";

async function main() {
  const ctx = await createContext({ req: new Request("http://localhost/api/trpc") });
  const caller = appRouter.createCaller(ctx);
  try {
    const result = await caller.public.leaderboard();
    console.log("leaderboard result count:", result.length);
    console.log("first 3:", JSON.stringify(result.slice(0, 3), null, 2));
  } catch (e) {
    console.error("leaderboard error:", e);
  }
  try {
    const result = await caller.user.getProfile({ username: "test" });
    console.log("getProfile result:", JSON.stringify(result, null, 2));
  } catch (e) {
    console.error("getProfile error:", e);
  }
}

main();
