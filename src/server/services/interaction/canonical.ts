import type { Chain } from "@/generated/prisma/client";

export interface CanonicalPair {
  addressA: string;
  chainA: Chain;
  addressB: string;
  chainB: Chain;
  /** True if the original arguments matched (addressA, chainA) === (arg1Address, arg1Chain) */
  isOriginalOrder: boolean;
}

/**
 * Returns a deterministic, canonical ordering of two wallet addresses on the same or different chains.
 * Canonical ordering: addressA < addressB lexicographically, with chain as tiebreaker.
 */
export function getCanonicalPair(
  addr1: string,
  chain1: Chain,
  addr2: string,
  chain2: Chain
): CanonicalPair {
  const norm1 = addr1.toLowerCase();
  const norm2 = addr2.toLowerCase();

  let isFirstA = true;
  if (norm1 < norm2) {
    isFirstA = true;
  } else if (norm1 > norm2) {
    isFirstA = false;
  } else {
    // Same address, tie-break by chain
    isFirstA = chain1 <= chain2;
  }

  if (isFirstA) {
    return {
      addressA: norm1,
      chainA: chain1,
      addressB: norm2,
      chainB: chain2,
      isOriginalOrder: true,
    };
  } else {
    return {
      addressA: norm2,
      chainA: chain2,
      addressB: norm1,
      chainB: chain1,
      isOriginalOrder: false,
    };
  }
}
