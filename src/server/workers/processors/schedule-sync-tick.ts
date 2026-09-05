import type { Queue } from "bullmq";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import { prismaToChainSlug } from "@/server/services/wallet/normalize";

export interface WalletSchedulerRow {
  address: string;
  chain: ChainSlug;
  watchPriority: "HIGH" | "NORMAL";
  lastSyncedAt: Date | null;
}

export interface ScheduleSyncTickOptions {
  wallets?: WalletSchedulerRow[];
  syncCadenceMinutes?: number;
  now?: Date;
  queue?: Queue;
  budgetGuard?: {
    hasBudget?: () => Promise<boolean> | boolean;
    acquire?: (cost: number, priority: string) => Promise<void>;
  };
  prisma?: PrismaClient;
}

export interface ScheduleTickResult {
  enqueued: number;
  skippedForBudget: number;
}

export function selectDueWallets(
  wallets: WalletSchedulerRow[],
  syncCadenceMinutes: number,
  now: Date = new Date()
): WalletSchedulerRow[] {
  const cadenceMs = syncCadenceMinutes * 60 * 1000;

  // Filter due
  const due = wallets.filter((w) => {
    if (!w.lastSyncedAt) return true;
    return now.getTime() - w.lastSyncedAt.getTime() >= cadenceMs;
  });

  // Sort HIGH priority before NORMAL, then oldest lastSyncedAt
  return due.sort((a, b) => {
    if (a.watchPriority !== b.watchPriority) {
      return a.watchPriority === "HIGH" ? -1 : 1;
    }
    const aTime = a.lastSyncedAt?.getTime() ?? 0;
    const bTime = b.lastSyncedAt?.getTime() ?? 0;
    return aTime - bTime;
  });
}

export async function processScheduleSyncTick(
  options: ScheduleSyncTickOptions
): Promise<ScheduleTickResult> {
  const {
    wallets: providedWallets,
    syncCadenceMinutes: providedCadence,
    now = new Date(),
    queue,
    budgetGuard,
    prisma: providedPrisma,
  } = options;

  let cadence = providedCadence;
  if (!cadence) {
    const { loadSettings } = await import("@/server/services/settings");
    const settings = await loadSettings();
    cadence = settings.syncCadenceMinutes ?? 15;
  }

  let wallets: WalletSchedulerRow[] = [];
  if (providedWallets) {
    wallets = providedWallets;
  } else {
    const prisma = providedPrisma ?? (await import("@/server/db/client")).prisma;
    const dbWallets = await prisma.wallet.findMany({
      include: {
        syncState: true,
      },
    });
    wallets = dbWallets.map((w) => ({
      address: w.address,
      chain: prismaToChainSlug(w.chain),
      watchPriority: w.watchPriority as "HIGH" | "NORMAL",
      lastSyncedAt: w.syncState?.lastSyncedAt ?? null,
    }));
  }

  const dueWallets = selectDueWallets(wallets, cadence, now);

  let enqueued = 0;
  let skippedForBudget = 0;

  for (const w of dueWallets) {
    // Check budget guard
    let canEnqueue = true;
    if (budgetGuard) {
      if (budgetGuard.hasBudget) {
        canEnqueue = await budgetGuard.hasBudget();
      } else if (budgetGuard.acquire) {
        try {
          await budgetGuard.acquire(1, "BACKGROUND");
        } catch {
          canEnqueue = false;
        }
      }
    }

    if (!canEnqueue) {
      skippedForBudget++;
      continue;
    }

    if (queue) {
      const jobId = `sync:${w.chain}:${w.address.toLowerCase()}:${Math.floor(now.getTime() / (cadence * 60 * 1000))}`;
      await queue.add(
        "wallet.sync.incremental",
        {
          address: w.address,
          chain: w.chain,
          reason: "SCHEDULED",
        },
        {
          jobId,
        }
      );
    }
    enqueued++;
  }

  return {
    enqueued,
    skippedForBudget,
  };
}
