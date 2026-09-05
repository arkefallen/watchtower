import type { CallPriority } from "@/lib/ratelimit";

export interface PageMeta {
  endpoint: "NORMAL_TX" | "INTERNAL_TX" | "ERC20_TRANSFER";
  pageNumber: number;
  recordsInPage: number;
  pageWasFull: boolean;
  highestBlockSeen: bigint;
  cumulativeRecords: number;
}

export interface PaginationRequest {
  fromBlock: bigint;
  toBlock: bigint;
  priority: CallPriority;
  signal?: AbortSignal;
}

export interface PaginationOptions<T> {
  endpoint: PageMeta["endpoint"];
  pageCap: number;
  maxRecords?: number;
  maxPages?: number;
  blockOf: (row: T) => bigint;
  onPage?: (page: PageMeta) => void | Promise<void>;
}

export interface PaginationPage<T> {
  rows: T[];
  page: number;
  fromBlock: bigint;
  toBlock: bigint;
}

export interface PaginationResult<T> {
  rows: T[];
  pages: PageMeta[];
  truncated: boolean;
  callsSpent: number;
  coveredThroughBlock: bigint;
}

export async function fetchAllPages<T>(
  request: PaginationRequest,
  options: PaginationOptions<T>,
  fetchPage: (input: PaginationPage<T>) => Promise<T[]>,
): Promise<PaginationResult<T>> {
  const rows: T[] = [];
  const pages: PageMeta[] = [];
  let fromBlock = request.fromBlock;
  let page = 1;
  let coveredThroughBlock = request.fromBlock - 1n;
  let callsSpent = 0;
  let truncated = false;
  const maxPages = options.maxPages ?? 200;

  while (callsSpent < maxPages) {
    if (request.signal?.aborted) {
      truncated = true;
      break;
    }
    const pageRows = await fetchPage({ rows: [], page, fromBlock, toBlock: request.toBlock });
    callsSpent += 1;
    const highest = pageRows.length === 0 ? fromBlock : pageRows.reduce((max, row) => {
      const block = options.blockOf(row);
      return block > max ? block : max;
    }, fromBlock);
    const full = pageRows.length >= options.pageCap;
    const meta: PageMeta = { endpoint: options.endpoint, pageNumber: page, recordsInPage: pageRows.length, pageWasFull: full, highestBlockSeen: highest, cumulativeRecords: rows.length + pageRows.length };
    pages.push(meta);
    await options.onPage?.(meta);

    if (options.maxRecords !== undefined && rows.length + pageRows.length >= options.maxRecords) {
      const take = options.maxRecords - rows.length;
      rows.push(...pageRows.slice(0, Math.max(0, take)));
      truncated = true;
      coveredThroughBlock = full && highest > fromBlock ? highest - 1n : fromBlock - 1n;
      break;
    }

    if (!full) {
      rows.push(...pageRows);
      coveredThroughBlock = request.toBlock;
      break;
    }

    if (pageRows.length === 0) {
      coveredThroughBlock = request.toBlock;
      break;
    }

    if (highest > fromBlock) {
      rows.push(...pageRows.filter((row) => options.blockOf(row) < highest));
      coveredThroughBlock = highest - 1n;
      fromBlock = highest;
      page = 1;
    } else {
      rows.push(...pageRows);
      page += 1;
    }
  }

  if (callsSpent >= maxPages && !truncated) truncated = true;
  return { rows, pages, truncated, callsSpent, coveredThroughBlock };
}
