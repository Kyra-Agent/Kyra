import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function getSqlView(sql, viewName) {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+view\\s+public\\.${viewName}[\\s\\S]*?(?=\\n\\s*(?:grant|revoke|create\\s+or\\s+replace\\s+view|alter\\s+table|$))`,
    "i",
  );
  const match = sql.match(pattern);

  assert(match, `Missing public.${viewName} view definition.`);
  return match[0];
}

function assertNoForbidden(sourceName, source, forbiddenTerms) {
  const lower = source.toLowerCase();
  const hits = forbiddenTerms.filter((term) => lower.includes(term.toLowerCase()));

  assert(hits.length === 0, `${sourceName} exposes forbidden terms: ${hits.join(", ")}`);
}

const forbiddenPublicProfileTerms = [
  "wallet_address",
  "wallet_policies",
  "approval_requests",
  "prepared_actions",
  "prepared_tx",
  "tx_hash",
  "token_secret_ref",
  "telegram_bot_token",
  "telegram_bot_token_secrets",
  "telegram_webhook_secrets",
];

const schema = read("supabase/schema.sql");
const publicAgentProfilesView = getSqlView(schema, "public_agent_profiles");
const telegramSessionSummariesView = getSqlView(schema, "telegram_session_summaries");

assertNoForbidden(
  "public.public_agent_profiles",
  publicAgentProfilesView,
  forbiddenPublicProfileTerms,
);
assertNoForbidden("public.telegram_session_summaries", telegramSessionSummariesView, [
  "token_secret_ref",
  "owner_user_id",
  "workspace_id",
  "telegram_bot_token",
  "vault_secret_id",
]);

const publicAgentService = read("src/services/supabasePublicAgentService.ts");
assert(
  publicAgentService.includes("public_agent_profiles?select=*"),
  "Public agent service must read from the share-safe public_agent_profiles view.",
);
assertNoForbidden(
  "supabasePublicAgentService",
  publicAgentService,
  forbiddenPublicProfileTerms,
);

const dashboardService = read("src/services/supabaseDashboardService.ts");
assert(
  !dashboardService.includes("wallet_policies?select=*"),
  "Dashboard wallet policy reads must not use select=*.",
);
assert(
  !dashboardService.includes("approval_requests?select=*"),
  "Dashboard approval request reads must not use select=*.",
);

const walletPolicyQuery = dashboardService.match(/wallet_policies\?select=([^`"]+)/);
assert(walletPolicyQuery, "Missing wallet_policies dashboard query.");
assertNoForbidden("dashboard wallet policy query", walletPolicyQuery[1], [
  "prepared_tx",
  "tx_hash",
  "token_secret_ref",
  "telegram_bot_token",
]);

const approvalRequestQuery = dashboardService.match(/approval_requests\?select=([^`"]+)/);
assert(approvalRequestQuery, "Missing approval_requests dashboard query.");
assertNoForbidden("dashboard approval request query", approvalRequestQuery[1], [
  "prepared_tx",
  "tx_hash",
  "token_secret_ref",
  "telegram_bot_token",
]);

console.log("Public privacy checks passed.");
