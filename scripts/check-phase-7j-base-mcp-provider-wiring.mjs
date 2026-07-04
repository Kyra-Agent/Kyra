import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

function assertNotIncludes(sourceName, source, text) {
  assert(!source.includes(text), `${sourceName} must not include: ${text}`);
}

function walkFiles(path) {
  const absolutePath = resolve(root, path);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [path];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      return walkFiles(childPath);
    }

    return entry.isFile() ? [childPath] : [];
  });
}

function assertFilesDoNotInclude(paths, forbiddenPattern, message) {
  for (const path of paths) {
    assert(!forbiddenPattern.test(read(path)), `${message}: ${path}`);
  }
}

const doc = read("docs/phase-7J-base-mcp-provider-wiring.md");
const roadmap = read("docs/product-phase-roadmap.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const gate = read("src/types/controlledLiveTransactionGate.ts");
const gateTest = read("scripts/test-controlled-live-transaction-gate.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);

for (
  const required of [
    "# Phase 7J Controlled Live Transaction Gate",
    "Status: complete as a local controlled-live gate definition.",
    "## Decision",
    "## Runtime Boundary",
    "## Product Boundary",
    "## Security Boundary",
    "## Implementation",
    "## Failure Boundary",
    "## Local Verification",
    "## Live Smoke Checklist",
    "## Rollback Plan",
    "## Done Criteria",
    "walletPromptAllowed: false",
    "walletSigningAllowed: false",
    "transactionSubmissionAllowed: false",
    "runtime_execution_must_remain_locked",
  ]
) {
  assertIncludes("Phase 7J doc", doc, required);
}

for (
  const required of [
    "one owner session",
    "one workspace scope",
    "one deployed agent scope",
    "one owner Base Account connection",
    "Base mainnet chain id `8453`",
    "exactly one prepared action candidate",
    "deterministic allowlist pass",
    "low-risk action classification",
    "rollback plan ready",
    "emergency disablement ready",
    "post-transaction audit ready",
    "Telegram has no authority",
    "public profile visibility is forbidden",
  ]
) {
  assertIncludes("Phase 7J decision", doc, required);
}

for (
  const required of [
    "export type ControlledLiveTransactionStatus",
    "export type ControlledLiveTransactionBlockReason",
    "export interface ControlledLiveTransactionGateInput",
    "export interface ControlledLiveTransactionGateResult",
    "evaluateControlledLiveTransactionGate",
    "owner_scope_required",
    "workspace_scope_required",
    "agent_scope_required",
    "base_account_required",
    "base_network_required",
    "single_action_required",
    "allowlisted_action_required",
    "low_risk_action_required",
    "dual_approval_required",
    "result_monitoring_required",
    "rollback_required",
    "emergency_disable_required",
    "post_transaction_audit_required",
    "public_visibility_forbidden",
    "telegram_authority_forbidden",
    "runtime_execution_must_remain_locked",
    "walletPromptAllowed: false",
    "walletSigningAllowed: false",
    "transactionSubmissionAllowed: false",
  ]
) {
  assertIncludes("controlled live gate", gate, required);
}

for (
  const forbidden of [
    "sendTransaction",
    "writeContract",
    "eth_sendTransaction",
    "signMessage",
    "signTypedData",
    "storePreparedActionSummary",
    "fetch(",
  ]
) {
  assertNotIncludes("controlled live gate", gate, forbidden);
}

for (
  const required of [
    "ready_for_live_window_approval",
    "live_window_approved_runtime_locked",
    "single_action_required",
    "low_risk_action_required",
    "dual_approval_required",
    "result_monitoring_required",
    "telegram_authority_forbidden",
    "runtime_execution_must_remain_locked",
    "Controlled live transaction gate checks passed.",
  ]
) {
  assertIncludes("controlled live gate test", gateTest, required);
}

for (
  const required of [
    '"test:controlled-live-transaction-gate"',
    '"check:phase-7j": "npm run test:controlled-live-transaction-gate && node scripts/check-phase-7j-base-mcp-provider-wiring.mjs"',
    "npm run check:phase-7j",
  ]
) {
  assertIncludes("package.json", packageJson, required);
}

for (
  const required of [
    "evaluateControlledLiveTransactionGate",
    "controlledLiveTransactionGate",
    "Phase 7J controlled live gate",
    "Gate is ready for explicit live-window approval only",
    "wallet prompt, signing, and submission",
  ]
) {
  assertIncludes("dashboard", dashboard, required);
}

for (
  const required of [
    ".controlled-live-gate-panel",
    ".controlled-live-gate-header",
    ".controlled-live-gate-grid",
  ]
) {
  assertIncludes("styles", styles, required);
}

for (
  const required of [
    "### 7J - Controlled Live Transaction",
    "Status: complete as a local controlled-live gate definition.",
    "Phase 7J controlled live transaction gate is implemented",
    "In progress: Batch 10",
  ]
) {
  assertIncludes("roadmap", roadmap, required);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7J-base-mcp-provider-wiring.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7j`");
assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Wallet prompts, signing, transaction submission, swaps, transfers, approvals,",
);
assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "and contract calls remain disabled.",
);

assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /evaluateControlledLiveTransactionGate|controlledLiveTransaction|sendTransaction|writeContract|eth_sendTransaction|storePreparedActionSummary/u,
  "Telegram runtime must not trigger controlled live transactions",
);

assertFilesDoNotInclude(
  sourceFiles,
  /VITE_.*(?:BASE_MCP|SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY)/u,
  "Frontend must not expose backend secret env keys",
);

console.log("Phase 7J controlled live transaction gate checks passed.");
