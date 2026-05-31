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
      ? "Supabase is used for the read-only template catalog when available. Dashboard records and deploy simulations stay on mock data until auth is connected."
      : "Frontend demo uses local mock data shaped like the planned Supabase records.",
};

export function getKyraRepository(): KyraRepository {
  return mockKyraRepository;
}
