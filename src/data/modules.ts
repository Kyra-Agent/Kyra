import type { CoreModule } from "../types/agent";

export const coreModules: CoreModule[] = [
  {
    id: "nira",
    name: "NIRA-01",
    title: "Lead Agent",
    summary: "Routes user intent, selects modules, and coordinates every action request.",
    status: "online",
  },
  {
    id: "vexa",
    name: "VEXA-02",
    title: "Recon Agent",
    summary: "Monitors launches, ecosystem signals, and opportunity surfaces.",
    status: "standby",
  },
  {
    id: "astra",
    name: "ASTRA-03",
    title: "Research Agent",
    summary: "Turns project docs, token context, and market data into concise briefs.",
    status: "standby",
  },
  {
    id: "nova",
    name: "NOVA-04",
    title: "Data Agent",
    summary: "Reads wallet balances, transaction history, token data, and liquidity context.",
    status: "online",
  },
  {
    id: "nyx",
    name: "NYX-05",
    title: "Security Agent",
    summary: "Checks slippage, approval risk, suspicious tokens, and unsafe action patterns.",
    status: "guard",
  },
];
