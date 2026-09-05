export interface RateLimiterSnapshot {
  provider: string;
  tokensAvailable: number;
  refillPerSecond: number;
  callsToday: number;
  dailyLimit: number | null;
  remainingToday: number | null;
  rateLimitHitsToday: number;
  windowResetsAt: Date;
}
