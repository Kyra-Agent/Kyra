import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/types/baseAccountConnection.ts");
const outDir = resolve(root, ".tmp-base-account-connection-test");
const outputPath = resolve(outDir, "baseAccountConnection.mjs");

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
  'const currentProductChain = Object.freeze({ id: 8453, name: "Base" });',
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
  };
  const address = `0x${"a".repeat(40)}`;
  const binding = contract.createBaseAccountConnectionBinding({
    ...target,
    address,
    chainId: 8453,
    connectorId: "baseAccount",
  });

  assert(contract.isBaseAccountConnectionTarget(target), "Valid target must pass.");
  assert(
    contract.bindingMatchesTarget(binding, target),
    "Binding must match the exact owner, workspace, and agent.",
  );
  assert(
    !contract.bindingMatchesTarget(binding, {
      ...target,
      agentId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }),
    "Binding must not transfer to another agent.",
  );
  assert(
    !contract.bindingMatchesTarget(binding, {
      ...target,
      ownerUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }),
    "Binding must not transfer to another owner.",
  );
  assert(
    !contract.bindingMatchesTarget(binding, {
      ...target,
      workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    }),
    "Binding must not transfer to another workspace.",
  );
  assert(
    contract.connectionMatchesBinding(binding, {
      address: address.toUpperCase().replace("0X", "0x"),
      chainId: 8453,
      connectorId: "baseAccount",
    }),
    "Matching connection snapshot must remain bound.",
  );

  for (const snapshot of [
    {
      address: `0x${"b".repeat(40)}`,
      chainId: 8453,
      connectorId: "baseAccount",
    },
    { address, chainId: 1, connectorId: "baseAccount" },
    { address, chainId: 8453, connectorId: "coinbaseWalletSDK" },
  ]) {
    assert(
      !contract.connectionMatchesBinding(binding, snapshot),
      "Address, chain, or connector drift must fail closed.",
    );
  }
  assert(
    contract.maskBaseAccountAddress(address) === "0xaaaa...aaaa",
    "Owner-safe summary must mask the address.",
  );
  assert(
    contract.maskBaseAccountAddress("bad") === "Address unavailable",
    "Invalid addresses must not be echoed.",
  );

  for (const invalid of [
    { ...target, ownerUserId: "bad" },
    { ...target, workspaceId: target.workspaceId.toUpperCase() },
    { ...target, agentId: ` ${target.agentId}` },
  ]) {
    assert(
      !contract.isBaseAccountConnectionTarget(invalid),
      "Malformed or non-canonical binding IDs must fail closed.",
    );
  }

  assertThrows(
    () =>
      contract.createBaseAccountConnectionBinding({
        ...target,
        address,
        chainId: 1,
        connectorId: "baseAccount",
      }),
    "Non-Base chain must be rejected.",
  );
  assertThrows(
    () =>
      contract.createBaseAccountConnectionBinding({
        ...target,
        address,
        chainId: 8453,
        connectorId: "coinbaseWalletSDK",
      }),
    "Non-Base-Account connector must be rejected.",
  );
  assertThrows(
    () =>
      contract.createBaseAccountConnectionBinding({
        ...target,
        address: "0x1234",
        chainId: 8453,
        connectorId: "baseAccount",
      }),
    "Malformed wallet address must be rejected.",
  );
  assert(
    contract.getBaseAccountConnectionFailureMessage("unknown") ===
      "Base Account connection failed safely.",
    "Unknown failures must collapse to fixed sanitized copy.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Base Account connection contract checks passed.");
