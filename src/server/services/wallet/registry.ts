import type { PrismaClient, WalletEdgeTag, WalletStyleTag, WalletSizeTag, WatchPriority } from "@/generated/prisma/client";
import type { ChainSlug } from "@/lib/chains/types";
import { normalizeAddress, normalizeChain, chainSlugToPrisma, prismaToChainSlug } from "./normalize";

export interface WalletRegistryDeps {
  prisma: PrismaClient;
  queues?: {
    intake?: {
      add: (name: string, data: any, opts?: any) => Promise<any>;
    };
  };
}

export interface AddWalletInput {
  address: string;
  chain: string;
  label?: string;
  ensName?: string;
  edge?: WalletEdgeTag;
  style?: WalletStyleTag;
  size?: WalletSizeTag;
  notes?: string;
  isBlacklisted?: boolean;
  isSelf?: boolean;
  watchPriority?: WatchPriority;
  requestedBy?: "USER" | "IMPORT";
  importBatchId?: string;
  forceFullResync?: boolean;
}

export interface GetWalletInput {
  address: string;
  chain: string;
}

export interface UpdateWalletInput {
  address: string;
  chain: string;
  label?: string | null;
  notes?: string | null;
  edge?: WalletEdgeTag | null;
  style?: WalletStyleTag | null;
  size?: WalletSizeTag | null;
  isBlacklisted?: boolean;
  isSelf?: boolean;
  watchPriority?: WatchPriority;
}

export interface DeleteWalletInput {
  address: string;
  chain: string;
}

export interface ListWalletsInput {
  search?: string;
  chain?: string;
  edge?: WalletEdgeTag;
  style?: WalletStyleTag;
  size?: WalletSizeTag;
  isBlacklisted?: boolean;
  isSelf?: boolean;
  watchPriority?: WatchPriority;
  clusterId?: string;
  cursor?: { address: string; chain: string };
  take?: number;
}

export function createWalletRegistry(deps: WalletRegistryDeps) {
  const { prisma, queues } = deps;

  return {
    async addWallet(input: AddWalletInput) {
      const address = normalizeAddress(input.address);
      const chainSlug = normalizeChain(input.chain);
      const prismaChain = chainSlugToPrisma(chainSlug);

      const wallet = await prisma.wallet.upsert({
        where: {
          address_chain: {
            address,
            chain: prismaChain,
          },
        },
        create: {
          address,
          chain: prismaChain,
          label: input.label,
          ensName: input.ensName,
          edge: input.edge,
          style: input.style,
          size: input.size,
          notes: input.notes,
          isBlacklisted: input.isBlacklisted ?? false,
          isSelf: input.isSelf ?? false,
          watchPriority: input.watchPriority ?? "NORMAL",
        },
        update: {
          label: input.label !== undefined ? input.label : undefined,
          ensName: input.ensName !== undefined ? input.ensName : undefined,
          edge: input.edge !== undefined ? input.edge : undefined,
          style: input.style !== undefined ? input.style : undefined,
          size: input.size !== undefined ? input.size : undefined,
          notes: input.notes !== undefined ? input.notes : undefined,
          isBlacklisted: input.isBlacklisted !== undefined ? input.isBlacklisted : undefined,
          isSelf: input.isSelf !== undefined ? input.isSelf : undefined,
          watchPriority: input.watchPriority !== undefined ? input.watchPriority : undefined,
        },
      });

      await prisma.syncState.upsert({
        where: {
          walletAddress_chain: {
            walletAddress: address,
            chain: prismaChain,
          },
        },
        create: {
          walletAddress: address,
          chain: prismaChain,
          status: "NEVER_SYNCED",
        },
        update: {},
      });

      const jobId = `intake:${chainSlug}:${address}`;
      if (queues?.intake) {
        await queues.intake.add(
          "walletIntake",
          {
            address,
            chain: chainSlug,
            requestedBy: input.requestedBy ?? "USER",
            importBatchId: input.importBatchId,
            forceFullResync: input.forceFullResync ?? false,
          },
          { jobId }
        );

        await prisma.jobRun.upsert({
          where: { id: jobId },
          create: {
            id: jobId,
            queueName: "watchtower.intake",
            jobName: "walletIntake",
            payloadJson: {
              address,
              chain: chainSlug,
              requestedBy: input.requestedBy ?? "USER",
            },
            status: "QUEUED",
          },
          update: {
            status: "QUEUED",
            error: null,
          },
        });
      }

      return wallet;
    },

    async getWallet(input: GetWalletInput) {
      const address = normalizeAddress(input.address);
      const chainSlug = normalizeChain(input.chain);
      const prismaChain = chainSlugToPrisma(chainSlug);

      return prisma.wallet.findUnique({
        where: {
          address_chain: {
            address,
            chain: prismaChain,
          },
        },
        include: {
          profile: true,
          syncState: true,
          alertState: true,
          clusterLinks: {
            include: {
              cluster: true,
            },
          },
        },
      });
    },

    async updateWallet(input: UpdateWalletInput) {
      const address = normalizeAddress(input.address);
      const chainSlug = normalizeChain(input.chain);
      const prismaChain = chainSlugToPrisma(chainSlug);

      return prisma.wallet.update({
        where: {
          address_chain: {
            address,
            chain: prismaChain,
          },
        },
        data: {
          label: input.label,
          notes: input.notes,
          edge: input.edge,
          style: input.style,
          size: input.size,
          isBlacklisted: input.isBlacklisted,
          isSelf: input.isSelf,
          watchPriority: input.watchPriority,
        },
      });
    },

    async deleteWallet(input: DeleteWalletInput) {
      const address = normalizeAddress(input.address);
      const chainSlug = normalizeChain(input.chain);
      const prismaChain = chainSlugToPrisma(chainSlug);

      await prisma.wallet.delete({
        where: {
          address_chain: {
            address,
            chain: prismaChain,
          },
        },
      });

      return { success: true };
    },

    async listWallets(input: ListWalletsInput = {}) {
      const take = Math.min(input.take ?? 50, 200);
      const where: any = {};

      if (input.chain) {
        where.chain = chainSlugToPrisma(normalizeChain(input.chain));
      }
      if (input.edge) where.edge = input.edge;
      if (input.style) where.style = input.style;
      if (input.size) where.size = input.size;
      if (input.isBlacklisted !== undefined) where.isBlacklisted = input.isBlacklisted;
      if (input.isSelf !== undefined) where.isSelf = input.isSelf;
      if (input.watchPriority) where.watchPriority = input.watchPriority;

      if (input.clusterId) {
        where.clusterLinks = {
          some: { clusterId: input.clusterId },
        };
      }

      if (input.search) {
        const term = input.search.trim().toLowerCase();
        where.OR = [
          { address: { contains: term } },
          { ensName: { contains: term, mode: "insensitive" } },
          { label: { contains: term, mode: "insensitive" } },
        ];
      }

      const findManyArgs: any = {
        where,
        take: take + 1,
        orderBy: [{ updatedAt: "desc" }, { address: "asc" }],
        include: {
          profile: true,
          syncState: true,
          alertState: true,
          clusterLinks: {
            include: {
              cluster: true,
            },
          },
        },
      };

      if (input.cursor) {
        findManyArgs.cursor = {
          address_chain: {
            address: normalizeAddress(input.cursor.address),
            chain: chainSlugToPrisma(normalizeChain(input.cursor.chain)),
          },
        };
        findManyArgs.skip = 1;
      }

      const [items, totalCount] = await Promise.all([
        prisma.wallet.findMany(findManyArgs),
        prisma.wallet.count({ where }),
      ]);

      let nextCursor: { address: string; chain: string } | undefined;
      if (items.length > take) {
        const nextItem = items.pop()!;
        nextCursor = {
          address: nextItem.address,
          chain: prismaToChainSlug(nextItem.chain),
        };
      }

      return {
        items,
        totalCount,
        nextCursor,
      };
    },
  };
}
