import { lazy, type ReactNode, Suspense } from "react";
import { appConfig } from "../config/appConfig";

interface WalletProviderBoundaryProps {
  children: ReactNode;
}

const WalletRuntimeProviders = lazy(() =>
  import("./WalletRuntimeProviders").then((module) => ({
    default: module.WalletRuntimeProviders,
  }))
);

export function WalletProviderBoundary({
  children,
}: WalletProviderBoundaryProps) {
  const connectionOnlyRuntimeEnabled =
    isWalletConnectionEnabled(appConfig.integrations.walletConnection) &&
    appConfig.integrations.walletExecution === "disabled";

  if (!connectionOnlyRuntimeEnabled) {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <WalletRuntimeProviders>{children}</WalletRuntimeProviders>
    </Suspense>
  );
}

function isWalletConnectionEnabled(value: string) {
  return value === "owner_click_only";
}
