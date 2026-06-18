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

function assertNotIncludes(sourceName, source, text) {
  assert(!source.includes(text), `${sourceName} must not include: ${text}`);
}

function assertRegex(sourceName, source, pattern, message) {
  assert(pattern.test(source), `${sourceName}: ${message}`);
}

const audit = read("docs/phase-7B-ownership-rls-write-path-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const schema = read("supabase/schema.sql");
const lockdownSql = read("supabase/lockdown_authenticated_demo_writes.sql");
const deployService = read("src/services/supabaseDeployService.ts");
const restClient = read("src/services/supabaseRestClient.ts");
const deployFunction = read("supabase/functions/deploy-agent/index.ts");
const resetFunction = read("supabase/functions/reset-demo-workspace/index.ts");
const preparedForward = read("supabase/prepared_action_storage_forward_review.sql");
const preparedRollback = read(
  "supabase/prepared_action_storage_rollback_review.sql",
);
const preparedVerifier = read("supabase/verify_prepared_action_storage_review.sql");
const packageJson = read("package.json");

for (
  const required of [
    "# Phase 7B Ownership, RLS, And Write Path Audit",
    "Status: audit packet started.",
    "## Sensitive Write Paths",
    "## Browser Boundary",
    "## RLS And Grant Rules",
    "## Frontend REST Fallback Decision",
    "## Prepared Action Storage Decision",
    "## Phase 7B Done Criteria",
    "User wallet security",
    "User Telegram bot token security",
  ]
) {
  assertIncludes("Phase 7B audit", audit, required);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "### 7B - Ownership, RLS, And Write Path Audit",
);
assertIncludes("package.json", packageJson, '"check:phase-7b"');
assertIncludes("package.json", packageJson, '"check:phase-7"');

for (
  const table of [
    "workspaces",
    "agent_templates",
    "agent_instances",
    "wallet_policies",
    "approval_requests",
    "activity_logs",
    "telegram_sessions",
    "telegram_bot_token_secrets",
    "telegram_webhook_secrets",
    "telegram_chat_authorizations",
    "telegram_processed_updates",
    "telegram_owner_link_challenges",
    "telegram_owner_link_consume_rate_limits",
  ]
) {
  assertIncludes(
    "schema",
    schema,
    `alter table public.${table} enable row level security;`,
  );
}

for (
  const policy of [
    'create policy "Users can read their own workspaces"',
    'create policy "Workspace owners can read agent instances"',
    'create policy "Workspace owners can read wallet policies"',
    'create policy "Workspace owners can read approval requests"',
    'create policy "Workspace owners can read activity logs"',
    'create policy "Workspace owners can read telegram sessions"',
  ]
) {
  assertIncludes("schema", schema, policy);
}

for (
  const table of [
    "workspaces",
    "agent_instances",
    "wallet_policies",
    "approval_requests",
    "activity_logs",
    "telegram_sessions",
  ]
) {
  assertIncludes(
    "schema",
    schema,
    `revoke all privileges on public.${table} from authenticated;`,
  );
  assertIncludes(
    "lockdown SQL",
    lockdownSql,
    `revoke all privileges on public.${table} from authenticated;`,
  );
}

assertRegex(
  "schema",
  schema,
  /grant\s+select\s+on\s+public\.workspaces\s+to\s+authenticated;/u,
  "authenticated workspaces grant must be select-only",
);
assertRegex(
  "schema",
  schema,
  /grant\s+select\s+on\s+public\.wallet_policies\s+to\s+authenticated;/u,
  "authenticated wallet_policies grant must be select-only",
);
assertRegex(
  "schema",
  schema,
  /grant\s+select\s+on\s+public\.approval_requests\s+to\s+authenticated;/u,
  "authenticated approval_requests grant must be select-only",
);
assertRegex(
  "schema",
  schema,
  /grant\s+select\s+on\s+public\.activity_logs\s+to\s+authenticated;/u,
  "authenticated activity_logs grant must be select-only",
);

assert(
  !/grant\s+(?:insert|update|delete|all)[^;]*\bto\s+authenticated\b/iu.test(
    schema,
  ),
  "schema must not grant authenticated insert/update/delete/all privileges.",
);
assert(
  !/grant\s+(?:insert|update|delete|all)[^;]*\bto\s+authenticated\b/iu.test(
    lockdownSql,
  ),
  "lockdown SQL must not grant authenticated insert/update/delete/all privileges.",
);

assertIncludes(
  "schema",
  schema,
  "revoke all privileges on public.telegram_bot_token_secrets from public, anon, authenticated, service_role;",
);
assertIncludes(
  "schema",
  schema,
  "revoke all privileges on public.telegram_webhook_secrets from public, anon, authenticated, service_role;",
);
assertIncludes(
  "schema",
  schema,
  "grant select on public.public_agent_profiles to anon, authenticated;",
);
assertIncludes(
  "schema",
  schema,
  "grant select on public.agent_templates to anon, authenticated, service_role;",
);
assertNotIncludes(
  "schema",
  schema,
  "create table if not exists public.prepared_actions",
);

assertIncludes(
  "lockdown SQL",
  lockdownSql,
  "preventing browser/manual REST writes with the authenticated role",
);
assertIncludes(
  "lockdown SQL",
  lockdownSql,
  "Demo",
);
assertIncludes(
  "lockdown SQL",
  lockdownSql,
  "deploy and reset writes must use Supabase Edge Functions with service_role.",
);

assertIncludes(
  "supabaseDeployService",
  deployService,
  "async function saveViaDeployFunction",
);
assertIncludes(
  "supabaseDeployService",
  deployService,
  "function canUseRestDeployFallback()",
);
assertIncludes(
  "supabaseDeployService",
  deployService,
  "return import.meta.env.DEV;",
);
assertIncludes(
  "supabaseDeployService",
  deployService,
  "source: \"edge-function\"",
);
assertIncludes("supabaseRestClient", restClient, "method: \"POST\"");
assertIncludes("supabaseRestClient", restClient, "method: \"PATCH\"");

assertIncludes("deploy-agent function", deployFunction, "auth.getUser()");
assertIncludes("deploy-agent function", deployFunction, "SUPABASE_SERVICE_ROLE_KEY");
assertIncludes("deploy-agent function", deployFunction, ".from(\"workspaces\")");
assertIncludes("deploy-agent function", deployFunction, ".from(\"agent_instances\")");
assertIncludes("deploy-agent function", deployFunction, ".from(\"wallet_policies\")");
assertIncludes("deploy-agent function", deployFunction, ".from(\"approval_requests\")");
assertIncludes("deploy-agent function", deployFunction, ".from(\"activity_logs\")");
assertIncludes(
  "deploy-agent function",
  deployFunction,
  "sanitizeActivityLogMessage(log.message)",
);

assertIncludes("reset-demo-workspace function", resetFunction, "auth.getUser()");
assertIncludes(
  "reset-demo-workspace function",
  resetFunction,
  "data.user.app_metadata?.role !== \"admin\"",
);
assertIncludes(
  "reset-demo-workspace function",
  resetFunction,
  "SUPABASE_SERVICE_ROLE_KEY",
);
assertIncludes("reset-demo-workspace function", resetFunction, ".delete()");
assertIncludes("reset-demo-workspace function", resetFunction, ".eq(\"owner_user_id\", user.id)");

for (
  const reviewFile of [
    ["prepared-action forward SQL", preparedForward, "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL."],
    ["prepared-action rollback SQL", preparedRollback, "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL."],
    ["prepared-action verifier SQL", preparedVerifier, "REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION."],
  ]
) {
  assertIncludes(reviewFile[0], reviewFile[1], reviewFile[2]);
}
assertIncludes(
  "prepared-action rollback SQL",
  preparedRollback,
  "rollback scope, target project, forward review, verifier expectations",
);

assertIncludes(
  "prepared-action verifier SQL",
  preparedVerifier,
  "returns booleans only",
);

console.log("Phase 7B ownership/RLS checks passed.");
