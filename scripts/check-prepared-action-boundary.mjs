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

function listFiles(path) {
  const absolutePath = resolve(root, path);
  const entries = readdirSync(absolutePath);
  const files = [];

  for (const entry of entries) {
    const child = `${path}/${entry}`;
    const absoluteChild = resolve(root, child);
    const stats = statSync(absoluteChild);

    if (stats.isDirectory()) {
      files.push(...listFiles(child));
      continue;
    }

    if (stats.isFile()) {
      files.push(child);
    }
  }

  return files;
}

function assertNoForbidden(sourceName, source, forbiddenTerms) {
  const lower = source.toLowerCase();
  const hits = forbiddenTerms.filter((term) => lower.includes(term.toLowerCase()));

  assert(hits.length === 0, `${sourceName} exposes forbidden terms: ${hits.join(", ")}`);
}

const preparedActionTypes = read("src/types/preparedAction.ts");
const readModelDoc = read("docs/phase-6B-prepared-action-read-model.md");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const publicAgentService = read("src/services/supabasePublicAgentService.ts");
const publicProfileFiles = [
  "src/pages/PublicAgent.tsx",
  "src/services/supabasePublicAgentService.ts",
];
const telegramWebhookFiles = listFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.(ts|tsx)$/u.test(path));

assert(
  preparedActionTypes.includes('preparedActionAllowedKinds = ["base_mcp_status_check"] as const'),
  "Prepared action allowlist must start with base_mcp_status_check only.",
);
assert(
  preparedActionTypes.includes("PreparedActionOwnerSummary"),
  "Prepared action owner summary contract is required.",
);
assert(
  preparedActionTypes.includes("PreparedActionPrivateStorageDraft"),
  "Prepared action private storage draft is required.",
);
assert(
  preparedActionTypes.includes("rawProviderPayloadEncrypted?: never"),
  "Prepared action type must forbid raw provider payload in browser-safe code.",
);
assert(
  preparedActionTypes.includes("walletAddress?: never"),
  "Prepared action type must forbid wallet address in prepared-action storage draft.",
);
assert(
  preparedActionTypes.includes("telegramTokenRef?: never"),
  "Prepared action type must forbid Telegram token refs in prepared-action storage draft.",
);
assert(
  readModelDoc.includes("Phase 6B does not use `approval_requests.prepared_tx` as a browser read model."),
  "Prepared action read-model doc must keep prepared_tx out of browser reads.",
);
assert(
  readModelDoc.includes("Telegram remains read-only."),
  "Prepared action read-model doc must keep Telegram read-only.",
);

const approvalRequestQuery = dashboardService.match(/approval_requests\?select=([^`"]+)/);
assert(approvalRequestQuery, "Missing approval_requests dashboard query.");
assertNoForbidden("dashboard approval request query", approvalRequestQuery[1], [
  "prepared_tx",
  "tx_hash",
  "provider_payload",
  "calldata",
  "telegram_token",
]);

for (const path of publicProfileFiles) {
  assertNoForbidden(path, read(path), [
    "prepared_tx",
    "tx_hash",
    "PreparedActionOwnerSummary",
    "providerPayloadRef",
  ]);
}

for (const path of telegramWebhookFiles) {
  assertNoForbidden(path, read(path), [
    "PreparedActionOwnerSummary",
    "providerPayloadRef",
    "prepared_tx",
    "tx_hash",
  ]);
}

assert(
  publicAgentService.includes("public_agent_profiles?select=*"),
  "Public agent service must stay on share-safe public_agent_profiles.",
);

console.log("Prepared action boundary checks passed.");
