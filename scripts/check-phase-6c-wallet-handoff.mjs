import { readFileSync } from "node:fs";
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

const audit = read("docs/phase-6C-wallet-signing-handoff-audit.md");
const plan = read("docs/phase-6C-wallet-signing-handoff-plan.md");
const checklist = read("docs/phase-6-wallet-base-checklist.md");
const appConfig = read("src/config/appConfig.ts");
const packageJson = read("package.json");
const walletModal = read("src/components/WalletApprovalModal.tsx");
const dashboardService = read("src/services/supabaseDashboardService.ts");

for (const boundary of [
  "No wallet provider, wallet prompt, signature,",
  "no seed phrase path",
  "no private key path",
  "no hidden signing",
  "no Telegram-triggered signing or submission",
  "Do not implement live signing yet.",
]) {
  assertIncludes("Phase 6C audit", audit, boundary);
}

for (const boundary of [
  "Status: plan only. No live signing is enabled.",
  "The first signable action must not be `base_mcp_status_check`.",
  "wallet_prompt_requested` requires an owner click.",
  "User rejection does not create `tx_hash`.",
  "Telegram execution request remains refused.",
]) {
  assertIncludes("Phase 6C plan", plan, boundary);
}

assertIncludes("Phase 6 checklist", checklist, "docs/phase-6C-wallet-signing-handoff-audit.md");
assertIncludes("Phase 6 checklist", checklist, "docs/phase-6C-wallet-signing-handoff-plan.md");
assertIncludes("Phase 6 checklist", checklist, "Audit current signing/wallet handoff surface.");
assertIncludes("package.json", packageJson, "\"check:phase-6c\"");
assertIncludes("appConfig", appConfig, 'walletExecution: "disabled"');
assertIncludes("WalletApprovalModal", walletModal, "Approve Demo");
assertIncludes("WalletApprovalModal", walletModal, "Demo only");
assert(
  !dashboardService.includes("prepared_tx") && !dashboardService.includes("tx_hash"),
  "Dashboard service must keep prepared_tx and tx_hash out of owner reads before 6C implementation.",
);
assert(
  !packageJson.includes("wagmi") &&
    !packageJson.includes("viem") &&
    !packageJson.includes("ethers") &&
    !packageJson.includes("@coinbase/wallet-sdk"),
  "Wallet provider dependencies must not be added before the provider decision record.",
);

console.log("Phase 6C wallet handoff checks passed.");
