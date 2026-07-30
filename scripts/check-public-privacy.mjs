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
const supabaseConfig = read("supabase/config.toml");
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

assert(
  /create policy "Online demo agent instances are public readable"[\s\S]*?for select\s+to anon\s+using \(status = 'online' and mode = 'demo'\);/u
    .test(schema),
  "Public demo-agent table policy must apply only to anon; authenticated users must remain workspace-scoped.",
);
assert(
  schema.includes(
    "revoke all on function public.enforce_demo_agent_limit()\n  from public, anon, authenticated, service_role;",
  ) &&
    schema.includes(
      "revoke all on function public.owns_workspace(uuid)\n  from public, anon, authenticated, service_role;",
    ),
  "Security-definer workspace helpers must not retain default public execution privileges.",
);
for (const functionName of ["deploy-agent", "reset-demo-workspace"]) {
  assert(
    new RegExp(
      `\\[functions\\.${functionName}\\]\\s+verify_jwt\\s*=\\s*true`,
      "u",
    ).test(supabaseConfig),
    `${functionName} must explicitly require Supabase gateway JWT verification.`,
  );
}
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
assert(
  !publicAgentService.includes("isLocalDemoPreviewSlug") &&
    !publicAgentService.includes('endsWith("-demo")'),
  "Public agent service must not synthesize or special-case demo profile routes.",
);
assert(
  publicAgentService.includes('mode: "backend-connected"'),
  "Persisted public agent profiles must be labeled backend-connected.",
);
assert(
  publicAgentService.includes("function isPublicAgentProfileRow") &&
    publicAgentService.includes("selectPublicRows<unknown>") &&
    publicAgentService.includes("isPublicAgentProfileRow(rows[0], agentSlug)"),
  "Public agent profiles must pass runtime shape validation before rendering.",
);

const publicAgentPage = read("src/pages/PublicAgent.tsx");
assert(
  !publicAgentPage.includes("kyraDataService") &&
    !publicAgentPage.includes("selectedTemplate"),
  "Public agent pages must render only persisted, share-safe profile data.",
);

const dashboardService = read("src/services/supabaseDashboardService.ts");
const deployService = read("src/services/supabaseDeployService.ts");
const restClient = read("src/services/supabaseRestClient.ts");
assert(
  deployService.includes("function isDeployFunctionSuccessResponse") &&
    deployService.includes('"invalid_response"') &&
    deployService.includes("selectPublicRows") === false,
  "Deploy success must pass a strict runtime response contract.",
);
assert(
  !restClient.includes("throw new Error(text ||") &&
    restClient.includes("Supabase request failed with HTTP"),
  "Supabase REST failures must not carry raw backend response bodies.",
);
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

assert(
  /owner_user_id=eq\.\$\{\s*encodeURIComponent\(session\.user\.id\)/u
    .test(dashboardService),
  "Dashboard workspace discovery must explicitly filter by the signed-in owner.",
);
assert(
  /owner_user_id=eq\.\$\{\s*encodeURIComponent\(session\.user\.id\)/u
    .test(deployService),
  "Deploy workspace discovery must explicitly filter by the signed-in owner.",
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

const authService = read("src/services/supabaseAuthService.ts");
const rawErrorBoundaryServices = [
  "src/services/deployFunctionHealthService.ts",
  "src/services/supabaseDashboardService.ts",
  "src/services/supabaseDeployService.ts",
  "src/services/supabaseKyraRepository.ts",
  "src/services/supabasePublicAgentService.ts",
  "src/services/telegramConnectService.ts",
  "src/services/telegramDashboardStatusService.ts",
  "src/services/telegramDisconnectService.ts",
  "src/services/telegramLinkService.ts",
  "src/services/transactionIntentPrepareService.ts",
  "src/services/transactionResultCloseoutService.ts",
];
const genericEdgeFailureMessages = [
  ["supabase/functions/deploy-agent/index.ts", "Kyra could not deploy this agent safely."],
  ["supabase/functions/reset-demo-workspace/index.ts", "Kyra could not reset this workspace safely."],
  ["supabase/functions/telegram-connect/core.ts", "Kyra could not connect this Telegram bot safely."],
  ["supabase/functions/telegram-webhook/index.ts", "Kyra could not process this Telegram update safely."],
];
assert(
  authService.includes("function getSafeAuthProviderMessage") &&
    !authService.includes("function sanitizeAuthMessage"),
  "Authentication errors must pass through the reviewed provider-message allowlist.",
);
for (const path of rawErrorBoundaryServices) {
  const source = read(path);
  assert(
    !source.includes("payload.message ||") &&
      !source.includes("error.message ||") &&
      !source.includes("data.message ||"),
    `${path} must not use unreviewed backend error text as a public fallback.`,
  );
}
for (const [path, message] of genericEdgeFailureMessages) {
  assert(
    read(path).includes(message),
    `${path} must return a fixed generic message for unexpected failures.`,
  );
}
assert(
  read("src/App.tsx").includes("errorName: error.name") &&
    !read("src/App.tsx").includes("componentStack: info.componentStack"),
  "Route error logging must not emit raw errors or component stacks.",
);

const appPage = read("src/App.tsx");
const heroConsole = read("src/components/HeroConsole.tsx");
const authSessionPanel = read("src/components/AuthSessionPanel.tsx");
const dashboardPage = read("src/pages/Dashboard.tsx");
assert(
  !appPage.includes("operator-demo") &&
    !appPage.includes('targetSlug ?? `${nextTemplateId}-demo`'),
  "Application routing must not synthesize public demo-agent URLs.",
);
assert(
  !heroConsole.includes("setTimeout(onRequestApproval") &&
    heroConsole.includes('className="console-review-button"') &&
    heroConsole.includes("onClick={onRequestApproval}"),
  "Landing approval review must open only from an explicit user action.",
);
assert(
  dashboardPage.includes("Private account workspace") &&
    dashboardPage.includes("Public visitors can use the product pages and public agent profiles without seeing operational or wallet internals."),
  "Signed-out dashboard must show a public-safe private workspace notice.",
);
assert(
  dashboardPage.includes("!authSession ?") &&
    dashboardPage.includes("Transaction controls, release readiness, closeout records, and wallet details are visible only after account sign-in."),
  "Dashboard operational panels must stay behind an account session gate.",
);
assert(
  authSessionPanel.includes("Wallet connection is separate") &&
    authSessionPanel.includes("Wallet confirmation required") &&
    !authSessionPanel.includes("No wallet access"),
  "Account-session copy must not contradict a separate live wallet connection.",
);
assert(
  dashboardPage.includes("const canViewOperationalReadiness = isAdmin") &&
    dashboardPage.includes("{canViewOperationalReadiness") &&
    dashboardPage.includes("className=\"dashboard-panel backend-readiness-panel\"") &&
    dashboardPage.includes(
      'className={"dashboard-panel execution-result-panel" + (appConfig.chain.testnetEvidenceMode ? " is-robinhood-testnet" : "")}',
    ),
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
