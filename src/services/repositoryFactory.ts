import { appConfig } from "../config/appConfig";
import type { DataProvider } from "../types/api";
import type { KyraRepository } from "./kyraRepository";
import { mockKyraRepository } from "./mockKyraRepository";

export interface KyraRepositoryRuntime {
  requestedProvider: DataProvider;
  activeProvider: DataProvider;
  supabaseConfigured: boolean;
  note: string;
}

export const kyraRepositoryRuntime: KyraRepositoryRuntime = {
  requestedProvider: appConfig.dataProvider,
  activeProvider: mockKyraRepository.source,
  supabaseConfigured: appConfig.supabase.configured,
  note:
    appConfig.dataProvider === "supabase"
      ? "Signed-in demo records can persist through the Kyra backend. Onchain execution stays simulated."
      : "Local demo records stay in the browser until an account session is connected.",
};

export function getKyraRepository(): KyraRepository {
  return mockKyraRepository;
}
