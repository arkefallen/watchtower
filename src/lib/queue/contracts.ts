import { z } from "zod";

export const QUEUES = {
  intake: "watchtower.intake",
  sync: "watchtower.sync",
  pricing: "watchtower.pricing",
  derive: "watchtower.derive",
  radar: "watchtower.radar",
  alert: "watchtower.alert",
  maintenance: "watchtower.maintenance",
} as const;

export interface JobProgress { pct: number; stage: string; message: string; counters?: Record<string, number>; callsSpent?: number; etaSeconds?: number; }
export interface JobResultBase { ok: boolean; durationMs: number; callsSpent: number; warnings: string[]; }

const address = z.string().regex(/^0x[0-9a-f]{40}$/);
const chain = z.enum(["base", "bsc", "robinhood"]);
export const jobPayloadSchemas = {
  walletIntake: z.object({ address, chain, requestedBy: z.enum(["USER", "IMPORT"]), importBatchId: z.string().optional(), forceFullResync: z.boolean().optional() }).strict(),
  walletSync: z.object({ address, chain, reason: z.enum(["SCHEDULED", "USER", "RETRY"]) }).strict(),
  fundingTrace: z.object({ rootAddress: address, rootChain: chain, maxDepth: z.number().int().min(1).max(6), branchAddress: address.optional(), branchChain: chain.optional(), mode: z.enum(["DEFAULT", "DEEP"]) }).strict(),
  noop: z.object({}).strict(),
} as const;

export type JobPayload = z.infer<(typeof jobPayloadSchemas)[keyof typeof jobPayloadSchemas]>;
