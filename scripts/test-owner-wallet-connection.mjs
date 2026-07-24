import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/types/ownerWalletConnection.ts");
const outDir = resolve(root, ".tmp-owner-wallet-connection-test");
const outputPath = resolve(outDir, "ownerWalletConnection.mjs");
const now = 2_000_000_000;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(callback, message) {
  try {
    callback();
  } catch {
    return;
  }

  throw new Error(message);
}

mkdirSync(outDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8").replace(
  'import { currentProductChain } from "../config/productChains";',
  'const currentProductChain = Object.freeze({ id: 4663, name: "Robinhood Chain" });',
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const contract = await import(`file:///${outputPath.replace(/\\/g, "/")}`);
  const target = {
    ownerUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workspaceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    agentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sessionExpiresAt: now + 3_600,
  };
  const address = `0x${"a".repeat(40)}`;
  const binding = contract.createOwnerWalletConnectionBinding({
    ...target,
    address,
    chainId: 4663,
    connectorId: "io.metamask",
    connectorType: "injected",
  }, now);

  assert(
    contract.isOwnerWalletConnectionTarget(target, now),
    "Fresh authenticated target must pass.",
  );
  assert(
    contract.walletBindingMatchesTarget(binding, target),
    "Binding must match the exact owner, workspace, agent, and session.",
  );

  for (const changedTarget of [
    { ...target, agentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    { ...target, ownerUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    { ...target, workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
    { ...target, sessionExpiresAt: target.sessionExpiresAt + 3_600 },
  ]) {
    assert(
      !contract.walletBindingMatchesTarget(binding, changedTarget),
      "Binding must not survive target or refreshed-session drift.",
    );
  }

  assert(
    contract.walletConnectionMatchesBinding(binding, {
      address: address.toUpperCase().replace("0X", "0x"),
      chainId: 4663,
      connectorId: "io.metamask",
      connectorType: "injected",
    }),
    "Matching EIP-1193 connection snapshot must remain bound.",
  );

  for (const snapshot of [
    {
      address: `0x${"b".repeat(40)}`,
      chainId: 4663,
      connectorId: "io.metamask",
      connectorType: "injected",
    },
    {
      address,
      chainId: 1,
      connectorId: "io.metamask",
      connectorType: "injected",
    },
    {
      address,
      chainId: 4663,
      connectorId: "com.other.wallet",
      connectorType: "injected",
    },
    {
      address,
      chainId: 4663,
      connectorId: "io.metamask",
      connectorType: "walletConnect",
    },
  ]) {
    assert(
      !contract.walletConnectionMatchesBinding(binding, snapshot),
      "Address, chain, connector ID, or connector type drift must fail closed.",
    );
  }

  assert(
    contract.maskOwnerWalletAddress(address) === "0xaaaa...aaaa",
    "Owner-safe summary must mask the address.",
  );
  assert(
    contract.maskOwnerWalletAddress("bad") === "Address unavailable",
    "Invalid addresses must not be echoed.",
  );

  for (const invalid of [
    { ...target, ownerUserId: "bad" },
    { ...target, workspaceId: target.workspaceId.toUpperCase() },
    { ...target, agentId: ` ${target.agentId}` },
    { ...target, sessionExpiresAt: now + 29 },
  ]) {
    assert(
      !contract.isOwnerWalletConnectionTarget(invalid, now),
      "Malformed or expired targets must fail closed.",
    );
  }

  for (const invalidConnection of [
    { chainId: 1, connectorId: "io.metamask", connectorType: "injected", address },
    { chainId: 4663, connectorId: "io.metamask", connectorType: "unsupported", address },
    { chainId: 4663, connectorId: "bad connector", connectorType: "injected", address },
    { chainId: 4663, connectorId: "io.metamask", connectorType: "injected", address: "0x1234" },
  ]) {
    assertThrows(
      () => contract.createOwnerWalletConnectionBinding({
        ...target,
        ...invalidConnection,
      }, now),
      "Wrong chain, connector, or address must be rejected.",
    );
  }

  assertThrows(
    () => contract.createOwnerWalletConnectionBinding({
      ...target,
      sessionExpiresAt: now + 29,
      address,
      chainId: 4663,
      connectorId: "io.metamask",
      connectorType: "injected",
    }, now),
    "Expired connection target must be rejected at binding time.",
  );
  assert(
    contract.getOwnerWalletConnectionFailureMessage("user_rejected") ===
      "Wallet connection was cancelled.",
    "User rejection must map to fixed sanitized copy.",
  );
  assert(
    contract.getOwnerWalletConnectionFailureMessage("unknown") ===
      "Wallet connection failed safely.",
    "Unknown failures must collapse to fixed sanitized copy.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Owner wallet connection contract checks passed.");
