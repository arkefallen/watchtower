export type EtherscanErrorCode =
  | "RATE_LIMITED" | "INVALID_API_KEY" | "DAILY_LIMIT_REACHED" | "NETWORK"
  | "TIMEOUT" | "SERVER_ERROR" | "BAD_REQUEST" | "EMPTY_RESULT" | "UNKNOWN";

export class EtherscanClientError extends Error {
  constructor(public readonly code: EtherscanErrorCode, message: string) {
    super(message);
    this.name = "EtherscanClientError";
  }
}

export function classifyEtherscanMessage(message: string): EtherscanErrorCode {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid api key") || normalized.includes("invalid apikey")) return "INVALID_API_KEY";
  if (normalized.includes("daily limit") || normalized.includes("daily quota")) return "DAILY_LIMIT_REACHED";
  if (normalized.includes("rate limit") || normalized.includes("max rate")) return "RATE_LIMITED";
  if (normalized.includes("no transactions found")) return "EMPTY_RESULT";
  return "UNKNOWN";
}
