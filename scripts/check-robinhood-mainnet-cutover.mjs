import { readFileSync } from "node:fs";

const chains = readFileSync("src/config/productChains.ts", "utf8");
const env = readFileSync(".env.example", "utf8");
const backendEnv = readFileSync("supabase/functions/.env.example", "utf8");
const deploy = readFileSync("supabase/functions/deploy-agent/index.ts", "utf8");
const appConfig = readFileSync("src/config/appConfig.ts", "utf8");
const netlify = readFileSync("netlify.toml", "utf8");
const runbook = readFileSync("docs/robinhood-mainnet-cutover-runbook.md", "utf8");

for (const expected of [
  'selection.mode === "robinhood-mainnet"',
  'selection.requestedTarget === "robinhood_mainnet"',
  'selection.mainnetWindow === "owner_mainnet_cutover"',
  'selection.releaseApproval === "owner_release_approved"',
  "return robinhoodChain",
]) {
  if (!chains.includes(expected)) throw new Error("Mainnet selector missing: " + expected);
}
for (const expected of [
  "VITE_KYRA_CHAIN_RELEASE_TARGET=robinhood_mainnet",
  "VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=owner_mainnet_cutover",
  "VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=owner_release_approved",
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window",
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=disabled",
]) {
  if (!env.includes(expected)) throw new Error("Frontend release boundary missing: " + expected);
}
for (const expected of [
  "KYRA_CHAIN_KEY=robinhood_mainnet",
  "KYRA_CHAIN_ID=4663",
  "KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=false",
]) {
  if (!backendEnv.includes(expected)) throw new Error("Backend default missing: " + expected);
}
if (!deploy.includes("KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED")) throw new Error("Deploy mainnet gate missing.");
for (const boundary of [
  "robinhoodSubmissionReleaseReady",
  'phase8ControlledSubmissionRuntime === "owner_approved_window"',
  "transactionResultCloseoutConfigured",
]) {
  if (!appConfig.includes(boundary)) throw new Error("Frontend fail-closed boundary missing: " + boundary);
}
for (const expected of [
  'command = "npm run build:robinhood-mainnet"',
  'VITE_KYRA_DATA_PROVIDER = "supabase"',
  'VITE_KYRA_CHAIN_RELEASE_TARGET = "robinhood_mainnet"',
  'VITE_KYRA_ROBINHOOD_MAINNET_WINDOW = "owner_mainnet_cutover"',
  'VITE_KYRA_ROBINHOOD_MAINNET_RELEASE = "owner_release_approved"',
  'VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION = "owner_approved_window"',
  'VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION = "disabled"',
]) {
  if (!netlify.includes(expected)) throw new Error("Netlify release boundary missing: " + expected);
}
if (!runbook.includes("Transaction") && !runbook.includes("transaction")) throw new Error("Runbook missing transaction boundary.");
console.log("Robinhood mainnet cutover contract passed.");
