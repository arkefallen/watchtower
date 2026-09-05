import { router } from "./trpc";
import { healthRouter } from "./routers/health";
import { jobsRouter } from "./routers/jobs";
import { walletRouter } from "./routers/wallet";
import { fundingRouter } from "./routers/funding";
import { clusterRouter } from "./routers/cluster";

export const appRouter = router({
  health: healthRouter,
  jobs: jobsRouter,
  wallet: walletRouter,
  funding: fundingRouter,
  cluster: clusterRouter,
});
export type AppRouter = typeof appRouter;
