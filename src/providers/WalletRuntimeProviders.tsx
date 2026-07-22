import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import {
  baseLegacyChain,
  currentProductChain,
  type ProductChainDefinition,
  robinhoodTestnetChain,
} from "../config/productChains";

interface WalletRuntimeProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient();

function createWalletRuntimeConfig<
  const TChain extends ProductChainDefinition<
    string,
    number,
    `0x${string}`,
    string
  >,
>(productChain: TChain) {
  const chain = defineChain({
    id: productChain.id,
    name: productChain.name,
    nativeCurrency: productChain.nativeCurrency,
    rpcUrls: {
      default: { http: [productChain.publicRpcUrl] },
    },
    blockExplorers: {
      default: {
        name: `${productChain.name} Explorer`,
        url: productChain.explorerUrl,
      },
    },
  });

  return createConfig({
    chains: [chain],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    storage: null,
    transports: {
      [chain.id]: http(productChain.publicRpcUrl),
    } as Record<TChain["id"], ReturnType<typeof http>>,
  });
}

const walletConfig = currentProductChain.key === "robinhood_testnet"
  ? createWalletRuntimeConfig(robinhoodTestnetChain)
  : createWalletRuntimeConfig(baseLegacyChain);

export function WalletRuntimeProviders({
  children,
}: WalletRuntimeProvidersProps) {
  return (
    <WagmiProvider config={walletConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
