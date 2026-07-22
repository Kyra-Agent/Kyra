export const backendChainRegistry = {
  base: {
    key: "base",
    name: "Base",
    chainId: 8453,
    chainIdHex: "0x2105",
  },
  robinhood_mainnet: {
    key: "robinhood_mainnet",
    name: "Robinhood Chain",
    chainId: 4663,
    chainIdHex: "0x1237",
  },
  robinhood_testnet: {
    key: "robinhood_testnet",
    name: "Robinhood Chain Testnet",
    chainId: 46630,
    chainIdHex: "0xb626",
  },
} as const;

export type BackendChainKey = keyof typeof backendChainRegistry;
export type BackendChainDefinition =
  (typeof backendChainRegistry)[BackendChainKey];

export function readBackendChain(
  chainKey: unknown,
  chainId: unknown,
): BackendChainDefinition {
  if (typeof chainKey !== "string" || !(chainKey in backendChainRegistry)) {
    throw new Error("Chain configuration is invalid.");
  }

  const chain = backendChainRegistry[chainKey as BackendChainKey];

  if (chainId !== chain.chainId) {
    throw new Error("Chain configuration is invalid.");
  }

  return chain;
}

export function readBackendChainFromHex(
  chainKey: unknown,
  chainIdHex: unknown,
): BackendChainDefinition {
  if (typeof chainIdHex !== "string") {
    throw new Error("Chain configuration is invalid.");
  }

  const normalized = normalizeChainIdHex(chainIdHex);
  const chain = readBackendChain(
    chainKey,
    Number.parseInt(normalized.slice(2), 16),
  );

  if (normalized !== chain.chainIdHex) {
    throw new Error("Chain configuration is invalid.");
  }

  return chain;
}

export function normalizeChainIdHex(value: string) {
  if (!/^0x(?:0|[1-9a-f][0-9a-f]*)$/iu.test(value)) {
    throw new Error("Chain configuration is invalid.");
  }

  const parsed = Number.parseInt(value.slice(2), 16);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Chain configuration is invalid.");
  }

  return `0x${parsed.toString(16)}`;
}
