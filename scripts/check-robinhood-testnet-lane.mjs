import { readFileSync } from "node:fs";

const chains = readFileSync("src/config/productChains.ts", "utf8");
const env = readFileSync(".env.example", "utf8");
const closeout = readFileSync("src/types/robinhoodTestnetCloseout.ts", "utf8");

for (const expected of [
  'selection.mode === "robinhood-testnet"',
  'selection.requestedTarget === "robinhood_testnet"',
  'selection.testnetWindow === "owner_testnet_window"',
  "return robinhoodTestnetChain",
]) {
  if (!chains.includes(expected)) throw new Error("Testnet selector missing: " + expected);
}
if (!env.includes("VITE_KYRA_ROBINHOOD_TESTNET_WINDOW=disabled")) {
  throw new Error("Testnet default must remain fail-closed.");
}
for (const expected of ["Robinhood Chain Testnet", "pending_receipt", "confirmed"]) {
  if (!closeout.includes(expected)) {
    throw new Error("Testnet closeout contract missing: " + expected);
  }
}
console.log("Robinhood testnet lane passed.");