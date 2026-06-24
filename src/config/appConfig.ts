function readEnv(key: string): string {
  return import.meta.env[key] || "";
}

const requestedDataProvider = readEnv("VITE_KYRA_DATA_PROVIDER") === "supabase" ? "supabase" : "mock";
const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const deployFunctionUrl =
  readEnv("VITE_KYRA_DEPLOY_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/deploy-agent` : "");
const resetDemoWorkspaceFunctionUrl =
  readEnv("VITE_KYRA_RESET_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/reset-demo-workspace` : "");
const telegramConnectFunctionUrl =
  readEnv("VITE_KYRA_TELEGRAM_CONNECT_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-connect` : "");
const telegramLinkFunctionUrl =
  readEnv("VITE_KYRA_TELEGRAM_LINK_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-link` : "");
const telegramDashboardStatusFunctionUrl =
  readEnv("VITE_KYRA_TELEGRAM_DASHBOARD_STATUS_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telegram-dashboard-status` : "");
const baseMcpPrepareFunctionUrl =
  supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/base-mcp-prepare` : "";
const telegramConnectTokenInputEnabled =
  readEnv("VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT").toLowerCase() === "true";
const telegramDashboardStatusReadModelEnabled =
  readEnv("VITE_KYRA_ENABLE_TELEGRAM_DASHBOARD_STATUS").toLowerCase() === "true";
const telegramBackendConfigured = Boolean(
  telegramConnectFunctionUrl && telegramLinkFunctionUrl &&
    telegramDashboardStatusFunctionUrl && supabaseConfigured,
);

export const appConfig = {
  appName: "Kyra Agent",
  mode: requestedDataProvider === "supabase" ? "backend-demo" : "frontend-demo",
  dataProvider: requestedDataProvider,
  network: "Base",
  publishTarget: "vercel",
  supabase: {
    url: supabaseUrl,
    hasAnonKey: Boolean(supabaseAnonKey),
    configured: supabaseConfigured,
  },
  functions: {
    deployAgentUrl: deployFunctionUrl,
    deployAgentConfigured: Boolean(deployFunctionUrl && supabaseConfigured),
    resetDemoWorkspaceUrl: resetDemoWorkspaceFunctionUrl,
    resetDemoWorkspaceConfigured: Boolean(resetDemoWorkspaceFunctionUrl && supabaseConfigured),
    telegramConnectUrl: telegramConnectFunctionUrl,
    telegramConnectConfigured: Boolean(telegramConnectFunctionUrl && supabaseConfigured),
    telegramLinkUrl: telegramLinkFunctionUrl,
    telegramLinkConfigured: Boolean(telegramLinkFunctionUrl && supabaseConfigured),
    telegramDashboardStatusUrl: telegramDashboardStatusFunctionUrl,
    telegramDashboardStatusConfigured: Boolean(
      telegramDashboardStatusFunctionUrl && supabaseConfigured,
    ),
    baseMcpPrepareUrl: baseMcpPrepareFunctionUrl,
    baseMcpPrepareConfigured: Boolean(
      baseMcpPrepareFunctionUrl && supabaseConfigured,
    ),
  },
  featureFlags: {
    telegramConnectTokenInput: telegramConnectTokenInputEnabled,
    telegramDashboardStatusReadModel: telegramDashboardStatusReadModelEnabled,
  },
  integrations: {
    auth: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "demo",
    database: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "mock",
    deployApi: requestedDataProvider === "supabase" && deployFunctionUrl ? "edge preferred" : "edge scaffolded",
    telegram: telegramBackendConfigured ? "live read-only" : "read-only scaffold",
    baseMcp: baseMcpPrepareFunctionUrl && supabaseConfigured
      ? "custom read-only bridge"
      : "read-only scaffold",
    walletConnection: "owner_click_only",
    walletExecution: "disabled",
  },
} as const;

export type AppConfig = typeof appConfig;
