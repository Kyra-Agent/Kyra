function readEnv(key: string) {
  return import.meta.env[key] || "";
}

const requestedDataProvider = readEnv("VITE_KYRA_DATA_PROVIDER") === "supabase" ? "supabase" : "mock";
const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

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
  integrations: {
    auth: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "demo",
    database: requestedDataProvider === "supabase" && supabaseConfigured ? "supabase" : "mock",
    deployApi: "edge scaffolded",
    telegram: "simulated",
    baseMcp: "simulated",
    walletExecution: "disabled",
  },
} as const;

export type AppConfig = typeof appConfig;
