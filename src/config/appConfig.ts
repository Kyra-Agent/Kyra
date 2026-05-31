export const appConfig = {
  appName: "Kyra Agent",
  mode: "frontend-demo",
  dataProvider: "mock",
  network: "Base",
  publishTarget: "netlify",
  integrations: {
    auth: "demo",
    database: "mock",
    telegram: "simulated",
    baseMcp: "simulated",
    walletExecution: "disabled",
  },
} as const;

export type AppConfig = typeof appConfig;
