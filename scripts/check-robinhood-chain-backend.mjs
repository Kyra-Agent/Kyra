import { readFileSync } from "node:fs";

const registry = readFileSync("supabase/functions/_shared/chain-runtime.ts", "utf8");
const schema = readFileSync("supabase/schema.sql", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const provider = readFileSync("supabase/functions/chain-status-provider/core.ts", "utf8");
const prepare = readFileSync("supabase/functions/chain-action-prepare/core.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260724120000_robinhood_only_cutover.sql",
  "utf8",
);
const verifier = readFileSync(
  "supabase/migrations/20260724121000_verify_robinhood_only_cutover.sql",
  "utf8",
);

for (const chain of ["robinhood_mainnet", "robinhood_testnet"]) {
  for (const [label, source] of [["registry", registry], ["schema", schema], ["migration", migration]]) {
    if (!source.includes(chain)) throw new Error(label + " missing " + chain);
  }
}
for (const name of ["chain-status-provider", "chain-action-prepare"]) {
  if (!config.includes("[functions." + name + "]")) throw new Error("Missing function config: " + name);
}
for (const expected of ["eth_chainId", "read_only", "expectedBearerSecret"]) {
  if (!provider.includes(expected)) throw new Error("Provider boundary missing: " + expected);
}
for (const expected of ["assertAgentOwnership", "checkRateLimit", "storePreparedAction"]) {
  if (!prepare.includes(expected)) throw new Error("Prepare boundary missing: " + expected);
}
for (const expected of ["drop column if exists", "public_agent_profiles", "chain_action_status"]) {
  if (!migration.includes(expected)) throw new Error("Cutover migration missing: " + expected);
}
if (!verifier.includes("public agent view is not Robinhood cutover ready")) {
  throw new Error("Cutover verifier is incomplete.");
}
console.log("Robinhood backend contract passed.");
