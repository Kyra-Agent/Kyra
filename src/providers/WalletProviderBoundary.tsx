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
  if (appConfig.integrations.walletExecution === "disabled") {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={null}>
      <WalletRuntimeProviders>{children}</WalletRuntimeProviders>
    </Suspense>
  );
}
