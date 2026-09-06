// src/server/services/cluster/armed-state.ts
import type { PrismaClient } from "@/generated/prisma/client";

export interface ClusterArmedStateResult {
  clusterId: string;
  isArmed: boolean;
  armedAt: Date | null;
}

/**
 * Sets the isArmed status and armedAt timestamp on a Cluster record.
 */
export async function setClusterArmedState(
  prisma: PrismaClient,
  clusterId: string,
  isArmed: boolean,
  armedAt: Date | null = isArmed ? new Date() : null
): Promise<ClusterArmedStateResult> {
  const updated = await prisma.cluster.update({
    where: { id: clusterId },
    data: {
      isArmed,
      armedAt: isArmed ? armedAt : null,
    },
    select: {
      id: true,
      isArmed: true,
      armedAt: true,
    },
  });

  return {
    clusterId: updated.id,
    isArmed: updated.isArmed,
    armedAt: updated.armedAt,
  };
}
