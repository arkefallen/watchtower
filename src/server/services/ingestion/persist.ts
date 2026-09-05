import type { PrismaClient } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import type { NormalizedTxRow, TokenStub } from "./normalize";
import { createTransactionRepository } from "@/server/db/repositories/transaction-repo";
import { chainSlugToPrisma, normalizeAddress } from "../wallet/normalize";

export interface PersistTransactionsDeps {
  prisma: PrismaClient;
  walletAddress: string;
  chain: ChainSlug;
  transactions: NormalizedTxRow[];
  tokenStubs: TokenStub[];
  coveredThroughBlock: bigint;
  endpoint: "NORMAL_TX" | "INTERNAL_TX" | "ERC20_TRANSFER";
  truncated?: boolean;
}

export interface PersistTransactionsResult {
  inserted: number;
  updated: number;
  total: number;
  coveredThroughBlock: bigint;
}

export async function persistTransactions(
  deps: PersistTransactionsDeps
): Promise<PersistTransactionsResult> {
  const {
    prisma,
    walletAddress,
    chain,
    transactions,
    tokenStubs,
    coveredThroughBlock,
    endpoint,
    truncated = false,
  } = deps;

  const repo = createTransactionRepository(prisma);
  const normalizedAddr = normalizeAddress(walletAddress);
  const prismaChain = chainSlugToPrisma(chain);

  // 1. Upsert token stubs
  if (tokenStubs.length > 0) {
    await repo.upsertTokens(tokenStubs);
  }

  // 2. Upsert transactions
  const txResult = await repo.upsertTransactions(transactions);

  // 3. Update SyncState cursors and block progress
  const syncState = await prisma.syncState.findUnique({
    where: {
      walletAddress_chain: {
        walletAddress: normalizedAddr,
        chain: prismaChain,
      },
    },
  });

  const existingCursors = (syncState?.cursorsJson as Record<string, any>) ?? {};
  const updatedCursors = {
    ...existingCursors,
    [endpoint]: {
      coveredThroughBlock: String(coveredThroughBlock),
      truncated,
      updatedAt: new Date().toISOString(),
    },
  };

  const prevLastSynced = syncState?.lastSyncedBlock ? BigInt(syncState.lastSyncedBlock) : 0n;
  const newLastSynced = coveredThroughBlock > prevLastSynced ? coveredThroughBlock : prevLastSynced;

  await prisma.syncState.update({
    where: {
      walletAddress_chain: {
        walletAddress: normalizedAddr,
        chain: prismaChain,
      },
    },
    data: {
      cursorsJson: updatedCursors,
      lastSyncedBlock: newLastSynced,
      lastSyncedAt: new Date(),
      status: "IDLE",
      totalRecords: {
        increment: txResult.inserted,
      },
    },
  });

  return {
    inserted: txResult.inserted,
    updated: txResult.updated,
    total: txResult.total,
    coveredThroughBlock,
  };
}
