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

function assertNoForbidden(sourceName, source, forbiddenTerms) {
  const lower = source.toLowerCase();
  const hits = forbiddenTerms.filter((term) =>
    lower.includes(term.toLowerCase())
  );

  assert(
    hits.length === 0,
    `${sourceName} exposes forbidden terms: ${hits.join(", ")}`,
  );
}

function assertFilesDoNotInclude(paths, forbiddenPattern, message) {
  for (const path of paths) {
    assert(!forbiddenPattern.test(read(path)), `${message}: ${path}`);
  }
}

const audit = read("docs/phase-7D-prepared-action-storage-approval.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const draft = read("supabase/prepared_action_storage_schema_draft.sql");
const forward = read("supabase/prepared_action_storage_forward_review.sql");
const rollback = read("supabase/prepared_action_storage_rollback_review.sql");
const verifier = read("supabase/verify_prepared_action_storage_review.sql");
const schema = read("supabase/schema.sql");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const storageAdapter = read("supabase/functions/base-mcp-prepare/storage-adapter.ts");
const storageAdapterTest = read("supabase/functions/base-mcp-prepare/storage-adapter_test.ts");
const preparedActionTypes = read("src/types/preparedAction.ts");
const publicFiles = [
  "src/pages/PublicAgent.tsx",
  "src/services/supabasePublicAgentService.ts",
];
const frontendFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const required of [
    "# Phase 7D Prepared Action Storage Approval",
    "Status: approval packet started.",
    "## Approved Storage Scope",
    "## Forbidden Storage Scope",
    "## Forward SQL Approval Rules",
    "## Rollback Approval Rules",
    "## Verifier Approval Rules",
    "## Runtime Storage Rules",
    "## Phase 7D Done Criteria",
    "Prepared-action storage is not live.",
    "Runtime dependencies do not wire `storePreparedActionSummary`.",
  ]
) {
  assertIncludes("Phase 7D audit", audit, required);
}

for (
  const forbidden of [
    "raw provider payloads",
    "raw calldata",
    "wallet addresses",
    "private keys",
    "seed phrases",
    "Telegram token refs",
    "Telegram bot tokens",
    "API keys",
    "transaction hashes",
  ]
) {
  assertIncludes("Phase 7D audit forbidden scope", audit, forbidden);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7D-prepared-action-storage-approval.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7d`");
assertIncludes("package.json", packageJson, '"check:phase-7d"');
assertIncludes("package.json", packageJson, "npm run check:phase-7d");

assertIncludes("draft SQL", draft, "DRAFT ONLY - DO NOT APPLY.");
assert(
  draft.split(/\r?\n/u).every((line) =>
    !line.trim() || line.trim().startsWith("--")
  ),
  "Prepared-action schema draft must remain comment-only.",
);
assertIncludes(
  "draft SQL",
  draft,
  "prepared_actions_request_unique unique (workspace_id, agent_id, request_id)",
);
assertIncludes("draft SQL", draft, "public.prepared_action_owner_summaries");
assertIncludes(
  "draft SQL",
  draft,
  "grant select, insert, and update on public.prepared_actions to service_role",
);
assertNotIncludes("draft SQL", draft, "grant all on public.prepared_actions");

assertIncludes(
  "forward SQL",
  forward,
  "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.",
);
assertIncludes("forward SQL", forward, "create table public.prepared_actions");
assertIncludes(
  "forward SQL",
  forward,
  "create or replace view public.prepared_action_owner_summaries",
);
assertIncludes("forward SQL", forward, "with (security_invoker = true)");
assertIncludes("forward SQL", forward, "enable row level security");
assertIncludes("forward SQL", forward, "public.owns_workspace(workspace_id)");
assertIncludes("forward SQL", forward, "prepared_actions_request_unique");
assertIncludes("forward SQL", forward, "unique (workspace_id, agent_id, request_id)");
assertIncludes("forward SQL", forward, "check (action_kind in ('base_mcp_status_check'))");
assertIncludes("forward SQL", forward, "check (chain in ('base'))");
assertIncludes("forward SQL", forward, "provider_payload_ref is null");
assertIncludes("forward SQL", forward, "grant select (\n  id,");
assertIncludes("forward SQL", forward, ") on public.prepared_actions to authenticated");
assertIncludes(
  "forward SQL",
  forward,
  "grant select, insert, update on public.prepared_actions to service_role",
);
assertNotIncludes("forward SQL", forward, "grant select on public.prepared_actions to authenticated");
assertNotIncludes("forward SQL", forward, "grant all on public.prepared_actions");
assert(
  !/\bgrant\s+.*\bdelete\b.*prepared_actions/iu.test(forward),
  "Forward SQL must not grant delete on prepared_actions.",
);
assertNoForbidden("forward SQL", forward, [
  "raw_provider_payload",
  "raw_calldata",
  "wallet_address",
  "private_key",
  "seed_phrase",
  "telegram_token_ref",
  "telegram_bot_token",
  "api_key text",
  "tx_hash text",
]);

assertIncludes(
  "rollback SQL",
  rollback,
  "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.",
);
assertIncludes("rollback SQL", rollback, "public.prepared_actions contains rows");
assertIncludes("rollback SQL", rollback, "drop view public.prepared_action_owner_summaries");
assertIncludes("rollback SQL", rollback, "drop table public.prepared_actions");
assert(
  !/\bdrop\s+(?:table|view)\b[\s\S]*\bcascade\b/iu.test(rollback),
  "Rollback SQL must not use DROP ... CASCADE.",
);
assertNotIncludes("rollback SQL", rollback, "delete from public.prepared_actions");

assertIncludes(
  "verifier SQL",
  verifier,
  "REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION.",
);
for (
  const signal of [
    "prepared_actions_table_exists",
    "prepared_action_owner_summaries_view_exists",
    "prepared_actions_rls_enabled",
    "prepared_actions_owner_select_policy_present",
    "owner_summary_view_has_expected_columns",
    "prepared_action_storage_excludes_forbidden_columns",
    "prepared_actions_request_unique_is_expected",
    "prepared_actions_action_kind_check_is_expected",
    "anon_has_no_prepared_actions_privileges",
    "authenticated_prepared_actions_privileges_are_expected",
    "service_role_prepared_actions_privileges_are_expected",
  ]
) {
  assertIncludes("verifier SQL", verifier, signal);
}
assertNotIncludes("verifier SQL", verifier, "select *");

assertNotIncludes("schema", schema, "create table public.prepared_actions");
assertNotIncludes("schema", schema, "public.prepared_action_owner_summaries");
assertNotIncludes("dependencies", dependencies, "storePreparedActionSummary");
assertIncludes("storage adapter", storageAdapter, 'from("prepared_actions")');
assertIncludes(
  "storage adapter",
  storageAdapter,
  'onConflict: "workspace_id,agent_id,request_id"',
);
assertIncludes("storage adapter", storageAdapter, "provider_payload_ref: null");
assertIncludes(
  "storage adapter",
  storageAdapter,
  "No wallet prompt, no signing, no transaction submission.",
);
assertIncludes(
  "storage adapter test",
  storageAdapterTest,
  "prepared action storage row maps only bounded Base MCP preview fields",
);
assertIncludes(
  "prepared action types",
  preparedActionTypes,
  'preparedActionAllowedKinds = ["base_mcp_status_check"] as const',
);
assertIncludes(
  "prepared action types",
  preparedActionTypes,
  "providerPayloadRef: string | null;",
);
assertIncludes(
  "prepared action types",
  preparedActionTypes,
  "rawProviderPayloadEncrypted?: never",
);
assertIncludes("prepared action types", preparedActionTypes, "walletAddress?: never");
assertIncludes("prepared action types", preparedActionTypes, "telegramTokenRef?: never");

for (const path of publicFiles) {
  assertNoForbidden(path, read(path), [
    "PreparedActionOwnerSummary",
    "providerPayloadRef",
    "prepared_tx",
    "tx_hash",
  ]);
}

assertFilesDoNotInclude(
  frontendFiles,
  /KYRA_BASE_MCP|SUPABASE_SERVICE_ROLE_KEY|telegram_bot_token/u,
  "Frontend must not reference backend secrets",
);
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /prepared_action_owner_summaries|storePreparedActionSummary|createPreparedActionStorageAdapter/u,
  "Telegram runtime must not read or write prepared-action storage",
);

console.log("Phase 7D prepared-action storage checks passed.");
