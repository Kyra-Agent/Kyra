function readEnv(key: string) {
  return import.meta.env[key] || "";
}

const requestedDataProvider = readEnv("VITE_KYRA_DATA_PROVIDER") === "supabase" ? "supabase" : "mock";
const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const deployFunctionUrl =
  readEnv("VITE_KYRA_DEPLOY_FUNCTION_URL") ||
  (supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1/deploy-agent` : "");

export const appConfig = {
  appName: "Kyra Agent",
  mode: requestedDataProvider === "supabase" ? "backend-demo" : "frontend-demo",
  dataProvider: requestedDataProvider,
  network: "Base",
  publishTarget: "netlify",
  supabase: {
    url: supabaseUrl,
    hasAnonKey: Boolean(supabaseAnonKey),
    configured: supabaseConfigured,
  },
  functions: {
    deployAgentUrl: deployFunctionUrl,
    deployAgentConfigured: Boolean(deployFunctionUrl && supabaseConfigured),
  },
  integrations: {
    auth: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "demo",
    database: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "mock",
    deployApi: requestedDataProvider === "supabase" && deployFunctionUrl ? "edge preferred" : "edge scaffolded",
    telegram: "simulated",
    baseMcp: "simulated",
    walletExecution: "disabled",
  },
} as const;

export type AppConfig = typeof appConfig;
