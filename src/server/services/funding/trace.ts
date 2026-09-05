import type { Address, ChainSlug, ChainAdapter } from "@/lib/chains/types";
import { fetchInboundFunding } from "./inbound";
import type { PrismaClient } from "@/generated/prisma/client";
import { saveFundingTree, loadFundingTreeFromDb } from "@/server/db/repositories/funding-repo";

export type TraceStopReason =
  | "TERMINAL_ENTITY"
  | "DEPTH_LIMIT"
  | "NO_INBOUND"
  | "SELF_REFERENCE"
  | "BUDGET_EXHAUSTED"
  | "NOT_STOPPED";

export interface FundingTraceInput {
  rootAddress: Address;
  rootChain: ChainSlug;
  /** Default 3, max 6 (FR-2.1). Values above 6 are rejected. */
  maxDepth?: number;
  /** DEEP mode extends one branch beyond maxDepth until terminal/dead end/6 (FR-2.7). */
  mode?: "DEFAULT" | "DEEP";
  /** Required in DEEP mode: the node whose branch is being extended. */
  branch?: { address: Address; chain: ChainSlug };
  /** Caps API spend for one trace; exceeding it stops with BUDGET_EXHAUSTED. */
  callBudget?: number;
  signal?: AbortSignal;
  onProgress?: (p: { stage: string; progress: number }) => void | Promise<void>;
}

export interface FundingTreeNode {
  address: Address;
  chain: ChainSlug;
  depth: number;
  label: string | null;
  entityKind: string | null;
  entityName: string | null;
  isTerminalEntity: boolean;
  isTracked: boolean;
  totalUsdFunded: string;
  fundingCount: number;
  internalFundingCount: number;
  firstFundedAt: Date | null;
  lastFundedAt: Date | null;
  stopReason: TraceStopReason;
  isRepeatedFunder: boolean;
  fundedFirstGas: boolean;
  isProfitSink: boolean;
  profitSinkRatio: string | null;
  isLargestOutflowDestination: boolean;
  isPrimaryWallet: boolean;
  primaryLabel: "PRIMARY_WALLET" | "REPEATED_FUNDER_CANDIDATE" | "PROFIT_SINK_CANDIDATE" | null;
  canDeepTrace: boolean;
  children: FundingTreeNode[];
}

export interface FundingTraceOutput {
  root: FundingTreeNode;
  nodesExpanded: number;
  callsSpent: number;
  truncated: boolean;
  sharedFunderHits: Array<{
    funder: Address;
    chain: ChainSlug;
    trackedWallets: Array<{ address: Address; chain: ChainSlug }>;
  }>;
}

export interface EntityService {
  isTerminal: (
    address: Address,
    chain?: ChainSlug
  ) => Promise<{ name: string; kind: string } | null>;
  getEntityLabel?: (
    address: Address,
    chain?: ChainSlug
  ) => Promise<{ name: string; kind: string } | null>;
}

export interface FundingDeps {
  adapter: ChainAdapter;
  entities: EntityService;
  nativePriceUsd?: string | null;
  prisma?: PrismaClient;
}

export async function buildFundingTree(
  input: FundingTraceInput,
  deps: FundingDeps
): Promise<FundingTraceOutput> {
  const { rootAddress, rootChain, mode = "DEFAULT", branch, callBudget = 100 } = input;
  const isDeepMode = mode === "DEEP";
  const effectiveMaxDepth = isDeepMode ? 6 : (input.maxDepth ?? 3);
  const branchTarget = branch ? branch.address.toLowerCase() : null;

  if (effectiveMaxDepth > 6) {
    throw new Error("maxDepth cannot exceed 6");
  }

  const { adapter, entities, nativePriceUsd, prisma } = deps;
  let callsSpent = 0;
  let nodesExpanded = 0;
  let truncated = false;

  // Root node initialization
  const rootEntity = (await entities.getEntityLabel?.(rootAddress, rootChain)) ?? null;

  const rootNode: FundingTreeNode = {
    address: rootAddress,
    chain: rootChain,
    depth: 0,
    label: null,
    entityKind: rootEntity?.kind ?? null,
    entityName: rootEntity?.name ?? null,
    isTerminalEntity: false,
    isTracked: true,
    totalUsdFunded: "0",
    fundingCount: 0,
    internalFundingCount: 0,
    firstFundedAt: null,
    lastFundedAt: null,
    stopReason: "NOT_STOPPED",
    isRepeatedFunder: false,
    fundedFirstGas: false,
    isProfitSink: false,
    profitSinkRatio: null,
    isLargestOutflowDestination: false,
    isPrimaryWallet: false,
    primaryLabel: null,
    canDeepTrace: false,
    children: [],
  };

  const visited = new Set<string>();
  visited.add(rootAddress.toLowerCase());

  // BFS Queue
  const queue: FundingTreeNode[] = [rootNode];

  while (queue.length > 0) {
    if (input.signal?.aborted) break;

    const current = queue.shift()!;

    if (current.depth >= effectiveMaxDepth) {
      if (current.depth > 0 && current.stopReason === "NOT_STOPPED") {
        current.stopReason = "DEPTH_LIMIT";
        current.canDeepTrace = effectiveMaxDepth < 6;
      }
      continue;
    }

    if (current.isTerminalEntity) {
      current.stopReason = "TERMINAL_ENTITY";
      current.canDeepTrace = false;
      continue;
    }

    if (callsSpent >= callBudget) {
      truncated = true;
      current.stopReason = "BUDGET_EXHAUSTED";
      break;
    }

    // Fetch inbound funding
    const inboundSummaries = await fetchInboundFunding(
      current.address,
      adapter,
      nativePriceUsd ?? null
    );
    callsSpent += 2; // 1 native txs call + 1 internal txs call

    if (inboundSummaries.length === 0) {
      if (current.depth > 0 && current.stopReason === "NOT_STOPPED") {
        current.stopReason = "NO_INBOUND";
        current.canDeepTrace = false;
      }
      continue;
    }

    for (const funder of inboundSummaries) {
      const funderNorm = funder.funderAddress.toLowerCase();

      // Cycle detection
      if (funderNorm === current.address.toLowerCase() || visited.has(funderNorm)) {
        current.children.push({
          address: funder.funderAddress,
          chain: rootChain,
          depth: current.depth + 1,
          label: null,
          entityKind: null,
          entityName: null,
          isTerminalEntity: false,
          isTracked: false,
          totalUsdFunded: funder.totalUsd,
          fundingCount: funder.fundingCount,
          internalFundingCount: funder.internalFundingCount,
          firstFundedAt: funder.firstFundedAt,
          lastFundedAt: funder.lastFundedAt,
          stopReason: "SELF_REFERENCE",
          isRepeatedFunder: funder.fundingCount >= 2,
          fundedFirstGas: funder.fundedFirstGas,
          isProfitSink: false,
          profitSinkRatio: null,
          isLargestOutflowDestination: false,
          isPrimaryWallet: false,
          primaryLabel: null,
          canDeepTrace: false,
          children: [],
        });
        continue;
      }

      // Check entity classification
      const entity =
        (await entities.getEntityLabel?.(funder.funderAddress, rootChain)) ??
        (await entities.isTerminal(funder.funderAddress, rootChain));

      // Bridges and CEXs are terminal entities (FR-2.2, D-2). HUMAN labels are NOT terminal.
      const isTerminal =
        entity !== null &&
        (entity.kind === "CEX" || entity.kind === "BRIDGE" || entity.kind === "ROUTER");

      const nextDepth = current.depth + 1;
      let stopReason: TraceStopReason = "NOT_STOPPED";
      let canDeepTrace = false;

      if (isTerminal) {
        stopReason = "TERMINAL_ENTITY";
      } else if (nextDepth >= effectiveMaxDepth) {
        stopReason = "DEPTH_LIMIT";
        canDeepTrace = effectiveMaxDepth < 6;
      }

      const childNode: FundingTreeNode = {
        address: funder.funderAddress,
        chain: rootChain,
        depth: nextDepth,
        label: null,
        entityKind: entity?.kind ?? null,
        entityName: entity?.name ?? null,
        isTerminalEntity: isTerminal,
        isTracked: false,
        totalUsdFunded: funder.totalUsd,
        fundingCount: funder.fundingCount,
        internalFundingCount: funder.internalFundingCount,
        firstFundedAt: funder.firstFundedAt,
        lastFundedAt: funder.lastFundedAt,
        stopReason,
        isRepeatedFunder: funder.fundingCount >= 2,
        fundedFirstGas: funder.fundedFirstGas,
        isProfitSink: false,
        profitSinkRatio: null,
        isLargestOutflowDestination: false,
        isPrimaryWallet: false,
        primaryLabel: null,
        canDeepTrace,
        children: [],
      };

      current.children.push(childNode);
      nodesExpanded++;
      visited.add(funderNorm);

      let shouldEnqueue = !isTerminal && nextDepth < effectiveMaxDepth;
      if (isDeepMode && branchTarget && current.depth === 0) {
        if (funderNorm !== branchTarget) {
          shouldEnqueue = false;
        }
      }

      if (shouldEnqueue) {
        queue.push(childNode);
      }
    }
  }

  // Persist if prisma is provided
  if (prisma) {
    await saveFundingTree(prisma, rootNode);
  }

  return {
    root: rootNode,
    nodesExpanded,
    callsSpent,
    truncated,
    sharedFunderHits: [],
  };
}

export async function loadFundingTree(
  rootAddress: Address,
  rootChain: ChainSlug,
  prisma: PrismaClient
): Promise<FundingTreeNode | null> {
  return loadFundingTreeFromDb(prisma, rootAddress, rootChain);
}
