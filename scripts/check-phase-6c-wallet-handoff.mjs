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

const audit = read("docs/phase-6C-wallet-signing-handoff-audit.md");
const plan = read("docs/phase-6C-wallet-signing-handoff-plan.md");
const providerDecision = read("docs/phase-6C-wallet-provider-decision.md");
const riskReviewDoc = read("docs/phase-6-risk-permission-review.md");
const executionResultDoc = read("docs/phase-6-execution-result-logging.md");
const checklist = read("docs/phase-6-wallet-base-checklist.md");
const appConfig = read("src/config/appConfig.ts");
const packageJson = read("package.json");
const parsedPackageJson = JSON.parse(packageJson);
const walletModal = read("src/components/WalletApprovalModal.tsx");
const actionConsole = read("src/components/ActionConsole.tsx");
const actionData = read("src/data/actions.ts");
const templateData = read("src/data/templates.ts");
const demoScenarioData = read("src/data/demoScenarios.ts");
const demoBackendData = read("src/data/demoBackend.ts");
const faqData = read("src/data/faqs.ts");
const dashboardPreview = read("src/components/DashboardPreview.tsx");
const heroConsole = read("src/components/HeroConsole.tsx");
const securitySection = read("src/components/SecuritySection.tsx");
const app = read("src/App.tsx");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const supabaseKyraRepository = read("src/services/supabaseKyraRepository.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const walletSigningTypes = read("src/types/walletSigning.ts");
const riskReviewTypes = read("src/types/riskReview.ts");
const executionResultTypes = read("src/types/executionResult.ts");
const unsignedTransactionHandoffTypes = read(
  "src/types/unsignedTransactionHandoff.ts",
);
const walletProviderBoundary = read("src/providers/WalletProviderBoundary.tsx");
const walletRuntimeProviders = read("src/providers/WalletRuntimeProviders.tsx");
const main = read("src/main.tsx");
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|mjs)$/.test(path)
);
const walletProviderPackageImportPattern =
  /(?:import\s+(?:type\s+)?[\s\S]*?\s+from\s+["'](?:wagmi|viem|@base-org\/account|@tanstack\/react-query)["']|await\s+import\(["'](?:wagmi|viem|@base-org\/account|@tanstack\/react-query)["']\))/;
const walletProviderImportAllowlist = new Set([
  "src/providers/WalletRuntimeProviders.tsx",
]);
const approvedWalletDependencyNames = new Set([
  "@base-org/account",
  "@tanstack/react-query",
  "viem",
  "wagmi",
]);
const installedDependencyNames = [
  ...Object.keys(parsedPackageJson.dependencies ?? {}),
  ...Object.keys(parsedPackageJson.devDependencies ?? {}),
];
const unexpectedWalletDependencies = installedDependencyNames.filter((name) =>
  !approvedWalletDependencyNames.has(name) &&
  /(wallet|walletconnect|ethers|web3|rainbow|reown|metamask|privy|dynamic|thirdweb|alchemy|moralis)/i
    .test(name)
);

for (
  const boundary of [
    "No wallet provider, wallet prompt, signature,",
    "no seed phrase path",
    "no private key path",
    "no hidden signing",
    "no Telegram-triggered signing or submission",
    "Do not implement live signing yet.",
  ]
) {
  assertIncludes("Phase 6C audit", audit, boundary);
}

for (
  const boundary of [
    "Status: plan only. No live signing is enabled.",
    "The first signable action must not be `base_mcp_status_check`.",
    "wallet_prompt_requested` requires an owner click.",
    "User rejection does not create `tx_hash`.",
    "Telegram execution request remains refused.",
  ]
) {
  assertIncludes("Phase 6C plan", plan, boundary);
}

for (
  const decision of [
    "Use `wagmi` with `viem` as the first wallet integration path",
    "`baseAccount()` as the preferred Base-native connector.",
    "`coinbaseWallet()` as a fallback connector.",
    "Do not use direct raw `window.ethereum` as the primary app integration.",
    "Dependencies are installed, but no wallet execution path is enabled.",
    "npm install wagmi viem @tanstack/react-query @base-org/account",
    "no automatic wallet prompt on page load",
    "sign `base_mcp_status_check`",
  ]
) {
  assertIncludes("Phase 6C provider decision", providerDecision, decision);
}

assertIncludes(
  "Phase 6C audit",
  audit,
  "Provider Path Is Installed But Not Enabled",
);
assertIncludes(
  "Phase 6C plan",
  plan,
  "docs/phase-6C-wallet-provider-decision.md",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "docs/phase-6C-wallet-provider-decision.md",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "docs/phase-6C-wallet-signing-handoff-audit.md",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "docs/phase-6C-wallet-signing-handoff-plan.md",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "Audit current signing/wallet handoff surface.",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "Choose first wallet provider path.",
);
assertIncludes(
  "Phase 6 checklist",
  checklist,
  "Install wallet provider dependencies after approval.",
);
assertIncludes("package.json", packageJson, '"check:phase-6c"');
assertIncludes("package.json", packageJson, '"test:wallet-signing"');
assertIncludes("package.json", packageJson, '"test:unsigned-handoff"');
assertIncludes("package.json", packageJson, '"test:risk-review"');
assertIncludes("package.json", packageJson, '"test:execution-result"');
assertIncludes("package.json", packageJson, '"wagmi"');
assertIncludes("package.json", packageJson, '"viem"');
assertIncludes("package.json", packageJson, '"@tanstack/react-query"');
assertIncludes("package.json", packageJson, '"@base-org/account"');
assertIncludes("appConfig", appConfig, 'walletExecution: "disabled"');
assert(
  !appConfig.includes("VITE_KYRA_ENABLE_WALLET") &&
    !appConfig.includes("VITE_KYRA_WALLET_EXECUTION"),
  "Wallet execution must not be controlled by a public VITE env flag during Phase 6C.",
);
assert(
  !appConfig.includes("walletExecution: readEnv"),
  "Wallet execution must remain hard-disabled during Phase 6C.",
);
assertIncludes("main", main, "WalletProviderBoundary");
for (const path of sourceFiles) {
  if (walletProviderImportAllowlist.has(path)) {
    continue;
  }

  assert(
    !walletProviderPackageImportPattern.test(read(path)),
    `${path} must not import wallet provider packages outside the gated runtime provider.`,
  );
}
assertIncludes("dashboard", dashboard, "walletProviderStatus");
assertIncludes("dashboard", dashboard, "executionResults");
assertIncludes("dashboard", dashboard, "Execution audit trail");
assertIncludes("dashboard", dashboard, "owner-only");
assertIncludes("ActionConsole", actionConsole, "Action Readiness");
assertIncludes("ActionConsole", actionConsole, "review draft");
assertIncludes(
  "ActionConsole",
  actionConsole,
  "wallet prompts and onchain execution disabled",
);
assert(
  !actionConsole.includes("Onchain Actions") &&
    !actionConsole.includes("wallet-approved action") &&
    !actionConsole.includes("prepare Base transactions"),
  "Action console copy must not imply live wallet or onchain execution.",
);
assertIncludes("action data", actionData, "Swap Review");
assertIncludes("action data", actionData, "Transfer Review");
assertIncludes(
  "action data",
  actionData,
  "No Telegram-triggered swap execution",
);
assertIncludes(
  "template data",
  templateData,
  "Personal wallet readiness agent",
);
assertIncludes("template data", templateData, "swap reviews");
assertIncludes("template data", templateData, "transfer reviews");
assertIncludes("template data", templateData, "approval-gated Base readiness");
assertIncludes("template data", templateData, "review 10 USDC to ETH swap");
assertIncludes(
  "Supabase Kyra repository",
  supabaseKyraRepository,
  "safetyReviewedTemplateById",
);
assertIncludes(
  "Supabase Kyra repository",
  supabaseKyraRepository,
  "summary: safetyReviewedTemplate.summary",
);
assertIncludes(
  "Supabase Kyra repository",
  supabaseKyraRepository,
  "actions: safetyReviewedTemplate.actions",
);
assertIncludes(
  "Supabase Kyra repository",
  supabaseKyraRepository,
  "terminalSeed: safetyReviewedTemplate.terminalSeed",
);
assertIncludes("demo scenarios", demoScenarioData, "Swap Review");
assertIncludes("demo scenarios", demoScenarioData, "token_swap_review");
assertIncludes(
  "demo scenarios",
  demoScenarioData,
  "BASE ACTION review draft created",
);
assertIncludes("demo scenarios", demoScenarioData, "wallet_execution_disabled");
assertIncludes("demo backend data", demoBackendData, "Swap review draft");
assertIncludes(
  "demo backend data",
  demoBackendData,
  "review draft recorded; wallet execution disabled",
);
assertIncludes("demo backend data", demoBackendData, "demoExecutionResults");
assertIncludes(
  "demo backend data",
  demoBackendData,
  "execution result pending; no transaction hash recorded",
);
assertIncludes(
  "demo backend data",
  demoBackendData,
  "failure state stores sanitized copy only",
);
assertIncludes(
  "FAQ data",
  faqData,
  "wallet prompts, signing, and onchain execution stay disabled",
);
assertIncludes("DashboardPreview", dashboardPreview, "review drafted");
assertIncludes("DashboardPreview", dashboardPreview, "wallet gated");
assertIncludes(
  "DashboardPreview",
  dashboardPreview,
  "Wallet prompts, signing, and network",
);
assertIncludes(
  "DashboardPreview",
  dashboardPreview,
  "fees stay disabled until the owner-controlled handoff is audited.",
);
for (
  const forbidden of [
    "approval-driven execution",
    "prepare onchain actions",
    "prepares transactions",
    "pays network fees",
    "approval requested",
    "status: waiting for wallet approval",
  ]
) {
  assert(
    !templateData.includes(forbidden) &&
      !demoScenarioData.includes(forbidden) &&
      !demoBackendData.includes(forbidden) &&
      !faqData.includes(forbidden) &&
      !dashboardPreview.includes(forbidden),
    `Phase 6C product copy must not imply live wallet execution: ${forbidden}`,
  );
}
assertIncludes("HeroConsole", heroConsole, "BASE ACTION review layer gated");
assertIncludes("HeroConsole", heroConsole, "Wallet review");
assertIncludes("HeroConsole", heroConsole, "Base gated");
assertIncludes(
  "SecuritySection",
  securitySection,
  "Wallet approval gate required",
);
assertIncludes("App", app, "Wallet approval gate required");
assertIncludes("dashboard", dashboard, "Provider stack");
assertIncludes("dashboard", dashboard, "Prompt access");
assertIncludes("dashboard", dashboard, "No automatic wallet prompt");
assertIncludes(
  "dashboard service",
  dashboardService,
  "createWalletProviderStatus",
);
assertIncludes(
  "dashboard service",
  dashboardService,
  "Provider dependencies are installed",
);
for (
  const boundary of [
    "lazy",
    "Suspense",
    "fallback={null}",
    "WalletRuntimeProviders",
    'appConfig.integrations.walletExecution === "disabled"',
  ]
) {
  assertIncludes("WalletProviderBoundary", walletProviderBoundary, boundary);
}
assert(
  !walletProviderBoundary.includes("window.ethereum"),
  "Wallet provider boundary must not use raw window.ethereum.",
);
for (
  const boundary of [
    "WagmiProvider",
    "QueryClientProvider",
    "baseAccount()",
    "coinbaseWallet",
    "reconnectOnMount={false}",
  ]
) {
  assertIncludes("WalletRuntimeProviders", walletRuntimeProviders, boundary);
}
assert(
  !walletRuntimeProviders.includes("window.ethereum"),
  "Wallet runtime providers must not use raw window.ethereum.",
);
assertIncludes("WalletApprovalModal", walletModal, "Record Demo Review");
assertIncludes("WalletApprovalModal", walletModal, "Demo review");
assertIncludes("WalletApprovalModal", walletModal, "Demo rejection recorded");
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "No wallet prompt was opened.",
);
assertIncludes("WalletApprovalModal", walletModal, "NYX-05 risk review");
assertIncludes("WalletApprovalModal", walletModal, "riskReview.permissions");
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "riskReview.explicitApprovalRequired",
);
assertIncludes("WalletApprovalModal", walletModal, "onReject");
assertIncludes("WalletApprovalModal", walletModal, "Cancel");
assertIncludes("WalletApprovalModal", walletModal, "Disabled");
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "signingState: WalletSigningState",
);
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "unsignedHandoff: WalletUnsignedTransactionHandoff",
);
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "unsignedHandoffValidation: WalletUnsignedTransactionHandoffValidation",
);
assertIncludes("WalletApprovalModal", walletModal, "Unsigned handoff");
assertIncludes("WalletApprovalModal", walletModal, "connected wallet");
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "Wallet execution remains disabled until provider integration.",
);
assertIncludes(
  "WalletApprovalModal",
  walletModal,
  "Real wallet signing remains disabled.",
);
assertIncludes("App", app, "transitionWalletSigningState");
assertIncludes("App", app, "validateUnsignedTransactionHandoff");
assertIncludes("App", app, "createDemoUnsignedHandoff");
assertIncludes("App", app, 'event: "load_preview"');
assertIncludes("App", app, 'event: "require_review"');
assertIncludes("App", app, 'event: "reject"');
assert(
  !walletModal.includes('"submitted"') && !walletModal.includes('"confirmed"'),
  "Demo wallet modal must not present submitted or confirmed wallet states.",
);
for (
  const boundary of [
    "RiskReviewLevel",
    '"read-only"',
    '"low"',
    '"medium"',
    '"high"',
    '"blocked"',
    "Unsupported action type. Kyra fails closed.",
    "reviewPreparedActionRisk",
    "reviewUnsignedTransactionHandoff",
  ]
) {
  assertIncludes("risk review model", riskReviewTypes, boundary);
}
for (
  const boundary of [
    "NYX-05 must classify every prepared action",
    "`blocked`",
    "`wallet_prompt`",
    "Unsupported action kinds return `blocked`",
  ]
) {
  assertIncludes("risk review doc", riskReviewDoc, boundary);
}
for (
  const boundary of [
    "ExecutionResultStatus",
    '"pending"',
    '"approved"',
    '"rejected"',
    '"submitted"',
    '"failed"',
    '"confirmed"',
    "Transaction hash is only allowed after submission.",
    "Execution approval requires explicit owner action.",
    "Failed actions before submission must not include a transaction hash.",
    "Execution results must not be public profile data.",
    "sanitizeExecutionFailureReason",
    "validateExecutionResultRecord",
  ]
) {
  assertIncludes("execution result model", executionResultTypes, boundary);
}
for (
  const boundary of [
    "Every execution attempt must produce",
    "`rejected`, `failed`, and `confirmed` are terminal states.",
    "Retry must create a new prepared action",
    "No transaction submission.",
    "No Telegram execution.",
  ]
) {
  assertIncludes("execution result doc", executionResultDoc, boundary);
}
for (
  const state of [
    "not_ready",
    "preview_ready",
    "review_required",
    "wallet_prompt_requested",
    "wallet_prompt_opened",
    "user_rejected",
    "submitted",
    "failed",
    "confirmed",
  ]
) {
  assertIncludes("wallet signing state model", walletSigningTypes, state);
}
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Wallet prompt requires explicit owner action.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Submitted actions require a transaction hash.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Confirmed actions require confirmation data.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Rejected actions must not include a transaction hash.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Failed actions before submission must not include a transaction hash.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "WalletSigningFailureCode",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "network_mismatch",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "Wallet must be connected to Base.",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "isBaseWalletNetwork",
);
assertIncludes(
  "wallet signing state model",
  walletSigningTypes,
  "isTransactionHash",
);
for (
  const boundary of [
    "WalletUnsignedTransactionHandoff",
    "baseChainId = 8453",
    'walletSignableActionKinds = ["base_reviewed_transaction"] as const',
    "gasPayer: WalletGasPayer",
    "connected_wallet",
    "privateKey?: never",
    "seedPhrase?: never",
    "telegramToken?: never",
    "rawProviderPayload?: never",
    "txHash?: never",
    "Read-only status checks cannot be signed.",
    "The connected wallet must pay gas.",
    "Wallet handoff expiry window is too long.",
    "isEvmAddress",
    "isHexData",
    "isSafeValueWei",
  ]
) {
  assertIncludes(
    "unsigned transaction handoff model",
    unsignedTransactionHandoffTypes,
    boundary,
  );
}
assert(
  !unsignedTransactionHandoffTypes.includes("walletAddress:"),
  "Unsigned transaction handoff must not persist wallet address as a required field.",
);
assert(
  !dashboardService.includes("prepared_tx") &&
    !dashboardService.includes("tx_hash"),
  "Dashboard service must keep prepared_tx and tx_hash out of owner reads before 6C implementation.",
);
assert(
  !packageJson.includes("ethers") &&
    !packageJson.includes("@coinbase/wallet-sdk"),
  "Wallet provider dependency set must stay on the approved Wagmi/Viem path.",
);
assert(
  unexpectedWalletDependencies.length === 0,
  `Unexpected wallet-sensitive dependencies require review: ${
    unexpectedWalletDependencies.join(", ")
  }`,
);

console.log("Phase 6C wallet handoff checks passed.");
