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

const audit = read("docs/phase-7F-telegram-execution-boundary-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const executionGate = read("supabase/functions/telegram-webhook/execution-gate.ts");
const executionGateTest = read("supabase/functions/telegram-webhook/execution-gate_test.ts");
const readOnlyPipeline = read("supabase/functions/telegram-webhook/read-only-pipeline.ts");
const readOnlyResponse = read("supabase/functions/telegram-webhook/read-only-response.ts");
const updateParser = read("supabase/functions/telegram-webhook/update-parser.ts");
const agentBrain = read("supabase/functions/telegram-webhook/agent-brain.ts");
const agentBrainProvider = read("supabase/functions/telegram-webhook/agent-brain-provider.ts");
const telegramReadme = read("supabase/functions/telegram-webhook/README.md");
const phase6ExecutionGateDoc = read("docs/phase-6-telegram-execution-gate.md");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const required of [
    "# Phase 7F Telegram Execution Boundary Audit",
    "Status: audit packet started.",
    "## Allowed Telegram Behavior",
    "## Blocked Telegram Behavior",
    "## Execution Gate Rules",
    "## Agent Brain Rules",
    "## Phase 7F Done Criteria",
    "Telegram remains read-only",
    "`canExecuteFromTelegram: false`",
    "`canCreateDraftNow: false`",
  ]
) {
  assertIncludes("Phase 7F audit", audit, required);
}

for (
  const blocked of [
    "create approval records",
    "create prepared actions",
    "call Base MCP runtime preparation",
    "open wallet prompts",
    "sign messages or transactions",
    "submit or broadcast transactions",
  ]
) {
  assertIncludes("Phase 7F blocked behavior", audit, blocked);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7F-telegram-execution-boundary-audit.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7f`");
assertIncludes("package.json", packageJson, '"check:phase-7f"');
assertIncludes("package.json", packageJson, "npm run check:phase-7f");

for (
  const gateBoundary of [
    '"read_only_allowed"',
    '"approval_draft_candidate"',
    '"blocked"',
    "canExecuteFromTelegram: false",
    "canCreateDraftNow: false",
    "requiresOwnerDashboardApproval: true",
    "replayProtectionRequired: true",
    "rateLimitRequired: true",
    "No wallet prompt, signature, Base MCP call, or transaction submission was created.",
    "Command rejected: Telegram cannot execute, sign, submit, or approve wallet actions.",
    "Only an owner dashboard flow can create approval drafts.",
    "Telegram cannot process secrets, wallet keys, or token material.",
  ]
) {
  assertIncludes("execution gate", executionGate, gateBoundary);
}
assertNotIncludes("execution gate", executionGate, "canExecuteFromTelegram: true");
assertNotIncludes("execution gate", executionGate, "canCreateDraftNow: true");
assertNotIncludes("execution gate", executionGate, "approval_requests");
assertNotIncludes("execution gate", executionGate, "prepared_actions");

for (
  const testBoundary of [
    "telegram execution gate allows normal read-only chat",
    "telegram execution gate marks owner swap review as draft candidate only",
    "telegram execution gate blocks direct execution language",
    "telegram execution gate blocks non-owner draft creation",
    "telegram execution gate blocks secret-like content",
    "telegram execution draft replay key is scoped and validated",
  ]
) {
  assertIncludes("execution gate test", executionGateTest, testBoundary);
}

assertIncludes("update parser", updateParser, 'commandKind: "read_only";');
assertIncludes("update parser", updateParser, 'commandKind: "read_only"');
assertIncludes("update parser", updateParser, '"help"');
assertIncludes("update parser", updateParser, '"status"');
assertIncludes("update parser", updateParser, '"agent"');
assertIncludes("update parser", updateParser, '"actions"');
assertIncludes("update parser", updateParser, '"modules"');
assertIncludes("update parser", updateParser, '"policy"');
for (const unsupportedCommand of ["approve", "swap", "transfer", "execute", "sign"]) {
  assertNotIncludes("update parser supported commands", updateParser, `"${unsupportedCommand}"`);
}

assertIncludes("read-only pipeline", readOnlyPipeline, "processVerifiedTelegramReadOnlyUpdate");
assertIncludes("read-only pipeline", readOnlyPipeline, "reviewTelegramExecutionGate");
assertIncludes("read-only pipeline", readOnlyPipeline, 'commandKind: "read_only"');
assertIncludes(
  "read-only pipeline",
  readOnlyPipeline,
  'executionGate.status !== "read_only_allowed"',
);
assertNotIncludes("read-only pipeline", readOnlyPipeline, "insert(");
assertNotIncludes("read-only pipeline", readOnlyPipeline, "upsert(");
assertNotIncludes("read-only pipeline", readOnlyPipeline, "prepared_actions");
assertNotIncludes("read-only pipeline", readOnlyPipeline, "approval_requests");

assertIncludes("read-only response", readOnlyResponse, "unsafe_execution");
assertIncludes("read-only response", readOnlyResponse, "Kyra cannot execute that from Telegram.");
assertIncludes("read-only response", readOnlyResponse, "Wallet, approval, Base MCP, and onchain actions are disabled.");
assertIncludes("read-only response", readOnlyResponse, "Telegram can brief and plan only.");

for (
  const brainBoundary of [
    'mode: "read_only"',
    "Answer only in read-only mode.",
    "Do not claim that wallet, approval, Base, or onchain actions were executed.",
    "unsafe_execution",
    "Keep wallet, approval, Base MCP, and onchain execution disabled.",
    "hasUnsafeExecutionOveranswer",
    "invalidAgentBrainResponse",
  ]
) {
  assertIncludes("agent brain", agentBrain, brainBoundary);
}
assertNotIncludes("agent brain", agentBrain, "sendTransaction");
assertNotIncludes("agent brain", agentBrain, "writeContract");
assertNotIncludes("agent brain", agentBrain, "prepared_actions");
assertNotIncludes("agent brain", agentBrain, "approval_requests");

assertIncludes("agent brain provider", agentBrainProvider, 'request.mode !== "read_only"');
assertIncludes("agent brain provider", agentBrainProvider, "kyra_surface: \"telegram\"");
assertIncludes("agent brain provider", agentBrainProvider, "kyra_mode: checkedRequest.mode");
assertIncludes("agent brain provider", agentBrainProvider, "https:");
assertIncludes("agent brain provider", agentBrainProvider, "providerUnavailable");
assertNotIncludes("agent brain provider", agentBrainProvider, "sendTransaction");
assertNotIncludes("agent brain provider", agentBrainProvider, "writeContract");

for (
  const readmeBoundary of [
    "Does not trigger wallet, Base MCP, or onchain execution.",
    "Execution-gate decisions keep `canExecuteFromTelegram` and",
    "`canCreateDraftNow` false.",
    "No Telegram-created approval record, prepared",
    "action, wallet prompt, Base MCP call, signature, or transaction submission",
    "Do not enable write, approval, wallet, Base MCP, onchain, or LLM command",
  ]
) {
  assertIncludes("telegram README", telegramReadme, readmeBoundary);
}

for (
  const docBoundary of [
    "No Telegram-created approval records.",
    "No wallet prompts.",
    "No Base MCP calls.",
    "canExecuteFromTelegram",
    "canCreateDraftNow",
  ]
) {
  assertIncludes("Phase 6 execution gate doc", phase6ExecutionGateDoc, docBoundary);
}

assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|createBaseMcpStatusCheckAdapter|createPreparedActionStorageAdapter|storePreparedActionSummary|prepared_action_owner_summaries/u,
  "Telegram runtime must not call Base MCP or prepared-action storage",
);
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /WalletApprovalModal|useConnect|useSendTransaction|useSignMessage|sendTransaction|writeContract|signMessage/u,
  "Telegram runtime must not open wallet prompts or sign transactions",
);
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /from\(["']prepared_actions["']\)|from\(["']approval_requests["']\)|\.insert\(|\.upsert\(/u,
  "Telegram runtime must not create approval or prepared-action rows",
);

console.log("Phase 7F Telegram execution boundary checks passed.");
