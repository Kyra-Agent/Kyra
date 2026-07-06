import { readdirSync, readFileSync, statSync } from "node:fs";
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
  const hits = forbiddenTerms.filter((term) =>
    lower.includes(term.toLowerCase())
  );

  assert(
    hits.length === 0,
    `${sourceName} exposes forbidden terms: ${hits.join(", ")}`,
  );
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

function assertNoRawSecretPatterns(sourceName, source) {
  const rawSecretPatterns = [
    {
      name: "OpenRouter API key",
      pattern: /sk-or-v1-[A-Za-z0-9]{32,}/,
    },
    {
      name: "Telegram bot token",
      pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35,}\b/,
    },
    {
      name: "private key PEM block",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    },
    {
      name: "raw 32-byte private key",
      pattern: /\b0x[a-fA-F0-9]{64}\b/,
    },
  ];
  const hits = rawSecretPatterns
    .filter(({ pattern }) => pattern.test(source))
    .map(({ name }) => name);

  assert(
    hits.length === 0,
    `${sourceName} contains raw secret-looking values: ${hits.join(", ")}`,
  );
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

const publicSourceFiles = [
  "README.md",
  ...walkFiles("docs"),
  ...walkFiles("public"),
  ...walkFiles("src"),
].filter((path) => /\.(?:css|html|js|json|md|svg|ts|tsx)$/.test(path));
const edgeFunctionRuntimeFiles = walkFiles("supabase/functions").filter(
  (path) => /\.ts$/.test(path) && !path.endsWith("_test.ts"),
);

for (const path of publicSourceFiles) {
  assertNoRawSecretPatterns(path, read(path));
}

for (const path of edgeFunctionRuntimeFiles) {
  const source = read(path);

  assertNoRawSecretPatterns(path, source);
  assert(
    !/\bconsole\.(?:debug|error|info|log|trace|warn)\s*\(/.test(source),
    `${path} must not log from runtime Edge Function code without a reviewed sanitizer.`,
  );
}

const envExample = read(".env.example");
assertNoForbidden(".env.example", envExample, [
  "SERVICE_ROLE",
  "PRIVATE_KEY",
  "BOT_TOKEN",
  "OPENROUTER_API_KEY",
  "AGENT_BRAIN_API_KEY",
]);

const schema = read("supabase/schema.sql");
const publicAgentProfilesView = getSqlView(schema, "public_agent_profiles");
const telegramSessionSummariesView = getSqlView(
  schema,
  "telegram_session_summaries",
);

assertNoForbidden(
  "public.public_agent_profiles",
  publicAgentProfilesView,
  forbiddenPublicProfileTerms,
);
assertNoForbidden(
  "public.telegram_session_summaries",
  telegramSessionSummariesView,
  [
    "token_secret_ref",
    "owner_user_id",
    "workspace_id",
    "telegram_bot_token",
    "vault_secret_id",
  ],
);

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
const deployAgentFunction = read("supabase/functions/deploy-agent/index.ts");
assert(
  !dashboardService.includes("agent_instances?select=*"),
  "Dashboard agent instance reads must not use select=*.",
);
assert(
  !dashboardService.includes("activity_logs?select=*"),
  "Dashboard activity log reads must not use select=*.",
);
assert(
  !dashboardService.includes("wallet_policies?select=*"),
  "Dashboard wallet policy reads must not use select=*.",
);
assert(
  !dashboardService.includes("approval_requests?select=*"),
  "Dashboard approval request reads must not use select=*.",
);

const walletPolicyQuery = dashboardService.match(
  /wallet_policies\?select=([^`"]+)/,
);
assert(walletPolicyQuery, "Missing wallet_policies dashboard query.");
assertNoForbidden("dashboard wallet policy query", walletPolicyQuery[1], [
  "prepared_tx",
  "tx_hash",
  "token_secret_ref",
  "telegram_bot_token",
]);

const approvalRequestQuery = dashboardService.match(
  /approval_requests\?select=([^`"]+)/,
);
assert(approvalRequestQuery, "Missing approval_requests dashboard query.");
assertNoForbidden("dashboard approval request query", approvalRequestQuery[1], [
  "prepared_tx",
  "tx_hash",
  "token_secret_ref",
  "telegram_bot_token",
]);

assert(
  dashboardService.includes("function sanitizeActivityLogMessage") &&
    dashboardService.includes("message: sanitizeActivityLogMessage(row.message)"),
  "Dashboard activity log messages must be sanitized before display.",
);
assert(
  deployAgentFunction.includes("function sanitizeActivityLogMessage") &&
    deployAgentFunction.includes("message: sanitizeActivityLogMessage(log.message)"),
  "Deploy activity log messages must be sanitized before insert.",
);
assert(
  /operator:\s*\{[\s\S]*?id:\s*"swap"[\s\S]*?approvalRequired:\s*true/u
    .test(deployAgentFunction),
  "Operator swap deploy scenario must remain approval-required.",
);


const appPage = read("src/App.tsx");
const dashboardPage = read("src/pages/Dashboard.tsx");
assert(
  dashboardPage.includes("Private owner workspace") &&
    dashboardPage.includes("Public visitors can use the product pages and public agent profiles without seeing operational or wallet internals."),
  "Signed-out dashboard must show a public-safe private workspace notice.",
);
assert(
  dashboardPage.includes("!authSession ?") &&
    dashboardPage.includes("Transaction controls, release readiness, closeout records, and wallet details are visible only after owner sign-in."),
  "Dashboard operational panels must stay behind an owner session gate.",
);
assert(
  dashboardPage.includes("const canViewOperationalReadiness = isAdmin") &&
    dashboardPage.includes("{canViewOperationalReadiness") &&
    dashboardPage.includes("className=\"dashboard-panel backend-readiness-panel\"") &&
    dashboardPage.includes("className=\"dashboard-panel execution-result-panel\""),
  "Dashboard phase/readiness operations must render only for owner/admin readiness access.",
);
assert(
  dashboardPage.includes("dashboard-auth-page") &&
    dashboardPage.includes("Sign in to Kyra Console") &&
    dashboardPage.includes("Public visitors do not see dashboard records"),
  "Signed-out auth route must render a focused account page instead of dashboard operations.",
);
assert(
  appPage.includes("function pushAppPath") &&
    appPage.includes("window.history.pushState") &&
    appPage.includes("window.dispatchEvent(new PopStateEvent"),
  "Programmatic navigation must dispatch route sync so dashboard auth state follows the URL.",
);
assert(
  dashboardPage.includes("function openDashboardSection") &&
    dashboardPage.includes("window.dispatchEvent(new PopStateEvent"),
  "Dashboard section navigation must dispatch route sync for mounted route state.",
);
console.log("Public privacy checks passed.");
