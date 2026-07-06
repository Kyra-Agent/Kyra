import { readFileSync, readdirSync, statSync } from "node:fs";
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

const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const phase6Closeout = read("docs/phase-6-closeout-audit.md");
const phase6Checklist = read("docs/phase-6-wallet-base-checklist.md");
const context = read("docs/kyra-agent-context.md");
const readme = read("README.md");
const packageJson = read("package.json");
const appConfig = read("src/config/appConfig.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const baseMcpDependencies = read(
  "supabase/functions/base-mcp-prepare/dependencies.ts",
);
const baseMcpCore = read("supabase/functions/base-mcp-prepare/core.ts");
const baseMcpRuntimeConfig = read(
  "supabase/functions/base-mcp-prepare/runtime-config.ts",
);
const telegramExecutionGate = read(
  "supabase/functions/telegram-webhook/execution-gate.ts",
);
const preparedActionForwardSql = read(
  "supabase/prepared_action_storage_forward_review.sql",
);
const preparedActionVerifierSql = read(
  "supabase/verify_prepared_action_storage_review.sql",
);
const schema = read("supabase/schema.sql");
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const section of [
    "# Phase 7 Pre-Execution Audit",
    "Status: Phase 7AJ controlled read-only Base status smoke complete.",
    "## Crown Jewels",
    "## Non-Negotiable Gates",
    "### 7B - Ownership, RLS, And Write Path Audit",
    "### 7C - Base MCP Runtime Audit",
    "### 7D - Prepared Action Storage Audit",
    "### 7E - Wallet Prompt And Signing Audit",
    "### 7F - Telegram Execution Boundary Audit",
    "### 7G - Logs, Errors, And Observability Audit",
    "### 7K - Owner Dashboard Base MCP Status Caller",
    "## Candidate Selection Rules",
    "The current safest candidate remains read-only Base MCP status preparation.",
    "real signable action requires a separate Phase 7 decision packet.",
  ]
) {
  assertIncludes("Phase 7 audit", phase7Audit, section);
}

for (
  const boundary of [
    "User wallet security.",
    "User Telegram bot token security.",
    "Prepared-action storage SQL remains review-only.",
    "Wallet provider dependencies are installed but runtime-gated.",
    "Telegram-created approval drafts.",
    "Base MCP runtime adapter calls.",
    "Wallet prompts must be user-initiated from the owner dashboard.",
    "`canExecuteFromTelegram` remains `false`.",
    "`canCreateDraftNow` remains `false`.",
    "Netlify deploys should be batched to avoid unnecessary credit usage.",
  ]
) {
  assertIncludes("Phase 7 audit", phase7Audit, boundary);
}

assertIncludes(
  "Phase 6 closeout",
  phase6Closeout,
  "Status: pushed live hardening complete.",
);
assertIncludes(
  "Phase 6 closeout",
  phase6Closeout,
  "wallet execution is still",
);
assertIncludes(
  "Phase 6 closeout",
  phase6Closeout,
  "intentionally disabled",
);
assertIncludes(
  "Phase 6 checklist",
  phase6Checklist,
  "Wallet prompts, Base MCP runtime execution, signing, swaps, transfers, and",
);
assertIncludes(
  "Kyra context",
  context,
  "Phase 7 pre-execution audit",
);
assertIncludes(
  "README",
  readme,
  "Base Account readiness, controlled owner execution flow, public hardening, support operations, launch QA, and final security/privacy review.",
);
assertIncludes(
  "Kyra context",
  context,
  "Phase 7 is complete as Base Account + execution readiness.",
);
assertIncludes(
  "Kyra context",
  context,
  "Phase 8 implementation is closed",
);
assertIncludes(
  "Dashboard",
  dashboard,
  "Official Base MCP wallet authority is blocked until provider",
);
assertIncludes(
  "Dashboard",
  dashboard,
  "metadata, least-privilege scope, tool mapping, and approval",
);
assertIncludes("package.json", packageJson, '"check:phase-6"');
assertIncludes("package.json", packageJson, '"check:phase-7-entry"');

assertIncludes("appConfig", appConfig, 'walletExecution: "disabled"');
assert(
  !appConfig.includes("VITE_KYRA_ENABLE_WALLET") &&
    !appConfig.includes("VITE_KYRA_WALLET_EXECUTION"),
  "Wallet execution must not be enabled by a public VITE env flag.",
);
assertIncludes(
  "WalletProviderBoundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
assertIncludes("WalletProviderBoundary", walletBoundary, "return <>{children}</>;");

assert(
  baseMcpDependencies.includes("prepareBaseMcpAction"),
  "Base MCP runtime dependencies must wire provider preparation after Phase 7J.",
);
assert(
  baseMcpDependencies.includes("createBaseMcpStatusCheckAdapter"),
  "Base MCP runtime dependencies must wire the reviewed provider adapter after Phase 7J.",
);
assert(
  !baseMcpDependencies.includes("storePreparedActionSummary"),
  "Base MCP runtime dependencies must not wire prepared-action storage.",
);
assertIncludes("Base MCP core", baseMcpCore, "Base MCP preparation is disabled.");
assertIncludes(
  "Base MCP core",
  baseMcpCore,
  "Base MCP preparation is not configured.",
);
assertIncludes(
  "Base MCP runtime config",
  baseMcpRuntimeConfig,
  'value === "true"',
);
assertIncludes(
  "Base MCP runtime config",
  baseMcpRuntimeConfig,
  'url.protocol !== "https:"',
);

assertIncludes(
  "Telegram execution gate",
  telegramExecutionGate,
  "canExecuteFromTelegram: false",
);
assertIncludes(
  "Telegram execution gate",
  telegramExecutionGate,
  "canCreateDraftNow: false",
);
assertIncludes(
  "Telegram execution gate",
  telegramExecutionGate,
  "No wallet prompt, signature, Base MCP call, or transaction submission was created.",
);
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|storePreparedActionSummary/u,
  "Telegram runtime must not call Base MCP or prepared-action storage",
);

assertIncludes(
  "prepared action forward SQL",
  preparedActionForwardSql,
  "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.",
);
assertIncludes(
  "prepared action verifier SQL",
  preparedActionVerifierSql,
  "REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION.",
);
assert(
  !schema.includes("create table if not exists public.prepared_actions"),
  "Prepared action storage must not be part of the baseline schema at Phase 7 entry.",
);

const phase7WalletSubmissionScanFiles = sourceFiles.filter(
  (path) => path !== "src/components/Phase8ControlledSubmitter.tsx" && path !== "src/components/Phase8LowValueSubmitter.tsx",
);

assertFilesDoNotInclude(
  phase7WalletSubmissionScanFiles,
  /\b(?:useSendTransaction|useWriteContract|sendTransaction|writeContract|signMessage|signTypedData)\b/u,
  "Frontend must not include live wallet signing/submission calls at Phase 7 entry",
);

console.log("Phase 7 entry checks passed.");
