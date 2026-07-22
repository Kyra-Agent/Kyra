import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = readFileSync(
  resolve(process.cwd(), "src/types/phase8OwnerActionCandidate.ts"),
  "utf8",
).replace(
  'import { currentProductChain } from "../config/productChains";',
  'const currentProductChain = Object.freeze({ id: 8453, name: "Base" });',
).replace(
  'import { baseChainId } from "./unsignedTransactionHandoff";',
  "const baseChainId = 8453;",
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
const baseChainId = 8453;

const address = "0x1111111111111111111111111111111111111111";

const ready = createPhase8OwnerActionCandidate({
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  baseAccountConnected: true,
  baseAccountAddress: address,
  chainId: baseChainId,
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
  baseAccountConnected: true,
  baseAccountAddress: null,
  chainId: baseChainId,
});

assert.equal(missingAddress.ok, false);
assert.deepEqual(missingAddress.reasons, ["base_account_address_required"]);

const wrongNetwork = createPhase8OwnerActionCandidate({
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  baseAccountConnected: true,
  baseAccountAddress: address,
  chainId: 1,
});

assert.equal(wrongNetwork.ok, false);
assert.equal(wrongNetwork.reasons.includes("base_chain_required"), true);

const locked = createPhase8OwnerActionCandidate({
  ownerUserId: null,
  workspaceId: null,
  agentId: null,
  baseAccountConnected: false,
  baseAccountAddress: "not-an-address",
  chainId: null,
});

assert.equal(locked.ok, false);
assert.equal(locked.reasons.includes("owner_required"), true);
assert.equal(locked.reasons.includes("workspace_required"), true);
assert.equal(locked.reasons.includes("agent_required"), true);
assert.equal(locked.reasons.includes("base_account_required"), true);
assert.equal(locked.reasons.includes("base_chain_required"), true);
assert.equal(locked.reasons.includes("base_account_address_required"), true);

console.log("Phase 8 owner action candidate checks passed.");
