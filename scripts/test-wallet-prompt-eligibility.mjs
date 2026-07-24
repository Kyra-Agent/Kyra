import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/types/walletPromptEligibility.ts");
const outDir = resolve(root, ".tmp-wallet-prompt-eligibility-test");
const outputPath = resolve(outDir, "walletPromptEligibility.mjs");

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

mkdirSync(outDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8")
  .replace(/import\s+\{\s*productChainId\s*\}\s+from\s+"\.\/unsignedTransactionHandoff";/u, "const productChainId = 4663;");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluateWalletPromptEligibility,
    getWalletPromptBlockMessage,
    isForbiddenWalletPromptSource,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const eligibleInput = {
    walletExecutionEnabled: true,
    promptSource: "owner_dashboard_click",
    ownerSignedIn: true,
    privateDashboard: true,
    selectedAgent: true,
    ownerWalletConnected: true,
    chainId: 4663,
    preparedActionReviewed: true,
    riskReviewReady: true,
    ownerApprovalRecorded: true,
    handoffValid: true,
    handoffExpired: false,
  };

  const eligible = evaluateWalletPromptEligibility(eligibleInput);
  assert(eligible.eligible, "Fully reviewed owner dashboard prompt should pass.");
  assertEquals(eligible.reasons.length, 0);

  const disabled = evaluateWalletPromptEligibility({
    ...eligibleInput,
    walletExecutionEnabled: false,
  });
  assert(!disabled.eligible, "Disabled runtime gate must fail.");
  assert(
    disabled.reasons.includes("wallet_execution_disabled"),
    "Disabled runtime gate reason must be visible.",
  );

  const telegram = evaluateWalletPromptEligibility({
    ...eligibleInput,
    promptSource: "telegram_message",
  });
  assert(!telegram.eligible, "Telegram must not open wallet prompts.");
  assert(
    telegram.reasons.includes("forbidden_prompt_source"),
    "Forbidden source reason must be visible.",
  );

  const wrongNetwork = evaluateWalletPromptEligibility({
    ...eligibleInput,
    chainId: 1,
  });
  assert(!wrongNetwork.eligible, "Unsupported network must fail.");
  assert(
    wrongNetwork.reasons.includes("product_network_required"),
    "Product network reason must be visible.",
  );

  const missingReview = evaluateWalletPromptEligibility({
    ...eligibleInput,
    preparedActionReviewed: false,
    riskReviewReady: false,
    ownerApprovalRecorded: false,
  });
  assert(!missingReview.eligible, "Prompt must require reviews and owner approval.");
  assert(
    missingReview.reasons.includes("reviewed_prepared_action_required"),
    "Prepared action review reason must be visible.",
  );
  assert(
    missingReview.reasons.includes("risk_review_required"),
    "Risk review reason must be visible.",
  );
  assert(
    missingReview.reasons.includes("owner_approval_required"),
    "Owner approval reason must be visible.",
  );

  assert(
    isForbiddenWalletPromptSource("public_agent_page"),
    "Public agent pages must be forbidden prompt sources.",
  );
  assert(
    !isForbiddenWalletPromptSource("owner_dashboard_click"),
    "Owner dashboard click must be the only allowed prompt source.",
  );
  assertEquals(
    getWalletPromptBlockMessage("wallet_execution_disabled"),
    "Wallet signing is still disabled by the runtime gate.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Wallet prompt eligibility checks passed.");
