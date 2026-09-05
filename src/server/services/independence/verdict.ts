import { Prisma, type Chain, type PrismaClient, type RelationKind } from "@/generated/prisma/client";
import {
  buildSharedFunderStatement,
  buildDirectTransferStatement,
  buildSameClusterStatement,
  buildCoEntryStatement,
  INDEPENDENT_VERBATIM,
} from "./statements";

export interface IndependenceInput {
  a: { address: string; chain: Chain };
  b: { address: string; chain: Chain };
  asOf?: Date;
}

export interface IndependenceLink {
  kind: RelationKind;
  statement: string;
  detail: Record<string, unknown>;
}

export interface IndependenceResult {
  independent: boolean;
  links: IndependenceLink[];
}

export interface WalletVerdict {
  wallet: { address: string; chain: Chain };
  statements: string[];
  isIndependentOfAll: boolean;
  relatedWallets: Array<{
    address: string;
    chain: Chain;
    kinds: RelationKind[];
  }>;
}

/**
 * Check if two wallets are mutually independent per FR-4.2 / §4.7.
 * Independence = different funders AND no direct interaction edge AND not same cluster.
 * Note (Decision D-6): CO_ENTRY is excluded from this mutual independence test.
 */
export async function areMutuallyIndependent(
  prisma: PrismaClient,
  input: IndependenceInput
): Promise<IndependenceResult> {
  const addrA = input.a.address.toLowerCase();
  const addrB = input.b.address.toLowerCase();
  const chainA = input.a.chain;
  const chainB = input.b.chain;

  const links: IndependenceLink[] = [];

  // 1. Direct Transfer Edge Check
  const directEdge = await prisma.interactionEdge.findFirst({
    where: {
      OR: [
        { addressA: addrA, chainA, addressB: addrB, chainB },
        { addressA: addrB, chainA: chainB, addressB: addrA, chainB: chainA },
      ],
      txCount: { gte: 1 },
    },
  });

  if (directEdge) {
    const totalUsd = Number(directEdge.totalUsd);
    links.push({
      kind: "DIRECT_TRANSFER",
      statement: buildDirectTransferStatement(addrB, directEdge.txCount, totalUsd),
      detail: {
        txCount: directEdge.txCount,
        totalUsd,
        usdAToB: Number(directEdge.usdAToB),
        usdBToA: Number(directEdge.usdBToA),
      },
    });
  }

  // 2. Shared Funder Check (exclude terminal entities per §4.7)
  const fundersA = await prisma.fundingEdge.findMany({
    where: {
      rootAddress: addrA,
      rootChain: chainA,
      isTerminalEntity: false,
    },
    select: { parentAddress: true, parentChain: true, entityName: true },
  });

  const fundersB = await prisma.fundingEdge.findMany({
    where: {
      rootAddress: addrB,
      rootChain: chainB,
      isTerminalEntity: false,
    },
    select: { parentAddress: true, parentChain: true, entityName: true },
  });

  const setFundersB = new Map(
    fundersB.map((f) => [`${f.parentChain}:${f.parentAddress.toLowerCase()}`, f])
  );

  for (const fA of fundersA) {
    const key = `${fA.parentChain}:${fA.parentAddress.toLowerCase()}`;
    const match = setFundersB.get(key);
    if (match) {
      links.push({
        kind: "SHARED_FUNDER",
        statement: buildSharedFunderStatement(
          addrB,
          fA.parentAddress,
          fA.entityName ?? match.entityName
        ),
        detail: {
          funderAddress: fA.parentAddress,
          funderChain: fA.parentChain,
          entityName: fA.entityName ?? match.entityName,
        },
      });
      break; // One shared funder link is sufficient proof
    }
  }

  // 3. Same Cluster Check
  const clustersA = await prisma.clusterMember.findMany({
    where: { walletAddress: addrA, walletChain: chainA },
    include: { cluster: true },
  });
  const clustersB = await prisma.clusterMember.findMany({
    where: { walletAddress: addrB, walletChain: chainB },
    include: { cluster: true },
  });

  const clusterIdsB = new Set(clustersB.map((c) => c.clusterId));
  for (const cA of clustersA) {
    if (clusterIdsB.has(cA.clusterId)) {
      links.push({
        kind: "SAME_CLUSTER",
        statement: buildSameClusterStatement(addrB, cA.cluster.name),
        detail: {
          clusterId: cA.clusterId,
          clusterName: cA.cluster.name,
        },
      });
      break;
    }
  }

  return {
    independent: links.length === 0,
    links,
  };
}

/**
 * Rebuild stored WalletRelation rows for all tracked wallets or scoped subset.
 */
export async function rebuildWalletRelations(
  prisma: PrismaClient,
  scope?: { address?: string; chain?: Chain }
): Promise<{ rowsWritten: number }> {
  const whereWallet: Prisma.WalletWhereInput = { isBlacklisted: false };
  if (scope?.chain) whereWallet.chain = scope.chain;
  if (scope?.address) whereWallet.address = scope.address.toLowerCase();

  const targetWallets = await prisma.wallet.findMany({
    where: whereWallet,
    select: { address: true, chain: true },
  });

  const allWallets = await prisma.wallet.findMany({
    where: { isBlacklisted: false },
    select: { address: true, chain: true },
  });

  let rowsWritten = 0;

  for (const subject of targetWallets) {
    const sAddr = subject.address.toLowerCase();
    const sChain = subject.chain;

    // Delete existing relations for subject
    await prisma.walletRelation.deleteMany({
      where: { fromAddress: sAddr, fromChain: sChain },
    });

    for (const peer of allWallets) {
      const pAddr = peer.address.toLowerCase();
      const pChain = peer.chain;
      if (sAddr === pAddr && sChain === pChain) continue;

      // 1. Direct transfer check
      const edge = await prisma.interactionEdge.findFirst({
        where: {
          OR: [
            { addressA: sAddr, chainA: sChain, addressB: pAddr, chainB: pChain },
            { addressA: pAddr, chainA: pChain, addressB: sAddr, chainB: sChain },
          ],
          txCount: { gte: 1 },
        },
      });

      if (edge) {
        const totalUsdNum = Number(edge.totalUsd);
        const stmt = buildDirectTransferStatement(pAddr, edge.txCount, totalUsdNum);
        await prisma.walletRelation.upsert({
          where: {
            wallet_relation_key: {
              fromAddress: sAddr,
              fromChain: sChain,
              toAddress: pAddr,
              toChain: pChain,
              kind: "DIRECT_TRANSFER",
            },
          },
          create: {
            fromAddress: sAddr,
            fromChain: sChain,
            toAddress: pAddr,
            toChain: pChain,
            kind: "DIRECT_TRANSFER",
            statement: stmt,
            detailJson: { txCount: edge.txCount, totalUsd: totalUsdNum },
            strengthUsd: edge.totalUsd,
            eventsCount: edge.txCount,
            firstAt: edge.firstAt,
            lastAt: edge.lastAt,
            computedAt: new Date(),
          },
          update: {
            statement: stmt,
            detailJson: { txCount: edge.txCount, totalUsd: totalUsdNum },
            strengthUsd: edge.totalUsd,
            eventsCount: edge.txCount,
            firstAt: edge.firstAt,
            lastAt: edge.lastAt,
            computedAt: new Date(),
          },
        });
        rowsWritten++;
      }

      // 2. Shared funder check (non-terminal)
      const fundersS = await prisma.fundingEdge.findMany({
        where: { rootAddress: sAddr, rootChain: sChain, isTerminalEntity: false },
        select: { parentAddress: true, parentChain: true, entityName: true },
      });
      const fundersP = await prisma.fundingEdge.findMany({
        where: { rootAddress: pAddr, rootChain: pChain, isTerminalEntity: false },
        select: { parentAddress: true, parentChain: true, entityName: true },
      });

      const mapP = new Map(fundersP.map((f) => [`${f.parentChain}:${f.parentAddress.toLowerCase()}`, f]));
      for (const fS of fundersS) {
        const match = mapP.get(`${fS.parentChain}:${fS.parentAddress.toLowerCase()}`);
        if (match) {
          const stmt = buildSharedFunderStatement(pAddr, fS.parentAddress, fS.entityName ?? match.entityName);
          await prisma.walletRelation.upsert({
            where: {
              wallet_relation_key: {
                fromAddress: sAddr,
                fromChain: sChain,
                toAddress: pAddr,
                toChain: pChain,
                kind: "SHARED_FUNDER",
              },
            },
            create: {
              fromAddress: sAddr,
              fromChain: sChain,
              toAddress: pAddr,
              toChain: pChain,
              kind: "SHARED_FUNDER",
              statement: stmt,
              detailJson: { funderAddress: fS.parentAddress, entityName: fS.entityName ?? match.entityName },
              computedAt: new Date(),
            },
            update: {
              statement: stmt,
              detailJson: { funderAddress: fS.parentAddress, entityName: fS.entityName ?? match.entityName },
              computedAt: new Date(),
            },
          });
          rowsWritten++;
          break;
        }
      }

      // 3. Same cluster check
      const clustersS = await prisma.clusterMember.findMany({
        where: { walletAddress: sAddr, walletChain: sChain },
        include: { cluster: true },
      });
      const clustersP = await prisma.clusterMember.findMany({
        where: { walletAddress: pAddr, walletChain: pChain },
        include: { cluster: true },
      });
      const setP = new Set(clustersP.map((c) => c.clusterId));
      for (const cS of clustersS) {
        if (setP.has(cS.clusterId)) {
          const stmt = buildSameClusterStatement(pAddr, cS.cluster.name);
          await prisma.walletRelation.upsert({
            where: {
              wallet_relation_key: {
                fromAddress: sAddr,
                fromChain: sChain,
                toAddress: pAddr,
                toChain: pChain,
                kind: "SAME_CLUSTER",
              },
            },
            create: {
              fromAddress: sAddr,
              fromChain: sChain,
              toAddress: pAddr,
              toChain: pChain,
              kind: "SAME_CLUSTER",
              statement: stmt,
              detailJson: { clusterId: cS.clusterId, clusterName: cS.cluster.name },
              computedAt: new Date(),
            },
            update: {
              statement: stmt,
              detailJson: { clusterId: cS.clusterId, clusterName: cS.cluster.name },
              computedAt: new Date(),
            },
          });
          rowsWritten++;
          break;
        }
      }

      // 4. Co-entry check (overlapping token transactions within 24h)
      if (sChain === pChain) {
        const tokenTxsS = await prisma.transaction.findMany({
          where: {
            chain: sChain,
            tokenAddress: { not: null },
            OR: [{ fromAddress: sAddr }, { toAddress: sAddr }],
          },
          select: { tokenAddress: true, timestamp: true },
        });

        const tokenTxsP = await prisma.transaction.findMany({
          where: {
            chain: pChain,
            tokenAddress: { not: null },
            OR: [{ fromAddress: pAddr }, { toAddress: pAddr }],
          },
          select: { tokenAddress: true, timestamp: true },
        });

        const coEntryTokens = new Set<string>();
        for (const txS of tokenTxsS) {
          if (!txS.tokenAddress) continue;
          const match = tokenTxsP.find(
            (txP) =>
              txP.tokenAddress?.toLowerCase() === txS.tokenAddress?.toLowerCase() &&
              Math.abs(txS.timestamp.getTime() - txP.timestamp.getTime()) <= 24 * 60 * 60 * 1000
          );
          if (match) {
            coEntryTokens.add(txS.tokenAddress.toLowerCase());
          }
        }

        if (coEntryTokens.size > 0) {
          const stmt = buildCoEntryStatement(pAddr, coEntryTokens.size, 24);
          await prisma.walletRelation.upsert({
            where: {
              wallet_relation_key: {
                fromAddress: sAddr,
                fromChain: sChain,
                toAddress: pAddr,
                toChain: pChain,
                kind: "CO_ENTRY",
              },
            },
            create: {
              fromAddress: sAddr,
              fromChain: sChain,
              toAddress: pAddr,
              toChain: pChain,
              kind: "CO_ENTRY",
              statement: stmt,
              detailJson: { tokens: Array.from(coEntryTokens), windowHours: 24 },
              eventsCount: coEntryTokens.size,
              computedAt: new Date(),
            },
            update: {
              statement: stmt,
              detailJson: { tokens: Array.from(coEntryTokens), windowHours: 24 },
              eventsCount: coEntryTokens.size,
              computedAt: new Date(),
            },
          });
          rowsWritten++;
        }
      }
    }
  }

  return { rowsWritten };
}

/**
 * Compute the complete verdict for a wallet (FR-3.6).
 * Emits statement list, or the single verbatim INDEPENDENT line if isolated.
 */
export async function computeWalletVerdict(
  prisma: PrismaClient,
  wallet: { address: string; chain: Chain }
): Promise<WalletVerdict> {
  const normAddr = wallet.address.toLowerCase();

  const relations = await prisma.walletRelation.findMany({
    where: { fromAddress: normAddr, fromChain: wallet.chain },
    orderBy: { computedAt: "desc" },
  });

  const statements = relations.map((r) => r.statement);

  const relatedWalletsMap = new Map<string, { address: string; chain: Chain; kinds: RelationKind[] }>();
  for (const r of relations) {
    const key = `${r.toChain}:${r.toAddress}`;
    const existing = relatedWalletsMap.get(key);
    if (!existing) {
      relatedWalletsMap.set(key, {
        address: r.toAddress,
        chain: r.toChain,
        kinds: [r.kind],
      });
    } else {
      existing.kinds.push(r.kind);
    }
  }

  const isIndependentOfAll = statements.length === 0;
  if (isIndependentOfAll) {
    statements.push(INDEPENDENT_VERBATIM);
  }

  return {
    wallet: { address: normAddr, chain: wallet.chain },
    statements,
    isIndependentOfAll,
    relatedWallets: Array.from(relatedWalletsMap.values()),
  };
}
