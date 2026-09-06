import { prisma } from "@/server/db/client";
import type { AlertType, AlertState, Chain, Prisma } from "@/generated/prisma/client";

export interface GetAlertListParams {
  state?: AlertState;
  type?: AlertType;
  types?: AlertType[];
  walletAddress?: string;
  chain?: Chain;
  tokenAddress?: string;
  search?: string;
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}

export interface AlertListItem {
  id: string;
  walletAddress: string;
  walletChain: Chain;
  type: AlertType;
  state: AlertState;
  tokenAddress: string | null;
  tokenChain: Chain | null;
  tokenSymbol: string | null;
  amountUsd: Prisma.Decimal | null;
  clusterId: string | null;
  payloadJson: Prisma.JsonValue;
  evidenceJson: Prisma.JsonValue;
  dedupeKey: string;
  occurredAt: Date;
  createdAt: Date;
  readAt: Date | null;
  deliveredAt: Date | null;
  deliveryError: string | null;
  wallet?: {
    address: string;
    chain: Chain;
    ensName: string | null;
    label: string | null;
    edge: string | null;
    style: string | null;
    size: string | null;
    isSelf: boolean;
    clusterLinks?: Array<{
      clusterId: string;
      cluster: {
        id: string;
        name: string;
      };
    }>;
  };
}

export interface GetAlertListResult {
  items: AlertListItem[];
  nextCursor?: string;
  totalCount: number;
}

export interface AlertKpis {
  totalActive: number;
  armedCount: number;
  triggeredCount: number;
  exitRiskCount: number;
  unreadCount: number;
}

/**
 * Queries alerts with multi-dimensional filters, search, and cursor-based pagination.
 */
export async function getAlertList(params: GetAlertListParams = {}): Promise<GetAlertListResult> {
  const {
    state,
    type,
    types,
    walletAddress,
    chain,
    tokenAddress,
    search,
    unreadOnly,
    cursor,
    limit = 50,
  } = params;

  const where: Prisma.AlertEventWhereInput = {};

  if (state) {
    where.state = state;
  }

  if (types && types.length > 0) {
    where.type = { in: types };
  } else if (type) {
    where.type = type;
  }

  if (walletAddress) {
    where.walletAddress = walletAddress.toLowerCase();
  }

  if (chain) {
    where.walletChain = chain;
  }

  if (tokenAddress) {
    where.tokenAddress = tokenAddress.toLowerCase();
  }

  if (unreadOnly) {
    where.readAt = null;
  }

  if (search && search.trim() !== "") {
    const q = search.trim();
    where.OR = [
      { walletAddress: { contains: q, mode: "insensitive" } },
      { tokenSymbol: { contains: q, mode: "insensitive" } },
      { tokenAddress: { contains: q, mode: "insensitive" } },
      { wallet: { ensName: { contains: q, mode: "insensitive" } } },
      { wallet: { label: { contains: q, mode: "insensitive" } } },
    ];
  }

  const items = await prisma.alertEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      wallet: {
        select: {
          address: true,
          chain: true,
          ensName: true,
          label: true,
          edge: true,
          style: true,
          size: true,
          isSelf: true,
          clusterLinks: {
            select: {
              clusterId: true,
              cluster: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const totalCount = await prisma.alertEvent.count({ where });
  const nextCursor = items.length === limit ? items[items.length - 1].id : undefined;

  return {
    items: items as unknown as AlertListItem[],
    nextCursor,
    totalCount,
  };
}

/**
 * Acknowledges a single alert by marking readAt to current timestamp.
 */
export async function acknowledgeAlert(id: string) {
  return prisma.alertEvent.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

/**
 * Marks all unread alerts as read.
 */
export async function markAllAlertsRead() {
  return prisma.alertEvent.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });
}

/**
 * Returns the count of unread alerts (where readAt is null).
 */
export async function getUnreadAlertCount(): Promise<number> {
  return prisma.alertEvent.count({
    where: { readAt: null },
  });
}

/**
 * Returns KPI metrics across active alerts and wallet states.
 */
export async function getAlertKpis(): Promise<AlertKpis> {
  const [totalActive, armedCount, triggeredCount, exitRiskCount, unreadCount] =
    await prisma.$transaction([
      prisma.alertEvent.count(),
      prisma.alertEvent.count({ where: { state: "ARMED" } }),
      prisma.alertEvent.count({ where: { state: "TRIGGERED" } }),
      prisma.alertEvent.count({ where: { state: "EXIT_RISK" } }),
      prisma.alertEvent.count({ where: { readAt: null } }),
    ]);

  return {
    totalActive,
    armedCount,
    triggeredCount,
    exitRiskCount,
    unreadCount,
  };
}

export const alertListService = {
  getAlertList,
  acknowledgeAlert,
  markAllAlertsRead,
  getUnreadAlertCount,
  getAlertKpis,
};
