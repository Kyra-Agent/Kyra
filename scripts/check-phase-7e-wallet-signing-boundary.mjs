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

const audit = read("docs/phase-7E-wallet-prompt-signing-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const appConfig = read("src/config/appConfig.ts");
const app = read("src/App.tsx");
const walletModal = read("src/components/WalletApprovalModal.tsx");
const walletSigning = read("src/types/walletSigning.ts");
const walletPromptEligibility = read("src/types/walletPromptEligibility.ts");
const unsignedHandoff = read("src/types/unsignedTransactionHandoff.ts");
const riskReview = read("src/types/riskReview.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const walletRuntime = read("src/providers/WalletRuntimeProviders.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const frontendFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const walletProviderImportPattern =
  /(?:from\s+["'](?:wagmi|viem|@base-org\/account|@tanstack\/react-query)["']|import\(["'](?:wagmi|viem|@base-org\/account|@tanstack\/react-query)["']\))/u;
const walletProviderImportAllowlist = new Set([
  "src/providers/WalletRuntimeProviders.tsx",
  "src/components/OwnerWalletConnectionPanel.tsx",
  "src/pages/Dashboard.tsx",
  "src/components/Phase8ControlledSubmitter.tsx",
  "src/components/Phase8LowValueSubmitter.tsx",
]);

for (
  const required of [
    "# Phase 7E Wallet Prompt And Signing Audit",
    "Status: audit packet started.",
    "## Prompt Eligibility Rules",
    "## Blocked Prompt Sources",
    "## Signable Action Boundary",
    "## Failure Boundary",
    "## Phase 7E Done Criteria",
    "Wallet prompts, signing, transaction submission,",
    "`request_wallet_prompt` requires `ownerAction`.",
    "`base_mcp_status_check` is explicitly rejected as a signable handoff.",
  ]
) {
  assertIncludes("Phase 7E audit", audit, required);
}

for (
  const blockedSource of [
    "page load",
    "public agent page",
    "Telegram message",
    "Telegram webhook",
    "LLM output",
    "Base MCP provider response",
    "background retry",
  ]
) {
  assertIncludes("Phase 7E blocked prompt sources", audit, blockedSource);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7E-wallet-prompt-signing-audit.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7e`");
assertIncludes("package.json", packageJson, '"check:phase-7e"');
assertIncludes("package.json", packageJson, "npm run check:phase-7e");
assertIncludes("package.json", packageJson, "test:wallet-prompt-eligibility");

assertIncludes("appConfig", appConfig, 'walletExecution: "disabled"');
assertNotIncludes("appConfig", appConfig, "VITE_KYRA_ENABLE_WALLET");
assertNotIncludes("appConfig", appConfig, "VITE_KYRA_WALLET_EXECUTION");
assertNotIncludes("appConfig", appConfig, "walletExecution: readEnv");

for (const path of frontendFiles) {
  if (walletProviderImportAllowlist.has(path)) {
    continue;
  }

  assert(
    !walletProviderImportPattern.test(read(path)),
    `${path} must not import wallet provider packages outside the runtime boundary.`,
  );
}

assertIncludes("WalletProviderBoundary", walletBoundary, "lazy");
assertIncludes("WalletProviderBoundary", walletBoundary, "Suspense");
assertIncludes(
  "WalletProviderBoundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
assertIncludes("WalletProviderBoundary", walletBoundary, "return <>{children}</>;");
assertNotIncludes("WalletProviderBoundary", walletBoundary, "window.ethereum");

for (
  const runtimeBoundary of [
    "WagmiProvider",
    "QueryClientProvider",
    "injected({ shimDisconnect: true })",
    "id: productChain.id",
    "storage: null",
    "reconnectOnMount={false}",
  ]
) {
  assertIncludes("WalletRuntimeProviders", walletRuntime, runtimeBoundary);
}
assertNotIncludes("WalletRuntimeProviders", walletRuntime, "coinbaseWallet");
assertNotIncludes("WalletRuntimeProviders", walletRuntime, "baseAccount(");
assertNotIncludes("WalletRuntimeProviders", walletRuntime, "window.ethereum");

for (
  const modalBoundary of [
    "Approval review",
    "Record Approval Review",
    "No wallet prompt was opened.",
    "Wallet execution remains disabled until provider integration.",
    "Real wallet signing remains disabled.",
    "Unsigned handoff",
    "connected wallet",
    "NYX-05 risk review",
  ]
) {
  assertIncludes("WalletApprovalModal", walletModal, modalBoundary);
}
for (
  const forbiddenModalSurface of [
    "useConnect",
    "useSendTransaction",
    "useSignMessage",
    "writeContract",
    "sendTransaction",
    "signMessage",
    "wallet_prompt_opened",
    '"submitted"',
    '"confirmed"',
  ]
) {
  assertNotIncludes("WalletApprovalModal", walletModal, forbiddenModalSurface);
}

for (
  const stateBoundary of [
    "request_wallet_prompt",
    "ownerAction",
    "Wallet prompt requires explicit owner action.",
    "Submitted actions require a transaction hash.",
    "Rejected actions must not include a transaction hash.",
    "Failed actions before submission must not include a transaction hash.",
    "Wallet must be connected to Base.",
    "isBaseWalletNetwork",
    "isTransactionHash",
  ]
) {
  assertIncludes("wallet signing state", walletSigning, stateBoundary);
}
assertIncludes(
  "wallet signing state",
  walletSigning,
  "wallet_prompt_opened: [\"submit\", \"reject\", \"fail\", \"reset\"]",
);

for (
  const promptEligibilityBoundary of [
    "WalletPromptEligibilityInput",
    "WalletPromptSource",
    "owner_dashboard_click",
    "wallet_execution_disabled",
    "forbidden_prompt_source",
    "base_account_connection_required",
    "preparedActionReviewed",
    "riskReviewReady",
    "ownerApprovalRecorded",
    "handoffValid",
    "handoffExpired",
    "evaluateWalletPromptEligibility",
    "getWalletPromptBlockMessage",
    "isForbiddenWalletPromptSource",
    "input.promptSource !== allowedPromptSource",
    "input.chainId !== baseChainId",
  ]
) {
  assertIncludes(
    "wallet prompt eligibility",
    walletPromptEligibility,
    promptEligibilityBoundary,
  );
}

for (
  const handoffBoundary of [
    'walletSignableActionKinds = ["base_reviewed_transaction"] as const',
    'String(handoff.actionKind) === "base_mcp_status_check"',
    "Read-only status checks cannot be signed.",
    "baseChainId = currentProductChain.id",
    "gasPayer: WalletGasPayer",
    "connected_wallet",
    "privateKey?: never",
    "seedPhrase?: never",
    "telegramToken?: never",
    "rawProviderPayload?: never",
    "txHash?: never",
    "Wallet handoff expiry window is too long.",
  ]
) {
  assertIncludes("unsigned handoff", unsignedHandoff, handoffBoundary);
}
assertNotIncludes("unsigned handoff", unsignedHandoff, "walletAddress:");

for (
  const riskBoundary of [
    '"base_mcp_status_check"',
    '"base_reviewed_transaction"',
    'const signablePreparedActionKinds = new Set(["base_reviewed_transaction"])',
    "Read-only Base MCP status check.",
    "No wallet prompt.",
    "No token spend.",
    "No calldata.",
    "Owner approval is required before any wallet prompt.",
  ]
) {
  assertIncludes("risk review", riskReview, riskBoundary);
}

assertIncludes("App", app, "transitionWalletSigningState");
assertIncludes("App", app, "validateUnsignedTransactionHandoff");
assertIncludes("App", app, "reviewUnsignedTransactionHandoff");
assertIncludes("App", app, 'event: "load_preview"');
assertIncludes("App", app, 'event: "require_review"');
assertIncludes("App", app, 'event: "reject"');
assertNotIncludes("App", app, 'event: "request_wallet_prompt"');
assertNotIncludes("App", app, 'event: "wallet_prompt_opened"');
assertNotIncludes("App", app, 'event: "submit"');
assertNotIncludes("App", app, 'event: "confirm"');
assertNotIncludes("App", app, "sendTransaction");
assertNotIncludes("App", app, "writeContract");
assertNotIncludes("App", app, "signMessage");

for (
  const dashboardBoundary of [
    "evaluateWalletPromptEligibility",
    "getWalletPromptBlockMessage",
    "walletExecutionEnabled",
    "promptSource: \"owner_dashboard_click\"",
    "preparedActionReviewed: false",
    "riskReviewReady: false",
    "ownerApprovalRecorded: false",
    "handoffValid: false",
    "Wallet approval boundary",
    "Prompt locked",
    "Telegram",
    "locked",
  ]
) {
  assertIncludes("Dashboard", dashboard, dashboardBoundary);
}
assertNotIncludes("Dashboard", dashboard, "useSignMessage");
assertNotIncludes("Dashboard", dashboard, "sendTransaction");
assertNotIncludes("Dashboard", dashboard, "writeContract");

assertNotIncludes("dashboard service", dashboardService, "prepared_tx");
assertNotIncludes("dashboard service", dashboardService, "tx_hash");
assertNotIncludes("PublicAgent", publicAgent, "WalletApprovalModal");
assertNotIncludes("PublicAgent", publicAgent, "wallet_prompt");
assertNotIncludes("PublicAgent", publicAgent, "sendTransaction");

assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /wallet_prompt|WalletApprovalModal|sendTransaction|writeContract|signMessage|prepared_action_owner_summaries/u,
  "Telegram runtime must not open wallet prompts or sign transactions",
);

console.log("Phase 7E wallet signing boundary checks passed.");
