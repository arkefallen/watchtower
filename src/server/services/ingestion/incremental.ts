import type { Address, ChainSlug, ChainAdapter } from "@/lib/chains/types";
import type { PrismaClient } from "@/generated/prisma/client";
import { fetchAllEndpointTransactions } from "./fetch";
import { persistTransactions } from "./persist";
import { chainSlugToPrisma } from "../wallet/normalize";

export interface IncrementalSyncInput {
  address: Address;
  chain: ChainSlug;
  forceFullResync?: boolean;
}

export interface IncrementalSyncResult {
  ok: boolean;
  address: string;
  chain: ChainSlug;
  fromBlock: string;
  toBlock: string;
  newTx: number;
  newMovements: number;
  truncated: boolean;
  callsSpent: number;
}

export interface EndpointCursor {
  coveredThroughBlock: string;
  highestBlockSeen: string;
}

export interface IncrementalSyncDeps {
  adapter: ChainAdapter;
  prisma?: PrismaClient;
  getCursors?: (address: string, chain: string) => Promise<Record<string, EndpointCursor> | null>;
  saveCursors?: (
    address: string,
    chain: string,
    cursors: Record<string, EndpointCursor>
  ) => Promise<void>;
}

export async function syncWalletIncremental(
  input: IncrementalSyncInput,
  deps: IncrementalSyncDeps
): Promise<IncrementalSyncResult> {
  const { address, chain, forceFullResync = false } = input;
  const { adapter, prisma, getCursors, saveCursors } = deps;

  const normAddress = address.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);

  // 1. Read existing cursors
  let cursors: Record<string, EndpointCursor> = {};
  if (getCursors) {
    cursors = (await getCursors(normAddress, chain)) ?? {};
  } else if (prisma) {
    const syncState = await prisma.syncState.findUnique({
      where: {
        walletAddress_chain: {
          walletAddress: normAddress,
          chain: prismaChain,
        },
      },
    });
    if (syncState?.cursorsJson && typeof syncState.cursorsJson === "object") {
      cursors = syncState.cursorsJson as unknown as Record<string, EndpointCursor>;
    }
  }

  const normalCursor = cursors["NORMAL_TX"];
  const internalCursor = cursors["INTERNAL_TX"];
  const erc20Cursor = cursors["ERC20_TRANSFER"];

  const normalFromBlock =
    forceFullResync || !normalCursor ? 0n : BigInt(normalCursor.coveredThroughBlock) + 1n;
  const internalFromBlock =
    forceFullResync || !internalCursor ? 0n : BigInt(internalCursor.coveredThroughBlock) + 1n;
  const erc20FromBlock =
    forceFullResync || !erc20Cursor ? 0n : BigInt(erc20Cursor.coveredThroughBlock) + 1n;

  // 2. Fetch incrementally
  let callsSpent = 0;
  let newTxCount = 0;
  let highestCovered = 0n;

  const normalFetch = await adapter.getTransactions(address, {
    fromBlock: normalFromBlock,
    toBlock: "latest",
  });
  callsSpent += normalFetch.callsSpent;
  newTxCount += normalFetch.records.length;
  if (normalFetch.coveredThroughBlock > highestCovered) {
    highestCovered = normalFetch.coveredThroughBlock;
  }

  const internalFetch = await adapter.getInternalTxs(address, {
    fromBlock: internalFromBlock,
    toBlock: "latest",
  });
  callsSpent += internalFetch.callsSpent;
  newTxCount += internalFetch.records.length;
  if (internalFetch.coveredThroughBlock > highestCovered) {
    highestCovered = internalFetch.coveredThroughBlock;
  }

  const erc20Fetch = await adapter.getTokenTransfers(address, {
    fromBlock: erc20FromBlock,
    toBlock: "latest",
  });
  callsSpent += erc20Fetch.callsSpent;
  newTxCount += erc20Fetch.records.length;
  if (erc20Fetch.coveredThroughBlock > highestCovered) {
    highestCovered = erc20Fetch.coveredThroughBlock;
  }

  // 3. Persist if prisma provided
  if (prisma) {
    const fullFetch = await fetchAllEndpointTransactions(adapter, address, {
      nativeOpts: { fromBlock: normalFromBlock, toBlock: "latest" },
      internalOpts: { fromBlock: internalFromBlock, toBlock: "latest" },
      erc20Opts: { fromBlock: erc20FromBlock, toBlock: "latest" },
    });

    const r1 = await persistTransactions({
      prisma,
      walletAddress: normAddress,
      chain,
      transactions: fullFetch.native.transactions,
      tokenStubs: [],
      coveredThroughBlock: fullFetch.native.coveredThroughBlock,
      endpoint: "NORMAL_TX",
    });
    const r2 = await persistTransactions({
      prisma,
      walletAddress: normAddress,
      chain,
      transactions: fullFetch.internal.transactions,
      tokenStubs: [],
      coveredThroughBlock: fullFetch.internal.coveredThroughBlock,
      endpoint: "INTERNAL_TX",
    });
    const r3 = await persistTransactions({
      prisma,
      walletAddress: normAddress,
      chain,
      transactions: fullFetch.erc20.transactions,
      tokenStubs: fullFetch.erc20.tokenStubs,
      coveredThroughBlock: fullFetch.erc20.coveredThroughBlock,
      endpoint: "ERC20_TRANSFER",
    });
    newTxCount = r1.inserted + r2.inserted + r3.inserted;
  }

  // 4. Update cursors
  const updatedCursors: Record<string, EndpointCursor> = {
    ...cursors,
    NORMAL_TX: {
      coveredThroughBlock: normalFetch.coveredThroughBlock.toString(),
      highestBlockSeen: normalFetch.coveredThroughBlock.toString(),
    },
    INTERNAL_TX: {
      coveredThroughBlock: internalFetch.coveredThroughBlock.toString(),
      highestBlockSeen: internalFetch.coveredThroughBlock.toString(),
    },
    ERC20_TRANSFER: {
      coveredThroughBlock: erc20Fetch.coveredThroughBlock.toString(),
      highestBlockSeen: erc20Fetch.coveredThroughBlock.toString(),
    },
  };

  if (saveCursors) {
    await saveCursors(normAddress, chain, updatedCursors);
  } else if (prisma) {
    await prisma.syncState.update({
      where: {
        walletAddress_chain: {
          walletAddress: normAddress,
          chain: prismaChain,
        },
      },
      data: {
        cursorsJson: updatedCursors as any,
        lastSyncedAt: new Date(),
        status: "IDLE",
      },
    });
  }

  const minFromBlock = [normalFromBlock, internalFromBlock, erc20FromBlock].reduce(
    (min, b) => (b < min ? b : min),
    normalFromBlock
  );

  return {
    ok: true,
    address: normAddress,
    chain,
    fromBlock: minFromBlock.toString(),
    toBlock: highestCovered.toString(),
    newTx: newTxCount,
    newMovements: 0,
    truncated: normalFetch.truncated || internalFetch.truncated || erc20Fetch.truncated,
    callsSpent,
  };
}
