import type { Address, ChainSlug } from "@/lib/chains/types";
import { getClusterColor } from "@/lib/format/cluster-color";
import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";

export interface ClusterFundingEdgeInput {
  rootAddress: Address;
  rootChain: ChainSlug;
  parentAddress: Address;
  parentChain: ChainSlug;
  isTerminalEntity: boolean;
  funderLabel?: string | null;
}

export interface ClusterMemberStats {
  stableUsd: string;
  lastActivityAt?: Date | null;
}

export interface DetectedCluster {
  funderAddress: Address;
  funderChain: ChainSlug;
  name: string;
  colorHex: string;
  members: string[]; // lowercase wallet addresses
  memberCount: number;
  combinedStableUsd: string;
  lastActivityAt: Date | null;
}

export function detectClustersFromEdges(
  edges: ClusterFundingEdgeInput[],
  statsMap: Record<string, ClusterMemberStats> = {}
): DetectedCluster[] {
  // Group non-terminal funders
  const funderGroups = new Map<
    string,
    {
      funderAddress: Address;
      funderChain: ChainSlug;
      funderLabel?: string | null;
      members: Set<string>;
    }
  >();

  for (const edge of edges) {
    // Shared terminal CEX/bridge creates NO cluster (FR-2.6)
    if (edge.isTerminalEntity) continue;

    const key = `${edge.parentChain}:${edge.parentAddress.toLowerCase()}`;
    const group = funderGroups.get(key) ?? {
      funderAddress: edge.parentAddress,
      funderChain: edge.parentChain,
      funderLabel: edge.funderLabel,
      members: new Set<string>(),
    };

    group.members.add(edge.rootAddress.toLowerCase());
    funderGroups.set(key, group);
  }

  const clusters: DetectedCluster[] = [];

  for (const group of funderGroups.values()) {
    // Cluster requires >= 2 members (FR-2.6)
    if (group.members.size < 2) continue;

    const membersList = Array.from(group.members);
    const colorHex = getClusterColor(group.funderAddress);

    const name =
      group.funderLabel ??
      `Cluster ${group.funderAddress.slice(0, 6)}...${group.funderAddress.slice(-4)}`;

    let combinedStable = 0;
    let maxActivity: Date | null = null;

    for (const m of membersList) {
      const stats = statsMap[m];
      if (stats) {
        if (stats.stableUsd) {
          combinedStable += parseFloat(stats.stableUsd);
        }
        if (stats.lastActivityAt) {
          if (!maxActivity || stats.lastActivityAt > maxActivity) {
            maxActivity = stats.lastActivityAt;
          }
        }
      }
    }

    clusters.push({
      funderAddress: group.funderAddress,
      funderChain: group.funderChain,
      name,
      colorHex,
      members: membersList,
      memberCount: membersList.length,
      combinedStableUsd: combinedStable.toFixed(8),
      lastActivityAt: maxActivity,
    });
  }

  return clusters;
}

export async function detectAndSyncClusters(prisma: PrismaClient): Promise<DetectedCluster[]> {
  // 1. Fetch non-terminal funding edges across all tracked wallets
  const edgeRows = await prisma.fundingEdge.findMany({
    where: {
      isTerminalEntity: false,
    },
    select: {
      rootAddress: true,
      rootChain: true,
      parentAddress: true,
      parentChain: true,
      isTerminalEntity: true,
      entityName: true,
    },
  });

  const edges: ClusterFundingEdgeInput[] = edgeRows.map((r) => ({
    rootAddress: r.rootAddress as Address,
    rootChain: prismaToChainSlug(r.rootChain),
    parentAddress: r.parentAddress as Address,
    parentChain: prismaToChainSlug(r.parentChain),
    isTerminalEntity: r.isTerminalEntity,
    funderLabel: r.entityName,
  }));

  // 2. Fetch stats for all tracked wallets
  const profiles = await prisma.walletProfile.findMany({
    select: {
      walletAddress: true,
      stableBalanceUsd: true,
      lastActivityAt: true,
    },
  });

  const statsMap: Record<string, ClusterMemberStats> = {};
  for (const p of profiles) {
    statsMap[p.walletAddress.toLowerCase()] = {
      stableUsd: p.stableBalanceUsd.toString(),
      lastActivityAt: p.lastActivityAt,
    };
  }

  const detectedClusters = detectClustersFromEdges(edges, statsMap);

  // 3. Sync into DB
  const detectedKeys = new Set<string>();

  for (const dc of detectedClusters) {
    const funderNorm = dc.funderAddress.toLowerCase();
    const chainPrisma = chainSlugToPrisma(dc.funderChain);
    detectedKeys.add(`${funderNorm}:${chainPrisma}`);

    const cluster = await prisma.cluster.upsert({
      where: {
        funderAddress_funderChain: {
          funderAddress: funderNorm,
          funderChain: chainPrisma,
        },
      },
      create: {
        name: dc.name,
        funderAddress: funderNorm,
        funderChain: chainPrisma,
        colorHex: dc.colorHex,
        memberCount: dc.memberCount,
        combinedStableUsd: dc.combinedStableUsd,
        lastActivityAt: dc.lastActivityAt,
      },
      update: {
        name: dc.name,
        memberCount: dc.memberCount,
        combinedStableUsd: dc.combinedStableUsd,
        lastActivityAt: dc.lastActivityAt,
      },
    });

    // Sync members
    const existingMembers = await prisma.clusterMember.findMany({
      where: { clusterId: cluster.id },
    });
    const currentMemberSet = new Set(existingMembers.map((m) => m.walletAddress.toLowerCase()));
    const targetMemberSet = new Set(dc.members);

    // Add new members
    for (const m of dc.members) {
      if (!currentMemberSet.has(m)) {
        await prisma.clusterMember.create({
          data: {
            clusterId: cluster.id,
            walletAddress: m,
            walletChain: chainPrisma,
          },
        });
      }
    }

    // Remove obsolete members
    for (const em of existingMembers) {
      if (!targetMemberSet.has(em.walletAddress.toLowerCase())) {
        await prisma.clusterMember.delete({
          where: {
            clusterId_walletAddress_walletChain: {
              clusterId: cluster.id,
              walletAddress: em.walletAddress,
              walletChain: em.walletChain,
            },
          },
        });
      }
    }
  }

  // 4. Delete obsolete clusters (< 2 members or no longer detected)
  const allDbClusters = await prisma.cluster.findMany();
  for (const c of allDbClusters) {
    const key = `${c.funderAddress.toLowerCase()}:${c.funderChain}`;
    if (!detectedKeys.has(key)) {
      await prisma.cluster.delete({
        where: { id: c.id },
      });
    }
  }

  return detectedClusters;
}
