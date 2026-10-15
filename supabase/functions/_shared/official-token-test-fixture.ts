import { configureOfficialKyraTokenAddressForTests } from "./transfer-transaction-policy.ts";

// Test fixture only. This synthetic checksummed address is not a published
// contract; it lets the fail-closed KYRA policy paths stay covered while the
// official Robinhood Chain contract remains unpublished.
export const testKyraTokenAddress =
  "0x11bceD4Ed1b20eAE8aA4Ff840a5dCEB078C9cb53" as const;

export function useTestOfficialKyraToken() {
  configureOfficialKyraTokenAddressForTests(testKyraTokenAddress);
}

export function withUnpublishedOfficialKyraToken<T>(run: () => T): T {
  configureOfficialKyraTokenAddressForTests(null);
  try {
    return run();
  } finally {
    useTestOfficialKyraToken();
  }
}

useTestOfficialKyraToken();
