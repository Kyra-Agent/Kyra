import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { currentProductChain } from "../config/productChains";

interface WalletRuntimeProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient();

const walletRuntimeChain = defineChain({
  id: currentProductChain.id,
  name: currentProductChain.name,
  nativeCurrency: currentProductChain.nativeCurrency,
  rpcUrls: {
    default: { http: [currentProductChain.publicRpcUrl] },
  },
  blockExplorers: {
    default: {
      name: `${currentProductChain.name} Explorer`,
      url: currentProductChain.explorerUrl,
    },
  },
});

const walletConfig = createConfig({
  chains: [walletRuntimeChain],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  storage: null,
  transports: {
    [walletRuntimeChain.id]: http(currentProductChain.publicRpcUrl),
  },
});

export function WalletRuntimeProviders({
  children,
}: WalletRuntimeProvidersProps) {
  return (
    <WagmiProvider config={walletConfig} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
