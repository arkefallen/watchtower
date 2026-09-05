import type { PrismaClient } from "@/generated/prisma/client";
import {
  WalletEdgeTag,
  WalletStyleTag,
  WalletSizeTag,
  WatchPriority,
} from "@/generated/prisma/client";
import type { Address, ChainSlug } from "@/lib/chains/types";
import { chainSlugToPrisma } from "./normalize";

export interface UpdateWalletTagsInput {
  address: string;
  chain: ChainSlug;
  label?: string | null;
  notes?: string | null;
  edge?: WalletEdgeTag | null;
  style?: WalletStyleTag | null;
  size?: WalletSizeTag | null;
  isBlacklisted?: boolean;
  isSelf?: boolean;
  watchPriority?: WatchPriority;
}

export async function updateWalletTags(
  prisma: PrismaClient,
  input: UpdateWalletTagsInput
) {
  const normAddress = input.address.toLowerCase();
  const prismaChain = chainSlugToPrisma(input.chain);

  return prisma.wallet.update({
    where: {
      address_chain: {
        address: normAddress,
        chain: prismaChain,
      },
    },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.edge !== undefined && { edge: input.edge }),
      ...(input.style !== undefined && { style: input.style }),
      ...(input.size !== undefined && { size: input.size }),
      ...(input.isBlacklisted !== undefined && { isBlacklisted: input.isBlacklisted }),
      ...(input.isSelf !== undefined && { isSelf: input.isSelf }),
      ...(input.watchPriority !== undefined && { watchPriority: input.watchPriority }),
    },
  });
}
