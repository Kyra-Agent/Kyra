import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-runtime-preflight-test");
const outputPath = resolve(outDir, "phase8RuntimeEnablementPreflight.mjs");

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

function stripImports(source) {
  return source.replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s+"\.\/[^\"]+";\n?/g, "");
}

mkdirSync(outDir, { recursive: true });

const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8RuntimeEnablementPreflight.ts"), "utf8"),
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8RuntimeEnablementPreflight,
    getPhase8RuntimeEnablementPreflightBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const controlledSubmission = {
    status: "ready_to_submit",
    ownerOnly: true,
    baseAccountPrimaryLane: true,
    officialMcpRequired: false,
    transactionSubmissionAllowed: true,
    resultCloseoutRecorded: false,
    reasons: [],
    message: "ready",
  };
  const liveWindowActivation = {
    status: "ready",
    ownerOnly: true,
    transactionSubmissionAllowed: true,
    reasons: [],
    message: "ready",
  };
  const baseInput = {
    runtimeFlagEnabled: true,
    ownerSignedIn: true,
    selectedAgent: true,
    baseAccountConnected: true,
    controlledSubmission,
    liveWindowActivation,
    resultCloseoutRecorded: false,
    privateDashboardSource: true,
    telegramCanAuthorize: false,
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8RuntimeEnablementPreflight(baseInput);
  assertEquals(ready.status, "ready");
  assertEquals(ready.runtimeSubmitterEnabled, true);
  assertEquals(ready.reasons.length, 0);

  for (const [field, reason] of [
    ["runtimeFlagEnabled", "runtime_flag_required"],
    ["ownerSignedIn", "owner_session_required"],
    ["selectedAgent", "selected_agent_required"],
    ["baseAccountConnected", "base_account_required"],
    ["privateDashboardSource", "private_dashboard_required"],
  ]) {
    const result = evaluatePhase8RuntimeEnablementPreflight({
      ...baseInput,
      [field]: false,
    });
    assertEquals(result.status, "locked", `${field} should lock preflight`);
    assert(result.reasons.includes(reason), `${reason} missing`);
    assertEquals(result.runtimeSubmitterEnabled, false, `${field} must not enable runtime`);
  }

  const blockedSubmission = evaluatePhase8RuntimeEnablementPreflight({
    ...baseInput,
    controlledSubmission: {
      ...controlledSubmission,
      status: "blocked",
      transactionSubmissionAllowed: false,
      reasons: ["submission_nonce_required"],
    },
  });
  assert(blockedSubmission.reasons.includes("controlled_submission_required"));

  const blockedActivation = evaluatePhase8RuntimeEnablementPreflight({
    ...baseInput,
    liveWindowActivation: {
      ...liveWindowActivation,
      status: "locked",
      transactionSubmissionAllowed: false,
      reasons: ["operator_ack_required"],
    },
  });
  assert(blockedActivation.reasons.includes("live_window_activation_required"));

  const closeoutRecorded = evaluatePhase8RuntimeEnablementPreflight({
    ...baseInput,
    resultCloseoutRecorded: true,
  });
  assert(closeoutRecorded.reasons.includes("result_already_recorded"));

  const telegram = evaluatePhase8RuntimeEnablementPreflight({
    ...baseInput,
    telegramCanAuthorize: true,
  });
  assert(telegram.reasons.includes("telegram_authority_forbidden"));

  const publicProfile = evaluatePhase8RuntimeEnablementPreflight({
    ...baseInput,
    visibleInPublicProfile: true,
  });
  assert(publicProfile.reasons.includes("public_visibility_forbidden"));

  assertEquals(
    getPhase8RuntimeEnablementPreflightBlockMessage("runtime_flag_required"),
    "Phase 8 controlled submission runtime must be explicitly enabled for the owner window.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 runtime enablement preflight checks passed.");
