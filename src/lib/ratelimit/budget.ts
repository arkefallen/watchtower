import { RateLimitTimeoutError } from "./token-bucket";

export type CallPriority = "INTERACTIVE" | "BACKGROUND" | "BULK";

export class DailyBudgetExceededError extends Error {
  constructor(public readonly provider: string) {
    super(`Daily budget exceeded for provider: ${provider}`);
    this.name = "DailyBudgetExceededError";
  }
}

export interface DailyBudgetConfig {
  provider: string;
  dailyLimit: number;
  reservedForInteractivePct: number;
}

export interface DailyCounter {
  get: () => Promise<number>;
  increment: (amount: number) => Promise<number>;
}

export function createBudgetGuard(config: DailyBudgetConfig, counter: DailyCounter) {
  const reserve = Math.ceil(config.dailyLimit * config.reservedForInteractivePct / 100);
  return {
    async acquire(cost: number, priority: CallPriority): Promise<void> {
      const calls = await counter.get();
      const ceiling = priority === "INTERACTIVE" ? config.dailyLimit : config.dailyLimit - reserve;
      if (calls + cost > ceiling) throw new DailyBudgetExceededError(config.provider);
    },
    async record(cost: number): Promise<void> {
      const calls = await counter.increment(cost);
      if (calls > config.dailyLimit) throw new DailyBudgetExceededError(config.provider);
    },
    remaining: async (): Promise<{ dayCalls: number; dayLimit: number; remaining: number }> => {
      const dayCalls = await counter.get();
      return { dayCalls, dayLimit: config.dailyLimit, remaining: Math.max(0, config.dailyLimit - dayCalls) };
    },
  };
}

export { RateLimitTimeoutError };
