// src/server/trpc/root.ts
import { router } from "@/server/trpc/trpc";
import { healthRouter } from "./routers/health";
import { jobsRouter } from "./routers/jobs";
import { walletRouter } from "./routers/wallet";
import { fundingRouter } from "./routers/funding";
import { clusterRouter } from "./routers/cluster";
import { graphRouter } from "./routers/graph";
import { radarRouter } from "./routers/radar";
import { alertRouter } from "./routers/alert";
import { settingsRouter } from "./routers/settings";
import { selfRouter } from "./routers/self";
import { tokenRouter } from "./routers/token";
import { maintenanceRouter } from "./routers/maintenance";

export const appRouter = router({
  health: healthRouter,
  jobs: jobsRouter,
  wallet: walletRouter,
  funding: fundingRouter,
  cluster: clusterRouter,
  graph: graphRouter,
  radar: radarRouter,
  alert: alertRouter,
  settings: settingsRouter,
  self: selfRouter,
  token: tokenRouter,
  maintenance: maintenanceRouter,
});

export type AppRouter = typeof appRouter;
