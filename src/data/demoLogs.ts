import { demoActivityLogs, formatActivityLog } from "./demoBackend";

export const bootLogs = [
  "boot sequence accepted",
  "loading KYRA-AGENT console",
  "NIRA-01 lead router online",
  "NOVA-04 data module synced",
  "NYX-05 security guard active",
  "BASE-MCP approval layer connected",
  "demo mode: no real transactions",
];

export const dashboardLogs = demoActivityLogs.map(formatActivityLog);
