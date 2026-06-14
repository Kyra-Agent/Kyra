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
const storageDraft = read("supabase/prepared_action_storage_schema_draft.sql");
const forwardReview = read("supabase/prepared_action_storage_forward_review.sql");
const rollbackReview = read("supabase/prepared_action_storage_rollback_review.sql");
const verifierReview = read("supabase/verify_prepared_action_storage_review.sql");
const schema = read("supabase/schema.sql");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const publicAgentService = read("src/services/supabasePublicAgentService.ts");
const baseMcpPrepareCore = read("supabase/functions/base-mcp-prepare/core.ts");
const baseMcpPrepareDependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const baseMcpPrepareStorageAdapter = read("supabase/functions/base-mcp-prepare/storage-adapter.ts");
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
assert(
  !schema.includes("public.prepared_actions"),
  "Prepared actions storage must remain unapplied in supabase/schema.sql.",
);
assert(
  storageDraft.includes("DRAFT ONLY - DO NOT APPLY."),
  "Prepared action storage draft must be marked do-not-apply.",
);
assert(
  storageDraft.split(/\r?\n/u).every((line) => !line.trim() || line.trim().startsWith("--")),
  "Prepared action storage draft must stay comment-only.",
);
assert(
  storageDraft.includes("prepared_actions_request_unique unique (workspace_id, agent_id, request_id)"),
  "Prepared action storage draft must define workspace/agent/request idempotency.",
);
assert(
  storageDraft.includes("public.prepared_action_owner_summaries"),
  "Prepared action storage draft must define an owner summary view boundary.",
);
assert(
  storageDraft.includes("public.public_agent_profiles must not join prepared_actions"),
  "Prepared action storage draft must keep public profiles isolated.",
);
assert(
  storageDraft.includes("telegram-webhook must not read or write prepared_actions"),
  "Prepared action storage draft must keep Telegram isolated.",
);
assertNoForbidden("prepared action storage draft", storageDraft, [
  "raw_provider_payload jsonb",
  "raw_calldata text",
  "wallet_address text",
  "private_key text",
  "seed_phrase text",
  "telegram_token_ref text",
  "telegram_bot_token text",
  "api_key text",
]);
assert(
  forwardReview.includes("REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL."),
  "Prepared action forward review must be marked do-not-apply.",
);
assert(
  rollbackReview.includes("REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL."),
  "Prepared action rollback review must be marked do-not-apply.",
);
assert(
  verifierReview.includes("REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION."),
  "Prepared action verifier must be marked as a verifier, not migration.",
);
assert(
  forwardReview.includes("create table public.prepared_actions"),
  "Prepared action forward review must create prepared_actions.",
);
assert(
  forwardReview.includes("create or replace view public.prepared_action_owner_summaries"),
  "Prepared action forward review must create owner summaries view.",
);
assert(
  forwardReview.includes("prepared_actions_request_unique"),
  "Prepared action forward review must define idempotency constraint.",
);
assert(
  forwardReview.includes("enable row level security"),
  "Prepared action forward review must enable RLS.",
);
assert(
  forwardReview.includes("grant select, insert, update on public.prepared_actions to service_role"),
  "Prepared action forward review must limit service_role prepared_actions grants.",
);
assert(
  !/\bgrant\s+.*\bdelete\b.*prepared_actions/iu.test(forwardReview),
  "Prepared action forward review must not grant delete on prepared_actions.",
);
assert(
  !/\bdrop\s+(?:table|view)\b[\s\S]*\bcascade\b/iu.test(rollbackReview),
  "Prepared action rollback review must not use DROP ... CASCADE.",
);
assert(
  rollbackReview.includes("public.prepared_actions contains rows"),
  "Prepared action rollback review must stop when rows exist.",
);
assert(
  verifierReview.includes("prepared_action_storage_excludes_forbidden_columns"),
  "Prepared action verifier must check forbidden column absence.",
);
assert(
  verifierReview.includes("anon_has_no_prepared_actions_privileges"),
  "Prepared action verifier must check anon privileges.",
);
assertNoForbidden("prepared action forward review", forwardReview, [
  "raw_provider_payload",
  "raw_calldata",
  "wallet_address",
  "private_key",
  "seed_phrase",
  "telegram_token_ref",
  "telegram_bot_token",
  "api_key",
  "tx_hash text",
]);

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
assert(
  baseMcpPrepareCore.includes("BaseMcpPreparedActionStorageInput"),
  "Base MCP prepare function must define a bounded storage input contract.",
);
assert(
  baseMcpPrepareCore.includes("createPreparedActionStorageInput"),
  "Base MCP prepare function must create storage input from sanitized preview summaries.",
);
assert(
  !baseMcpPrepareCore.includes("providerPayloadRef"),
  "Base MCP prepare storage input must not carry provider payload refs.",
);
assert(
  !baseMcpPrepareDependencies.includes("storePreparedActionSummary"),
  "Base MCP runtime dependencies must not wire prepared-action storage yet.",
);
assert(
  baseMcpPrepareStorageAdapter.includes('from("prepared_actions")'),
  "Base MCP storage adapter draft must target prepared_actions only.",
);
assert(
  baseMcpPrepareStorageAdapter.includes('onConflict: "workspace_id,agent_id,request_id"'),
  "Base MCP storage adapter draft must use the idempotency key.",
);
assert(
  baseMcpPrepareStorageAdapter.includes("provider_payload_ref: null"),
  "Base MCP storage adapter draft must not store provider payload refs.",
);
assertNoForbidden("Base MCP storage adapter draft", baseMcpPrepareStorageAdapter, [
  "raw_provider_payload",
  "raw_calldata",
  "wallet_address",
  "private_key",
  "seed_phrase",
  "telegram_token_ref",
  "telegram_bot_token",
  "api_key",
  "tx_hash",
]);

console.log("Prepared action boundary checks passed.");
