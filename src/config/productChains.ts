export interface ProductChainDefinition<
  TKey extends string,
  TId extends number,
  THexId extends `0x${string}`,
  TName extends string,
> {
  key: TKey;
  id: TId;
  hexId: THexId;
  name: TName;
  nativeCurrency: {
    name: "Ether";
    symbol: "ETH";
    decimals: 18;
  };
  publicRpcUrl: `https://${string}`;
  explorerUrl: `https://${string}`;
  productionRpcPolicy: "backend_secret_required";
}

function defineProductChain<
  const TKey extends string,
  const TId extends number,
  const THexId extends `0x${string}`,
  const TName extends string,
>(
  definition: ProductChainDefinition<TKey, TId, THexId, TName>,
): Readonly<ProductChainDefinition<TKey, TId, THexId, TName>> {
  return Object.freeze({
    ...definition,
    nativeCurrency: Object.freeze({ ...definition.nativeCurrency }),
  });
}

export const baseLegacyChain = defineProductChain({
  key: "base",
  id: 8453,
  hexId: "0x2105",
  name: "Base",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  publicRpcUrl: "https://mainnet.base.org",
  explorerUrl: "https://basescan.org",
  productionRpcPolicy: "backend_secret_required",
});

export const robinhoodChain = defineProductChain({
  key: "robinhood",
  id: 4663,
  hexId: "0x1237",
  name: "Robinhood Chain",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  publicRpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorerUrl: "https://robinhoodchain.blockscout.com",
  productionRpcPolicy: "backend_secret_required",
});

export const robinhoodTestnetChain = defineProductChain({
  key: "robinhood-testnet",
  id: 46630,
  hexId: "0xb626",
  name: "Robinhood Chain Testnet",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  publicRpcUrl: "https://rpc.testnet.chain.robinhood.com",
  explorerUrl: "https://explorer.testnet.chain.robinhood.com",
  productionRpcPolicy: "backend_secret_required",
});

export const productChains = Object.freeze([
  baseLegacyChain,
  robinhoodChain,
  robinhoodTestnetChain,
] as const);

// Batch 2 is abstraction-only. Batch 6 performs the atomic production cutover.
export const currentProductChain = baseLegacyChain;
export const migrationTargetChain = robinhoodChain;

export function normalizeEvmChainId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "bigint") {
    if (value <= 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }

  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (!/^(?:0x[0-9a-f]+|[1-9]\d*)$/u.test(normalized)) return null;

  try {
    const parsed = Number(BigInt(normalized));
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function isCurrentProductChainId(
  value: unknown,
): value is typeof currentProductChain.id {
  return normalizeEvmChainId(value) === currentProductChain.id;
}

export function isMigrationTargetChainId(
  value: unknown,
): value is typeof migrationTargetChain.id {
  return normalizeEvmChainId(value) === migrationTargetChain.id;
}

export function getProductChainById(value: unknown) {
  const chainId = normalizeEvmChainId(value);
  return productChains.find((chain) => chain.id === chainId) ?? null;
}
