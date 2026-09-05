import type { PrismaClient, Chain } from "@/generated/prisma/client";
import { TraceStopReason, EntityKind, FundingEdgeKind } from "@/generated/prisma/client";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { chainSlugToPrisma, prismaToChainSlug } from "@/server/services/wallet/normalize";
import type { FundingTreeNode } from "@/server/services/funding/trace";
import { mapFundingEdgeKind } from "@/server/services/funding/primary-wallet";

export async function saveFundingTree(
  prisma: PrismaClient,
  root: FundingTreeNode
): Promise<void> {
  const rootAddressNorm = root.address.toLowerCase();
  const rootChainPrisma = chainSlugToPrisma(root.chain);

  // Collect all nodes and edges
  interface EdgeRecord {
    rootAddress: string;
    rootChain: Chain;
    childAddress: string;
    childChain: Chain;
    parentAddress: string;
    parentChain: Chain;
    depth: number;
    totalUsd: string;
    eventsCount: number;
    internalEventsCount: number;
    nativeEventsCount: number;
    firstAt: Date | null;
    lastAt: Date | null;
    isRepeatedFunder: boolean;
    fundedFirstGas: boolean;
    isProfitSink: boolean;
    profitSinkRatio: string | null;
    isLargestOutflowDestination: boolean;
    isPrimaryWallet: boolean;
    isTerminalEntity: boolean;
    entityName: string | null;
    stopReason: TraceStopReason;
  }

  const nodesToSave = new Map<string, FundingTreeNode>();
  const edgesToSave: EdgeRecord[] = [];

  function traverse(node: FundingTreeNode, parentOfNode: FundingTreeNode | null) {
    const key = `${node.chain}:${node.address.toLowerCase()}`;
    nodesToSave.set(key, node);

    if (parentOfNode) {
      // In funding tree, node is the funder (parent) and parentOfNode is the recipient (child)
      edgesToSave.push({
        rootAddress: rootAddressNorm,
        rootChain: rootChainPrisma,
        childAddress: parentOfNode.address.toLowerCase(),
        childChain: chainSlugToPrisma(parentOfNode.chain),
        parentAddress: node.address.toLowerCase(),
        parentChain: chainSlugToPrisma(node.chain),
        depth: node.depth,
        totalUsd: node.totalUsdFunded,
        eventsCount: node.fundingCount,
        internalEventsCount: node.internalFundingCount,
        nativeEventsCount: node.fundingCount - node.internalFundingCount,
        firstAt: node.firstFundedAt,
        lastAt: node.lastFundedAt,
        isRepeatedFunder: node.isRepeatedFunder,
        fundedFirstGas: node.fundedFirstGas,
        isProfitSink: node.isProfitSink,
        profitSinkRatio: node.profitSinkRatio,
        isLargestOutflowDestination: node.isLargestOutflowDestination,
        isPrimaryWallet: node.isPrimaryWallet,
        isTerminalEntity: node.isTerminalEntity,
        entityName: node.entityName,
        stopReason: node.stopReason as TraceStopReason,
      });
    }

    for (const child of node.children) {
      traverse(child, node);
    }
  }

  traverse(root, null);

  // 1. Upsert FundingNode rows
  for (const node of nodesToSave.values()) {
    const addr = node.address.toLowerCase();
    const chain = chainSlugToPrisma(node.chain);

    await prisma.fundingNode.upsert({
      where: {
        address_chain: {
          address: addr,
          chain,
        },
      },
      create: {
        address: addr,
        chain,
        isTracked: node.isTracked,
        entityKind: node.entityKind as EntityKind | null,
        entityName: node.entityName,
        isTerminal: node.isTerminalEntity,
        maxExpandedDepth: node.depth,
        lastExpandedAt: new Date(),
        stopReason: node.stopReason as TraceStopReason,
        inboundFetchedAt: new Date(),
      },
      update: {
        isTracked: node.isTracked,
        entityKind: node.entityKind as EntityKind | null,
        entityName: node.entityName,
        isTerminal: node.isTerminalEntity,
        maxExpandedDepth: node.depth,
        lastExpandedAt: new Date(),
        stopReason: node.stopReason as TraceStopReason,
      },
    });
  }

  // 2. Upsert FundingEdge rows
  for (const edge of edgesToSave) {
    await prisma.fundingEdge.upsert({
      where: {
        funding_edge_key: {
          rootAddress: edge.rootAddress,
          rootChain: edge.rootChain,
          childAddress: edge.childAddress,
          childChain: edge.childChain,
          parentAddress: edge.parentAddress,
          parentChain: edge.parentChain,
        },
      },
      create: {
        rootAddress: edge.rootAddress,
        rootChain: edge.rootChain,
        childAddress: edge.childAddress,
        childChain: edge.childChain,
        parentAddress: edge.parentAddress,
        parentChain: edge.parentChain,
        depth: edge.depth,
        totalUsd: edge.totalUsd,
        eventsCount: edge.eventsCount,
        internalEventsCount: edge.internalEventsCount,
        nativeEventsCount: edge.nativeEventsCount,
        firstAt: edge.firstAt,
        lastAt: edge.lastAt,
        isRepeatedFunder: edge.isRepeatedFunder,
        fundedFirstGas: edge.fundedFirstGas,
        isProfitSink: edge.isProfitSink,
        profitSinkRatio: edge.profitSinkRatio,
        isLargestOutflowDestination: edge.isLargestOutflowDestination,
        kind: mapFundingEdgeKind({
          isPrimaryWallet: edge.isPrimaryWallet,
          isRepeatedFunder: edge.isRepeatedFunder,
          isProfitSink: edge.isProfitSink,
        }) as FundingEdgeKind,
        isTerminalEntity: edge.isTerminalEntity,
        entityName: edge.entityName,
        stopReason: edge.stopReason,
        computedAt: new Date(),
      },
      update: {
        depth: edge.depth,
        totalUsd: edge.totalUsd,
        eventsCount: edge.eventsCount,
        internalEventsCount: edge.internalEventsCount,
        nativeEventsCount: edge.nativeEventsCount,
        firstAt: edge.firstAt,
        lastAt: edge.lastAt,
        kind: mapFundingEdgeKind({
          isPrimaryWallet: edge.isPrimaryWallet,
          isRepeatedFunder: edge.isRepeatedFunder,
          isProfitSink: edge.isProfitSink,
        }) as FundingEdgeKind,
        isRepeatedFunder: edge.isRepeatedFunder,
        fundedFirstGas: edge.fundedFirstGas,
        isProfitSink: edge.isProfitSink,
        profitSinkRatio: edge.profitSinkRatio,
        isLargestOutflowDestination: edge.isLargestOutflowDestination,
        isPrimaryWallet: edge.isPrimaryWallet,
        isTerminalEntity: edge.isTerminalEntity,
        entityName: edge.entityName,
        stopReason: edge.stopReason,
        computedAt: new Date(),
      },
    });
  }
}

export async function loadFundingTreeFromDb(
  prisma: PrismaClient,
  rootAddress: Address,
  rootChain: ChainSlug
): Promise<FundingTreeNode | null> {
  const rootAddressNorm = rootAddress.toLowerCase();
  const rootChainPrisma = chainSlugToPrisma(rootChain);

  const rootNodeRow = await prisma.fundingNode.findUnique({
    where: {
      address_chain: {
        address: rootAddressNorm,
        chain: rootChainPrisma,
      },
    },
  });

  if (!rootNodeRow) return null;

  const edges = await prisma.fundingEdge.findMany({
    where: {
      rootAddress: rootAddressNorm,
      rootChain: rootChainPrisma,
    },
    orderBy: {
      depth: "asc",
    },
  });

  // Reconstruct tree
  function buildSubtree(currentAddress: string, currentDepth: number): FundingTreeNode[] {
    const matchingEdges = edges.filter(
      (e) => e.childAddress === currentAddress && e.depth === currentDepth + 1
    );

    return matchingEdges.map((edge) => ({
      address: edge.parentAddress as Address,
      chain: prismaToChainSlug(edge.parentChain),
      depth: edge.depth,
      label: null,
      entityKind: null,
      entityName: edge.entityName,
      isTerminalEntity: edge.isTerminalEntity,
      isTracked: false,
      totalUsdFunded: edge.totalUsd.toString(),
      fundingCount: edge.eventsCount,
      internalFundingCount: edge.internalEventsCount,
      firstFundedAt: edge.firstAt,
      lastFundedAt: edge.lastAt,
      stopReason: edge.stopReason as any,
      isRepeatedFunder: edge.isRepeatedFunder,
      fundedFirstGas: edge.fundedFirstGas,
      isProfitSink: edge.isProfitSink,
      profitSinkRatio: edge.profitSinkRatio?.toString() ?? null,
      isLargestOutflowDestination: edge.isLargestOutflowDestination,
      isPrimaryWallet: edge.isPrimaryWallet,
      primaryLabel: edge.isPrimaryWallet
        ? "PRIMARY_WALLET"
        : edge.isRepeatedFunder
          ? "REPEATED_FUNDER_CANDIDATE"
          : edge.isProfitSink
            ? "PROFIT_SINK_CANDIDATE"
            : null,
      canDeepTrace: edge.stopReason === "DEPTH_LIMIT",
      children: buildSubtree(edge.parentAddress, edge.depth),
    }));
  }

  return {
    address: rootAddress,
    chain: rootChain,
    depth: 0,
    label: null,
    entityKind: rootNodeRow.entityKind as any,
    entityName: rootNodeRow.entityName,
    isTerminalEntity: rootNodeRow.isTerminal,
    isTracked: rootNodeRow.isTracked,
    totalUsdFunded: "0",
    fundingCount: 0,
    internalFundingCount: 0,
    firstFundedAt: null,
    lastFundedAt: null,
    stopReason: rootNodeRow.stopReason as any,
    isRepeatedFunder: false,
    fundedFirstGas: false,
    isProfitSink: false,
    profitSinkRatio: null,
    isLargestOutflowDestination: false,
    isPrimaryWallet: false,
    primaryLabel: null,
    canDeepTrace: false,
    children: buildSubtree(rootAddressNorm, 0),
  };
}
