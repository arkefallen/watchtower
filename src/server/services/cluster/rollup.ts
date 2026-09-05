import type { PrismaClient } from "@/generated/prisma/client";

export async function refreshClusterRollups(prisma: PrismaClient, clusterId: string) {
  const members = await prisma.clusterMember.findMany({
    where: { clusterId },
    select: { walletAddress: true, walletChain: true },
  });

  let totalStable = 0;
  let maxActivity: Date | null = null;

  for (const m of members) {
    const profile = await prisma.walletProfile.findUnique({
      where: {
        walletAddress_walletChain: {
          walletAddress: m.walletAddress,
          walletChain: m.walletChain,
        },
      },
      select: { stableBalanceUsd: true, lastActivityAt: true },
    });
    if (profile?.stableBalanceUsd) {
      totalStable += parseFloat(profile.stableBalanceUsd.toString());
    }
    if (profile?.lastActivityAt) {
      if (!maxActivity || profile.lastActivityAt > maxActivity) {
        maxActivity = profile.lastActivityAt;
      }
    }
  }

  return prisma.cluster.update({
    where: { id: clusterId },
    data: {
      memberCount: members.length,
      combinedStableUsd: totalStable.toFixed(8),
      lastActivityAt: maxActivity,
    },
  });
}
