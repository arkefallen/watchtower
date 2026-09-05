import { z } from "zod";
import { publicProcedure, router } from "../trpc";

export const jobsRouter = router({
  enqueueNoop: publicProcedure.input(z.object({ requestId: z.string().min(1) })).output(z.object({ jobId: z.string() })).mutation(({ ctx, input }) => ctx.jobs.enqueueNoop(input.requestId)),
});
