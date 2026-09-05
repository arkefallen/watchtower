import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { normalizeAddress } from "./normalize";

export class UnresolvableEnsError extends Error {
  constructor(name: string, reason?: string) {
    super(`Unresolvable ENS name '${name}'${reason ? `: ${reason}` : ""}`);
    this.name = "UnresolvableEnsError";
  }
}

export interface EnsClient {
  getEnsAddress: (args: { name: string }) => Promise<string | null>;
  getEnsName: (args: { address: `0x${string}` }) => Promise<string | null>;
}

let defaultEnsClient: EnsClient | undefined;

export function getDefaultEnsClient(): EnsClient {
  if (!defaultEnsClient) {
    const rpcUrl = process.env.ETH_MAINNET_RPC_URL || process.env.ENS_RPC_URL || "https://cloudflare-eth.com";
    const client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    });
    defaultEnsClient = {
      getEnsAddress: (args) => client.getEnsAddress(args),
      getEnsName: (args) => client.getEnsName(args),
    };
  }
  return defaultEnsClient;
}

export function isEnsName(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.endsWith(".eth") || (trimmed.includes(".") && !trimmed.startsWith("0x"));
}

export async function resolveEnsForward(
  name: string,
  client: EnsClient = getDefaultEnsClient()
): Promise<{ address: `0x${string}`; name: string }> {
  try {
    const normalizedName = normalize(name.trim());
    const rawAddress = await client.getEnsAddress({ name: normalizedName });
    if (!rawAddress) {
      throw new UnresolvableEnsError(name, "No address associated with this name");
    }
    return {
      address: normalizeAddress(rawAddress),
      name: normalizedName,
    };
  } catch (err: any) {
    if (err instanceof UnresolvableEnsError) {
      throw err;
    }
    throw new UnresolvableEnsError(name, err?.message ?? String(err));
  }
}

export async function resolveEnsReverse(
  address: `0x${string}`,
  client: EnsClient = getDefaultEnsClient()
): Promise<string | null> {
  try {
    const normalizedAddr = normalizeAddress(address);
    const resolvedName = await client.getEnsName({ address: normalizedAddr });
    return resolvedName ?? null;
  } catch {
    // Non-fatal per FR-1.2
    return null;
  }
}

export interface ResolveWalletInputResult {
  address: `0x${string}`;
  ensName: string | null;
  warning?: string;
}

export async function resolveWalletInput(
  input: { addressOrName: string; chain: string },
  client: EnsClient = getDefaultEnsClient()
): Promise<ResolveWalletInputResult> {
  const trimmed = input.addressOrName.trim();

  if (isEnsName(trimmed)) {
    const { address, name } = await resolveEnsForward(trimmed, client);
    return {
      address,
      ensName: name,
    };
  }

  const address = normalizeAddress(trimmed);
  try {
    const resolvedName = await client.getEnsName({ address });
    return {
      address,
      ensName: resolvedName ?? null,
    };
  } catch (err: any) {
    return {
      address,
      ensName: null,
      warning: `Reverse ENS lookup failed: ${err?.message ?? String(err)}`,
    };
  }
}
