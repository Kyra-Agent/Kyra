import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { base } from "wagmi/chains";
import { baseAccount, coinbaseWallet } from "wagmi/connectors";
import { appConfig } from "../config/appConfig";

interface WalletRuntimeProvidersProps {
  children: ReactNode;
}

const queryClient = new QueryClient();

const walletConfig = createConfig({
  chains: [base],
  connectors: [
    baseAccount(),
    coinbaseWallet({
      appName: appConfig.appName,
    }),
  ],
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
