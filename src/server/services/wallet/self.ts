// src/server/services/wallet/self.ts
import { prisma as defaultPrisma } from "@/server/db/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { chainSlugToPrisma } from "./normalize";
import type { Address, ChainSlug } from "@/lib/chains/types";

/**
 * Service for querying, registering, and toggling isSelf wallets (FR-6.1, FR-1.5).
 */
export async function getSelfWallets(injectedPrisma: PrismaClient = defaultPrisma) {
  return injectedPrisma.wallet.findMany({
    where: { isSelf: true },
    include: {
      profile: true,
      syncState: true,
      _count: {
        select: {
          ownTrades: true,
          movements: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function isSelfWallet(
  address: string,
  chain: ChainSlug,
  injectedPrisma: PrismaClient = defaultPrisma
): Promise<boolean> {
  const normAddress = address.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);
  const wallet = await injectedPrisma.wallet.findUnique({
    where: {
      address_chain: {
        address: normAddress,
        chain: prismaChain,
      },
    },
    select: { isSelf: true },
  });
  return Boolean(wallet?.isSelf);
}

export async function setSelfWallet(
  address: string,
  chain: ChainSlug,
  isSelf: boolean,
  injectedPrisma: PrismaClient = defaultPrisma
) {
  const normAddress = address.toLowerCase();
  const prismaChain = chainSlugToPrisma(chain);
  return injectedPrisma.wallet.update({
    where: {
      address_chain: {
        address: normAddress,
        chain: prismaChain,
      },
    },
    data: { isSelf },
  });
}
