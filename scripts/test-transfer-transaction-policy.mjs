import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";

const root = process.cwd();
const sourcePath = resolve(root, "src/config/transferTransactionPolicy.ts");
const outDir = resolve(root, ".tmp-transfer-transaction-policy-test");
const outputPath = resolve(outDir, "transferTransactionPolicy.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
  }
}

mkdirSync(outDir, { recursive: true });
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
});
writeFileSync(outputPath, transpiled.outputText);

try {
  const policy = await import(`file:///${outputPath.replace(/\\/g, "/")}`);
  const sender = "0x1111111111111111111111111111111111111111";
  const recipient = "0x2222222222222222222222222222222222222222";

  const native = policy.createReviewedTransfer({
    sender,
    recipient,
    assetKind: "native",
    amount: "0.005",
  });
  assert(native.ok, "Native transfer at the action cap must pass.");
  assertEquals(native.transaction.assetKind, "native");
  assertEquals(native.transaction.valueWei, parseUnits("0.005", 18).toString());
  assertEquals(native.transaction.data, "0x");
  assertEquals(native.transaction.tokenAddress, null);
  assertEquals(native.transaction.policyVersion, 3);

  const kyra = policy.createReviewedTransfer({
    sender,
    recipient,
    assetKind: "erc20",
    amount: "10000",
  });
  assert(kyra.ok, "KYRA transfer at the action cap must pass.");
  assertEquals(kyra.transaction.tokenAddress, policy.kyraTokenAddress);
  assertEquals(kyra.transaction.valueWei, "0");
  assertEquals(
    kyra.transaction.data,
    encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, parseUnits("10000", 18)],
    }).toLowerCase(),
    "KYRA calldata must encode only the reviewed ERC20 transfer.",
  );

  for (const input of [
    { sender, recipient: sender, assetKind: "native", amount: "0.001" },
    { sender, recipient: "not-an-address", assetKind: "native", amount: "0.001" },
    { sender, recipient, assetKind: "native", amount: "0" },
    { sender, recipient, assetKind: "native", amount: "0.005000000000000001" },
    { sender, recipient, assetKind: "erc20", amount: "10000.000000000000000001" },
    { sender, recipient, assetKind: "erc20", amount: "nan" },
  ]) {
    const result = policy.createReviewedTransfer(input);
    assert(!result.ok, `Unsafe transfer must fail closed: ${JSON.stringify(input)}`);
  }

  assertEquals(
    policy.kyraTokenAddress.toLowerCase(),
    "0xa2d99db0593ffd57ae9b92103515bba061fa5ec1",
    "The transfer lane must remain fixed to the official KYRA contract.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Transfer transaction policy checks passed.");
