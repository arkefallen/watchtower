// src/server/trpc/routers/alert.ts
import { router, publicProcedure } from "@/server/trpc/trpc";
import { z } from "zod";
import {
  getAlertList,
  acknowledgeAlert,
  markAllAlertsRead,
  getUnreadAlertCount,
  getAlertKpis,
} from "@/server/services/alert/list";

const alertTypeEnum = z.enum([
  "A1", "A2", "A3", "A4", "A5", "A6",
  "T1", "T2", "T3", "T4", "T5",
  "C1", "C2", "C3", "C4",
]);

const alertStateEnum = z.enum(["ARMED", "TRIGGERED", "EXIT_RISK"]);
const chainEnum = z.enum(["BASE", "BSC", "ROBINHOOD"]);

export const alertRouter = router({
  list: publicProcedure
    .input(
      z.object({
        state: alertStateEnum.optional(),
        type: alertTypeEnum.optional(),
        types: z.array(alertTypeEnum).optional(),
        walletAddress: z.string().optional(),
        chain: chainEnum.optional(),
        tokenAddress: z.string().optional(),
        search: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      return getAlertList(input);
    }),

  kpis: publicProcedure.query(async () => {
    return getAlertKpis();
  }),

  acknowledge: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return acknowledgeAlert(input.id);
    }),

  markAllRead: publicProcedure.mutation(async () => {
    return markAllAlertsRead();
  }),

  unreadCount: publicProcedure.query(async () => {
    const count = await getUnreadAlertCount();
    return { count };
  }),
});
