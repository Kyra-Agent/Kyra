import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = readFileSync(
  resolve(process.cwd(), "src/types/phase8OwnerActionCandidate.ts"),
  "utf8",
).replace(
  'import { currentProductChain } from "../config/productChains";',
  'const currentProductChain = Object.freeze({ id: 4663, name: "Robinhood Chain" });',
).replace(
  'import { productChainId } from "./unsignedTransactionHandoff";',
  "const productChainId = 4663;",
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleUrl = `data:text/javascript;base64,${
  Buffer.from(transpiled.outputText).toString("base64")
}`;
const { createPhase8OwnerActionCandidate } = await import(moduleUrl);
const productChainId = 4663;

const address = "0x1111111111111111111111111111111111111111";

const ready = createPhase8OwnerActionCandidate({
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  ownerWalletConnected: true,
  ownerWalletAddress: address,
  chainId: productChainId,
});

assert.equal(ready.ok, true);
assert.equal(ready.candidate?.recipient, address);
assert.equal(ready.candidate?.valueWei, "0");
assert.equal(ready.candidate?.data, "0x");
assert.equal(ready.candidate?.routeSummary.includes("self-check"), true);

const missingAddress = createPhase8OwnerActionCandidate({
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  ownerWalletConnected: true,
  ownerWalletAddress: null,
  chainId: productChainId,
});

assert.equal(missingAddress.ok, false);
assert.deepEqual(missingAddress.reasons, ["owner_wallet_address_required"]);

const wrongNetwork = createPhase8OwnerActionCandidate({
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  ownerWalletConnected: true,
  ownerWalletAddress: address,
  chainId: 1,
});

assert.equal(wrongNetwork.ok, false);
assert.equal(wrongNetwork.reasons.includes("product_chain_required"), true);

const locked = createPhase8OwnerActionCandidate({
  ownerUserId: null,
  workspaceId: null,
  agentId: null,
  ownerWalletConnected: false,
  ownerWalletAddress: "not-an-address",
  chainId: null,
});

assert.equal(locked.ok, false);
assert.equal(locked.reasons.includes("owner_required"), true);
assert.equal(locked.reasons.includes("workspace_required"), true);
assert.equal(locked.reasons.includes("agent_required"), true);
assert.equal(locked.reasons.includes("owner_wallet_required"), true);
assert.equal(locked.reasons.includes("product_chain_required"), true);
assert.equal(locked.reasons.includes("owner_wallet_address_required"), true);

console.log("Phase 8 owner action candidate checks passed.");
