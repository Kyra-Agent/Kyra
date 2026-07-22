import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount } from "wagmi/connectors";
import { appConfig } from "../config/appConfig";
import { currentProductChain } from "../config/productChains";

interface WalletRuntimeProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient();

if (base.id !== currentProductChain.id) {
  throw new Error("Configured wallet chain does not match the Kyra runtime chain.");
}

const walletConfig = createConfig({
  chains: [base],
  connectors: [baseAccount({ appName: appConfig.appName })],
  storage: null,
  transports: {
    [base.id]: http(),
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
