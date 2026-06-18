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

function assertNoRawSecretPatterns(sourceName, source) {
  const rawSecretPatterns = [
    {
      name: "OpenRouter API key",
      pattern: /sk-or-v1-[A-Za-z0-9_-]{32,}/u,
    },
    {
      name: "Telegram bot token",
      pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35,}\b/u,
    },
    {
      name: "private key PEM block",
      pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/u,
    },
    {
      name: "raw 32-byte private key",
      pattern: /\b0x[a-fA-F0-9]{64}\b/u,
    },
    {
      name: "Supabase secret key",
      pattern: /sb_secret_[A-Za-z0-9_-]{24,}/u,
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

function assertFilesDoNotMatch(paths, forbiddenPattern, message) {
  for (const path of paths) {
    assert(!forbiddenPattern.test(read(path)), `${message}: ${path}`);
  }
}

const audit = read("docs/phase-7G-logs-errors-observability-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const publicPrivacyCheck = read("scripts/check-public-privacy.mjs");
const backendObservability = read("src/services/backendObservabilityService.ts");
const supabaseRestClient = read("src/services/supabaseRestClient.ts");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const deployService = read("src/services/supabaseDeployService.ts");
const deployAgentFunction = read("supabase/functions/deploy-agent/index.ts");
const resetFunction = read("supabase/functions/reset-demo-workspace/index.ts");
const telegramConnectCore = read("supabase/functions/telegram-connect/core.ts");
const telegramWebhookCore = read("supabase/functions/telegram-webhook/core.ts");
const telegramResponseDelivery = read("supabase/functions/telegram-webhook/response-delivery.ts");
const telegramTokenResolver = read("supabase/functions/telegram-webhook/token-resolver.ts");
const telegramAgentBrainProvider = read("supabase/functions/telegram-webhook/agent-brain-provider.ts");
const baseMcpCore = read("supabase/functions/base-mcp-prepare/core.ts");
const baseMcpProviderAdapter = read("supabase/functions/base-mcp-prepare/provider-adapter.ts");
const baseMcpTypes = read("src/types/baseMcp.ts");
const walletSigning = read("src/types/walletSigning.ts");
const executionResult = read("src/types/executionResult.ts");

const edgeFunctionRuntimeFiles = walkFiles("supabase/functions").filter(
  (path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"),
);
const publicAndRuntimeFiles = [
  "README.md",
  ...walkFiles("docs"),
  ...walkFiles("public"),
  ...walkFiles("src"),
  ...edgeFunctionRuntimeFiles,
].filter((path) => /\.(?:css|html|js|json|md|svg|ts|tsx)$/u.test(path));

for (
  const required of [
    "# Phase 7G Logs, Errors, And Observability Audit",
    "Status: audit packet started.",
    "## Crown-Jewel Log Boundary",
    "## Runtime Logging Rules",
    "## User-Facing Error Rules",
    "## Activity Log Rules",
    "## Observability Rules",
    "## Phase 7G Done Criteria",
    "Runtime Edge Function source has no raw `console.*` logging.",
    "No execution capability is enabled by this audit.",
  ]
) {
  assertIncludes("Phase 7G audit", audit, required);
}

for (
  const boundary of [
    "Telegram bot tokens",
    "Telegram webhook secret tokens",
    "wallet private keys",
    "raw signing payloads",
    "raw calldata",
    "raw provider payloads",
    "API keys",
    "JWT access tokens",
    "unbounded request or response bodies",
  ]
) {
  assertIncludes("Phase 7G crown-jewel boundary", audit, boundary);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7G-logs-errors-observability-audit.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7g`");
assertIncludes("package.json", packageJson, '"check:phase-7g"');
assertIncludes("package.json", packageJson, "npm run check:phase-7g");

assertFilesDoNotMatch(
  edgeFunctionRuntimeFiles,
  /\bconsole\.(?:debug|error|info|log|trace|warn)\s*\(/u,
  "Runtime Edge Function code must not use raw console logging",
);

for (const path of publicAndRuntimeFiles) {
  assertNoRawSecretPatterns(path, read(path));
}

assertIncludes(
  "public privacy check",
  publicPrivacyCheck,
  "must not log from runtime Edge Function code without a reviewed sanitizer",
);
assertIncludes("public privacy check", publicPrivacyCheck, "assertNoRawSecretPatterns");
assertIncludes("public privacy check", publicPrivacyCheck, "sanitizeActivityLogMessage");

for (
  const observabilityBoundary of [
    "const MAX_EVENTS = 8",
    "function sanitizeEventText",
    "sanitizeSupabaseMessage(value)",
    "email_[hidden]",
    ".slice(0, 220)",
    "Observability should never block the demo flow.",
    "message: sanitizeEventText(event.message)",
    "code: event.code ? sanitizeEventText(event.code) : undefined",
    "source: event.source ? sanitizeEventText(event.source) : undefined",
  ]
) {
  assertIncludes("backend observability service", backendObservability, observabilityBoundary);
}
assertNotIncludes("backend observability service", backendObservability, "console.");

for (
  const supabaseBoundary of [
    "function sanitizeSupabaseMessage",
    "sb_publishable_[hidden]",
    "jwt_[hidden]",
    ".slice(0, 240)",
  ]
) {
  assertIncludes("supabase REST client", supabaseRestClient, supabaseBoundary);
}

for (
  const activityBoundary of [
    "function sanitizeActivityLogMessage",
    "[telegram_token_hidden]",
    "[api_key_hidden]",
    "sb_secret_[hidden]",
    "sb_publishable_[hidden]",
    "jwt_[hidden]",
    "[private_key_or_hash_hidden]",
    "[secret_hidden]",
    ".slice(0, 180)",
  ]
) {
  assertIncludes("dashboard activity log sanitizer", dashboardService, activityBoundary);
}
assertIncludes(
  "dashboard activity log mapping",
  dashboardService,
  "message: sanitizeActivityLogMessage(row.message)",
);
assertIncludes(
  "dashboard activity query",
  dashboardService,
  "activity_logs?select=${dashboardActivityLogColumns}",
);
assertNotIncludes("dashboard service", dashboardService, "activity_logs?select=*");

assertIncludes("deploy service", deployService, "sanitizeSupabaseMessage(fallback)");
assertIncludes("deploy service", deployService, 'getDeployFailureMessage("unknown", error.message)');
assertIncludes("deploy-agent function", deployAgentFunction, "function sanitizeActivityLogMessage");
assertIncludes(
  "deploy-agent function",
  deployAgentFunction,
  "message: sanitizeActivityLogMessage(log.message)",
);
assertIncludes("deploy-agent function", deployAgentFunction, "sanitizeErrorMessage");
assertIncludes("deploy-agent function", deployAgentFunction, "getUnknownErrorMessage");
assertIncludes("reset function", resetFunction, "sanitizeErrorMessage");
assertIncludes("reset function", resetFunction, "getUnknownErrorMessage");

for (
  const telegramCoreBoundary of [
    "class HttpError extends Error",
    "function sanitizeErrorMessage",
    "sb_secret_[hidden]",
    "sb_publishable_[hidden]",
    "jwt_[hidden]",
    "assertBodySizeFromHeaders",
    "readJsonObjectBody",
  ]
) {
  assertIncludes("telegram connect core", telegramConnectCore, telegramCoreBoundary);
  assertIncludes("telegram webhook core", telegramWebhookCore, telegramCoreBoundary);
}

for (
  const telegramDeliveryBoundary of [
    "sanitizeTelegramResponseDeliveryError",
    "Telegram is unavailable.",
    "Telegram response delivery is rate limited.",
    "Telegram response could not be delivered.",
    "Telegram delivery is invalid.",
  ]
) {
  assertIncludes("telegram response delivery", telegramResponseDelivery, telegramDeliveryBoundary);
}
assertNotIncludes("telegram response delivery", telegramResponseDelivery, "response.text()");

for (
  const telegramResolverBoundary of [
    "sanitizeTelegramDeliveryTokenResolverError",
    "sanitizeTelegramDeliveryTokenResolverRpcError",
    "Telegram delivery token resolution failed.",
    "Telegram delivery token is unavailable.",
  ]
) {
  assertIncludes("telegram token resolver", telegramTokenResolver, telegramResolverBoundary);
}

for (
  const agentBrainBoundary of [
    "providerUnavailable",
    "Kyra agent brain is unavailable.",
    "Kyra agent brain returned an invalid response.",
    "AbortError",
    "maxPromptMessageLength = 3000",
    "maxPromptMessages = 6",
    "maxApiKeyLength = 4096",
  ]
) {
  assertIncludes("telegram agent brain provider", telegramAgentBrainProvider, agentBrainBoundary);
}
assertNotIncludes("telegram agent brain provider", telegramAgentBrainProvider, "response.text()");

for (
  const baseMcpBoundary of [
    "sanitizeBaseMcpAdapterError",
    "No Base MCP action can be prepared right now.",
    "Base MCP preparation function failed.",
    "Base MCP preparation request is invalid.",
    "Base MCP adapter returned an invalid response.",
  ]
) {
  assertIncludes("Base MCP core", baseMcpCore, baseMcpBoundary);
}
assertIncludes("Base MCP provider adapter", baseMcpProviderAdapter, "createBaseMcpUnavailableFailure");
assertIncludes("Base MCP provider adapter", baseMcpProviderAdapter, "Base MCP preparation timed out.");
assertIncludes("Base MCP types", baseMcpTypes, "sanitizeBaseMcpAdapterError");
assertIncludes("Base MCP types", baseMcpTypes, "No Base MCP action can be prepared right now.");

for (
  const walletBoundary of [
    "createWalletSigningFailure",
    "walletSigningFailureMessages",
    "Wallet provider is unavailable.",
    "Wallet must be connected to Base.",
    "Wallet signing failed safely.",
    "Failed actions require a sanitized reason.",
  ]
) {
  assertIncludes("wallet signing", walletSigning, walletBoundary);
}

for (
  const executionBoundary of [
    "sanitizeExecutionFailureReason",
    "executionFailureMessages",
    "Transaction submission failed safely.",
    "Execution failed safely.",
    "containsSensitiveExecutionText",
    "visibleInPublicProfile: false",
  ]
) {
  assertIncludes("execution result", executionResult, executionBoundary);
}

assertFilesDoNotMatch(
  edgeFunctionRuntimeFiles,
  /request\.clone\(\)\.text\(|request\.text\(\)|response\.text\(\)/u,
  "Runtime Edge Function code must not read raw body text for logging-style output",
);

console.log("Phase 7G logs/errors/observability checks passed.");
