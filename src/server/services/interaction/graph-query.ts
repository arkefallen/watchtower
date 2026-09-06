import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

export interface GraphLoadInput {
  chain?: Chain;
  minUsd?: number;
  token?: string;
  direction?: "A_TO_B" | "B_TO_A" | "BOTH";
  timeFrom?: Date;
  timeTo?: Date;
  includeFunders?: boolean;
  includePrimaryWallets?: boolean;
  sizeMode?: "tag" | "balance";
}

export interface GraphNodePayload {
  id: string; // `${chain}:${address}`
  address: string;
  chain: Chain;
  ensName: string | null;
  label: string | null;
  sizeTag: string | null;
  stableBalanceUsd: number;
  alertState: "IDLE" | "ARMED" | "TRIGGERED";
  clusterId: string | null;
  clusterName: string | null;
  clusterColor: string | null;
  isSecondary: boolean;
  secondaryType?: "FUNDER" | "PRIMARY_WALLET";
}

export interface GraphEdgePayload {
  id: string; // `${id}`
  source: string; // `${chainA}:${addressA}`
  target: string; // `${chainB}:${addressB}`
  chain: Chain;
  totalUsd: number;
  txCount: number;
  usdAToB: number;
  usdBToA: number;
  countAToB: number;
  countBToA: number;
  firstAt: string | null;
  lastAt: string | null;
  topTokenSymbol: string | null;
  topTokenUsd: number | null;
  distinctTokenCount: number;
  label: string; // formatted TICKER · $USD
}

export interface CompoundClusterPayload {
  id: string; // clusterId
  name: string;
  colorHex: string;
  memberNodeIds: string[];
  isArmed?: boolean;
}

export interface GraphLoadResponse {
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
  clusters: CompoundClusterPayload[];
}

/**
 * Format compact USD representation, e.g. $450, $1.5K, $2.4M
 */
export function formatCompactUsd(amount: number): string {
  if (isNaN(amount) || amount === 0) return "$0";
  if (amount >= 1_000_000) {
    const val = (amount / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `$${val}M`;
  }
  if (amount >= 1_000) {
    const val = (amount / 1_000).toFixed(1).replace(/\.0$/, "");
    return `$${val}K`;
  }
  return `$${Math.round(amount)}`;
}

/**
 * Query graph nodes, edges, and compound clusters applying server-side filters.
 */
export async function loadGraphData(
  prisma: PrismaClient,
  input: GraphLoadInput = {}
): Promise<GraphLoadResponse> {
  const minUsd = input.minUsd ?? 100;

  // 1. Query tracked wallets
  const walletWhere: Prisma.WalletWhereInput = { isBlacklisted: false };
  if (input.chain) {
    walletWhere.chain = input.chain;
  }

  const trackedWallets = await prisma.wallet.findMany({
    where: walletWhere,
    include: {
      profile: true,
      alertState: true,
      clusterLinks: {
        include: {
          cluster: true,
        },
      },
    },
  });

  const nodesMap = new Map<string, GraphNodePayload>();

  for (const w of trackedWallets) {
    const nodeId = `${w.chain}:${w.address.toLowerCase()}`;
    const clusterLink = w.clusterLinks[0];
    const stableBal = w.profile?.stableBalanceUsd
      ? Number(w.profile.stableBalanceUsd)
      : 0;

    const alertSt = (w.alertState?.state as "IDLE" | "ARMED" | "TRIGGERED") ?? "IDLE";

    nodesMap.set(nodeId, {
      id: nodeId,
      address: w.address.toLowerCase(),
      chain: w.chain,
      ensName: w.ensName,
      label: w.label,
      sizeTag: w.size ?? null,
      stableBalanceUsd: stableBal,
      alertState: alertSt,
      clusterId: clusterLink?.clusterId ?? null,
      clusterName: clusterLink?.cluster?.name ?? null,
      clusterColor: clusterLink?.cluster?.colorHex ?? null,
      isSecondary: false,
    });
  }

  // 2. Query edges matching filters
  const edgeWhere: Prisma.InteractionEdgeWhereInput = {
    totalUsd: { gte: minUsd },
  };

  if (input.chain) {
    edgeWhere.chainA = input.chain;
    edgeWhere.chainB = input.chain;
  }

  if (input.timeFrom || input.timeTo) {
    edgeWhere.lastAt = {};
    if (input.timeFrom) edgeWhere.lastAt.gte = input.timeFrom;
    if (input.timeTo) edgeWhere.lastAt.lte = input.timeTo;
  }

  if (input.token) {
    const tokenQuery = input.token.trim().toLowerCase();
    edgeWhere.tokens = {
      some: {
        OR: [
          { tokenAddress: tokenQuery },
          { tokenSymbol: { equals: input.token.trim(), mode: "insensitive" } },
        ],
      },
    };
  }

  if (input.direction === "A_TO_B") {
    edgeWhere.countAToB = { gt: 0 };
  } else if (input.direction === "B_TO_A") {
    edgeWhere.countBToA = { gt: 0 };
  }

  const rawEdges = await prisma.interactionEdge.findMany({
    where: edgeWhere,
    orderBy: { totalUsd: "desc" },
  });

  const edges: GraphEdgePayload[] = [];

  for (const e of rawEdges) {
    const sourceNodeId = `${e.chainA}:${e.addressA.toLowerCase()}`;
    const targetNodeId = `${e.chainB}:${e.addressB.toLowerCase()}`;

    // Ensure both endpoints exist in our node set (or add if needed)
    if (!nodesMap.has(sourceNodeId) || !nodesMap.has(targetNodeId)) {
      continue;
    }

    const totalUsdNum = Number(e.totalUsd);
    const ticker = e.topTokenSymbol ?? "ETH";
    const label = `${ticker} · ${formatCompactUsd(totalUsdNum)}`;

    edges.push({
      id: e.id.toString(),
      source: sourceNodeId,
      target: targetNodeId,
      chain: e.chainA,
      totalUsd: totalUsdNum,
      txCount: e.txCount,
      usdAToB: Number(e.usdAToB),
      usdBToA: Number(e.usdBToA),
      countAToB: e.countAToB,
      countBToA: e.countBToA,
      firstAt: e.firstAt ? e.firstAt.toISOString() : null,
      lastAt: e.lastAt ? e.lastAt.toISOString() : null,
      topTokenSymbol: e.topTokenSymbol,
      topTokenUsd: e.topTokenUsd ? Number(e.topTokenUsd) : null,
      distinctTokenCount: e.distinctTokenCount,
      label,
    });
  }

  // 3. Optional Secondary Nodes (Funders / Primary Wallets)
  if (input.includeFunders || input.includePrimaryWallets) {
    const fundingWhere: Prisma.FundingEdgeWhereInput = {};
    if (input.chain) {
      fundingWhere.rootChain = input.chain;
    }
    if (input.includePrimaryWallets && !input.includeFunders) {
      fundingWhere.isPrimaryWallet = true;
    }

    const fundingEdges = await prisma.fundingEdge.findMany({
      where: fundingWhere,
      select: {
        parentAddress: true,
        parentChain: true,
        isPrimaryWallet: true,
        isTerminalEntity: true,
        entityName: true,
      },
    });

    for (const fe of fundingEdges) {
      const funderNodeId = `${fe.parentChain}:${fe.parentAddress.toLowerCase()}`;
      if (!nodesMap.has(funderNodeId)) {
        nodesMap.set(funderNodeId, {
          id: funderNodeId,
          address: fe.parentAddress.toLowerCase(),
          chain: fe.parentChain,
          ensName: null,
          label: fe.entityName ?? (fe.isPrimaryWallet ? "Primary Funder" : "Funder"),
          sizeTag: "S",
          stableBalanceUsd: 0,
          alertState: "IDLE",
          clusterId: null,
          clusterName: null,
          clusterColor: null,
          isSecondary: true,
          secondaryType: fe.isPrimaryWallet ? "PRIMARY_WALLET" : "FUNDER",
        });
      }
    }
  }

  // 4. Compound Clusters (group cluster members)
  const clustersMap = new Map<string, CompoundClusterPayload>();
  for (const node of nodesMap.values()) {
    if (node.clusterId && node.clusterColor) {
      let c = clustersMap.get(node.clusterId);
      if (!c) {
        const matchedCluster = trackedWallets.find((w) => w.clusterLinks[0]?.clusterId === node.clusterId)?.clusterLinks[0]?.cluster;
        c = {
          id: node.clusterId,
          name: node.clusterName ?? `Cluster ${node.clusterId.slice(0, 6)}`,
          colorHex: node.clusterColor,
          memberNodeIds: [],
          isArmed: matchedCluster?.isArmed ?? false,
        };
        clustersMap.set(node.clusterId, c);
      }
      c.memberNodeIds.push(node.id);
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    clusters: Array.from(clustersMap.values()),
  };
}
