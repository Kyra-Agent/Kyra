import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-result-monitoring-test");
const outputPath = resolve(outDir, "resultMonitoringCloseout.mjs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
  }
}

function stripImport(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(
    new RegExp(`import\\s+(?:type\\s+)?\\{[\\s\\S]*?\\}\\s+from\\s+"${escaped}";`, "u"),
    "",
  );
}

mkdirSync(outDir, { recursive: true });

const productChainsSource = readFileSync(
  resolve(root, "src/config/productChains.ts"),
  "utf8",
);
const walletSigningSource = readFileSync(
  resolve(root, "src/types/walletSigning.ts"),
  "utf8",
).replace(
  /import \{[\s\S]*?\} from "\.\.\/config\/productChains";/u,
  "",
);
const resultMonitoringSource = stripImport(
  readFileSync(resolve(root, "src/types/resultMonitoringCloseout.ts"), "utf8"),
  "./walletSigning",
);
const transpiled = ts.transpileModule(
  `${productChainsSource}\n${walletSigningSource}\n${resultMonitoringSource}`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
);

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluateResultMonitoringCloseout,
    getResultMonitoringBlockMessage,
    sanitizeResultMonitoringFailure,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const hash =
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const baseInput = {
    ownerUserId: "owner_7i",
    workspaceId: "workspace_7i",
    agentId: "agent_666",
    preparedActionId: "prepared_7i",
    providerStatus: "not_started",
    txHash: null,
    confirmationId: null,
    failureCode: null,
    disconnectRequested: false,
    emergencyDisabled: false,
    visibleInPublicProfile: false,
  };

  const notStarted = evaluateResultMonitoringCloseout(baseInput);
  assertEquals(notStarted.status, "not_started");
  assertEquals(notStarted.ownerOnly, true);
  assertEquals(notStarted.txHash, null);
  assertEquals(notStarted.disconnectAllowed, false);

  const hashBeforeSubmit = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "owner_rejected",
    txHash: hash,
  });
  assert(hashBeforeSubmit.reasons.includes("provider_submission_required_for_tx_hash"));
  assertEquals(hashBeforeSubmit.txHash, null);

  const submitted = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "provider_submitted",
    txHash: hash,
  });
  assertEquals(submitted.status, "submitted_pending_confirmation");
  assertEquals(submitted.txHash, hash);
  assertEquals(submitted.disconnectAllowed, false);

  const confirmedMissingData = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "confirmed",
    txHash: hash,
  });
  assert(confirmedMissingData.reasons.includes("confirmation_required"));

  const confirmed = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "confirmed",
    txHash: hash,
    confirmationId: "base-block-123",
    disconnectRequested: true,
  });
  assertEquals(confirmed.status, "closed_confirmed");
  assertEquals(confirmed.txHash, hash);
  assertEquals(confirmed.confirmationId, "base-block-123");
  assertEquals(confirmed.disconnectAllowed, true);

  const failed = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "provider_failed",
    failureCode: "network_mismatch",
    disconnectRequested: true,
  });
  assertEquals(failed.status, "closed_failed");
  assertEquals(failed.sanitizedFailureReason, "Wallet must be connected to the selected network.");
  assertEquals(failed.disconnectAllowed, true);

  const publicBlocked = evaluateResultMonitoringCloseout({
    ...baseInput,
    visibleInPublicProfile: true,
  });
  assert(publicBlocked.reasons.includes("public_visibility_forbidden"));

  const earlyDisconnect = evaluateResultMonitoringCloseout({
    ...baseInput,
    providerStatus: "provider_submitted",
    txHash: hash,
    disconnectRequested: true,
  });
  assert(earlyDisconnect.reasons.includes("disconnect_requires_closed_state"));
  assertEquals(earlyDisconnect.disconnectAllowed, false);

  const emergencyDisabled = evaluateResultMonitoringCloseout({
    ...baseInput,
    emergencyDisabled: true,
    disconnectRequested: true,
  });
  assertEquals(emergencyDisabled.status, "closed_disabled");
  assertEquals(emergencyDisabled.emergencyDisabled, true);
  assertEquals(emergencyDisabled.disconnectAllowed, true);

  assertEquals(
    sanitizeResultMonitoringFailure("submission_failed"),
    "Transaction submission failed safely.",
  );
  assertEquals(
    getResultMonitoringBlockMessage("provider_submission_required_for_tx_hash"),
    "Transaction hash is forbidden until provider submission is observed.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Result monitoring closeout checks passed.");
