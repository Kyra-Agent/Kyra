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
    <Suspense fallback={<WalletRuntimeLoading />}>
      <WalletRuntimeProviders>{children}</WalletRuntimeProviders>
    </Suspense>
  );
}

function WalletRuntimeLoading() {
  return (
    <main
      className="route-loading-shell wallet-runtime-loading"
      aria-live="polite"
      aria-busy="true"
    >
      <section className="route-loading-panel" role="status">
        <span className="route-loading-kicker">KYRA SECURE RUNTIME</span>
        <strong>Starting your workspace</strong>
        <span className="route-loading-copy">
          Preparing account and wallet connection support. No wallet prompt opens
          automatically.
        </span>
        <span className="route-loading-track" aria-hidden="true">
          <span />
        </span>
      </section>
    </main>
  );
}

function isWalletConnectionEnabled(value: string) {
  return value === "owner_click_only";
}
