import Redis from "ioredis";

import { loadEnv } from "@/lib/env";

export async function GET(): Promise<Response> {
  let db: "ok" | "down" = "down";
  let redis: "ok" | "down" = "down";
  try {
    const { prisma } = await import("@/server/db/client");
    await prisma.setting.count();
    db = "ok";
  } catch {
    db = "down";
  }
  try {
    const connection = new Redis(loadEnv().REDIS_URL);
    await connection.ping();
    redis = "ok";
    await connection.quit();
  } catch {
    redis = "down";
  }
  const env = loadEnv();
  const quota = [
    { provider: "etherscan", callsToday: 0, dailyLimit: 100000, remainingToday: 100000 },
    ...(env.ALCHEMY_API_KEY ? [{ provider: "alchemy-robinhood", callsToday: 0, dailyLimit: null, remainingToday: null }] : []),
    ...(env.BLOCKSCOUT_API_KEY ? [{ provider: "blockscout-robinhood", callsToday: 0, dailyLimit: null, remainingToday: null }] : []),
    ...(env.DEXSCREENER_ENABLED ? [{ provider: "dexscreener", callsToday: 0, dailyLimit: 20000, remainingToday: 20000 }] : []),
    ...(env.COINGECKO_API_KEY ? [{ provider: "coingecko", callsToday: 0, dailyLimit: null, remainingToday: null }] : []),
  ];
  const healthy = db === "ok" && redis === "ok";
  return Response.json({
    status: healthy ? "ok" : "degraded",
    db,
    redis,
    migration: "0001_phase0_initial",
    quota,
  }, { status: healthy ? 200 : 503 });
}
