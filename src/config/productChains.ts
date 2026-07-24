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


export const robinhoodChain = defineProductChain({
  key: "robinhood_mainnet",
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
  key: "robinhood_testnet",
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
  robinhoodChain,
  robinhoodTestnetChain,
] as const);

export type ProductChain = (typeof productChains)[number];
export type ProductChainKey = ProductChain["key"];

export interface ProductChainRuntimeSelection {
  mode: string;
  requestedTarget: string;
  testnetWindow: string;
  mainnetWindow?: string;
  releaseApproval?: string;
}

export function selectProductChainForRuntime(
  selection: ProductChainRuntimeSelection,
) {
  if (
    selection.mode === "robinhood-testnet" &&
    selection.requestedTarget === "robinhood_testnet" &&
    selection.testnetWindow === "owner_testnet_window"
  ) {
    return robinhoodTestnetChain;
  }

  if (
    selection.mode === "robinhood-mainnet" &&
    selection.requestedTarget === "robinhood_mainnet" &&
    selection.mainnetWindow === "owner_mainnet_cutover" &&
    selection.releaseApproval === "owner_release_approved"
  ) {
    return robinhoodChain;
  }

  // Robinhood Chain mainnet is the only production product target. Runtime
  // transaction gates remain independently default-off and fail closed.
  return robinhoodChain;
}

function readBuildEnv(key: string) {
  const env = (import.meta as ImportMeta & {
    readonly env?: Readonly<Record<string, string | undefined>>;
  }).env;
  return env?.[key] ?? "";
}

// Chain selection is Robinhood-only. Testnet still requires its explicit mode
// and owner window; transaction submission remains separately gated.
export const currentProductChain = selectProductChainForRuntime({
  mode: readBuildEnv("MODE"),
  requestedTarget: readBuildEnv("VITE_KYRA_CHAIN_RELEASE_TARGET"),
  testnetWindow: readBuildEnv("VITE_KYRA_ROBINHOOD_TESTNET_WINDOW"),
  mainnetWindow: readBuildEnv("VITE_KYRA_ROBINHOOD_MAINNET_WINDOW"),
  releaseApproval: readBuildEnv("VITE_KYRA_ROBINHOOD_MAINNET_RELEASE"),
});
export const migrationTargetChain = robinhoodChain;
export const currentWalletDisplayName = `${currentProductChain.name} wallet`;
export const currentGasDisplayName = `${currentProductChain.name} ETH`;

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

export function getProductChainByKey(value: unknown): ProductChain | null {
  if (typeof value !== "string") return null;
  return productChains.find((chain) => chain.key === value) ?? null;
}
