import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

function assertFileExists(path) {
  assert(existsSync(resolve(root, path)), `${path} must exist.`);
}

function assertFilesDoNotInclude(paths, forbiddenPattern, message) {
  for (const path of paths) {
    assert(!forbiddenPattern.test(read(path)), `${message}: ${path}`);
  }
}

const audit = read("docs/phase-7H-release-rollback-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const netlifyConfig = read("netlify.toml");
const phase6BReviewPacket = read("docs/phase-6B-review-packet.md");
const preparedForward = read("supabase/prepared_action_storage_forward_review.sql");
const preparedRollback = read("supabase/prepared_action_storage_rollback_review.sql");
const preparedVerifier = read("supabase/verify_prepared_action_storage_review.sql");
const baseMcpDependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const baseMcpRuntimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const baseMcpReadme = read("supabase/functions/base-mcp-prepare/README.md");
const telegramWebhookRuntimeConfig = read("supabase/functions/telegram-webhook/runtime-config.ts");
const telegramWebhookReadme = read("supabase/functions/telegram-webhook/README.md");
const telegramConnectCore = read("supabase/functions/telegram-connect/core.ts");
const telegramConnectRuntimeConfig = read("supabase/functions/telegram-connect/runtime-config.ts");
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const edgeRuntimeFiles = walkFiles("supabase/functions").filter((path) =>
  /\.ts$/u.test(path) && !path.endsWith("_test.ts")
);

for (
  const required of [
    "# Phase 7H Release And Rollback Audit",
    "Status: audit packet started.",
    "## Release Rule",
    "## Current Gate State",
    "## Rollback Inventory",
    "## Runtime Gate Rules",
    "## Local Verification Before Push",
    "## Live Smoke Checklist",
    "## Netlify Credit Discipline",
    "## Phase 7H Done Criteria",
    "No production execution capability is enabled by this audit.",
  ]
) {
  assertIncludes("Phase 7H audit", audit, required);
}

for (
  const releaseRule of [
    "owner approval is explicit for the exact gate",
    "automated checker exists and is included in `npm run check:phase-7`",
    "rollback path is reviewed",
    "live smoke checklist is written",
    "target account/workspace is low risk",
    "secrets are configured only in backend secret storage",
    "Netlify deploy is batched with other reviewed local commits",
  ]
) {
  assertIncludes("Phase 7H release rule", audit, releaseRule);
}

for (
  const command of [
    "npm run check:phase-7",
    "deno test --quiet supabase/functions",
    "npm run build",
    "git diff --check",
  ]
) {
  assertIncludes("Phase 7H local verification", audit, command);
}

for (
  const smokeItem of [
    "confirm the target Supabase project and Netlify site",
    "confirm secrets are present only in Supabase/Netlify backend secret stores",
    "confirm Telegram still refuses wallet/swap/onchain execution",
    "run the smallest approved success path once",
    "run the primary refusal path once",
    "run one wrong-owner or unauthorized path once",
    "disable the gate immediately",
  ]
) {
  assertIncludes("Phase 7H smoke checklist", audit, smokeItem);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7H-release-rollback-audit.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7h`");
assertIncludes("package.json", packageJson, '"check:phase-7h"');
assertIncludes("package.json", packageJson, "npm run check:phase-7h");

for (
  const rollbackArtifact of [
    "supabase/prepared_action_storage_forward_review.sql",
    "supabase/prepared_action_storage_rollback_review.sql",
    "supabase/verify_prepared_action_storage_review.sql",
    "supabase/telegram_owner_link_challenge_forward_review.sql",
    "supabase/telegram_owner_link_challenge_rollback_review.sql",
    "supabase/telegram_owner_link_rate_limit_forward_review.sql",
    "supabase/telegram_owner_link_rate_limit_rollback_review.sql",
    "supabase/telegram_update_claim_forward_review.sql",
    "supabase/telegram_update_claim_rollback_review.sql",
    "supabase/telegram_webhook_receiver_forward_review.sql",
    "supabase/telegram_webhook_receiver_rollback_review.sql",
    "supabase/telegram_delivery_token_resolver_forward_review.sql",
    "supabase/telegram_delivery_token_resolver_rollback_review.sql",
    "supabase/telegram_disconnect_session_claim_forward_review.sql",
    "supabase/telegram_disconnect_session_claim_rollback_review.sql",
  ]
) {
  assertFileExists(rollbackArtifact);
  assertIncludes("Phase 7H rollback inventory", audit, rollbackArtifact);
}

assertIncludes(
  "prepared-action forward SQL",
  preparedForward,
  "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.",
);
assertIncludes(
  "prepared-action rollback SQL",
  preparedRollback,
  "REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL.",
);
assertIncludes(
  "prepared-action verifier SQL",
  preparedVerifier,
  "REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION.",
);
assertIncludes("prepared-action rollback SQL", preparedRollback, "public.prepared_actions contains rows");
assert(
  !/\bdrop\s+(?:table|view)\b[\s\S]*\bcascade\b/iu.test(preparedRollback),
  "Prepared-action rollback must not use DROP ... CASCADE.",
);

assertIncludes("Base MCP runtime config", baseMcpRuntimeConfig, 'value === "true"');
assertIncludes("Telegram webhook runtime config", telegramWebhookRuntimeConfig, 'value === "true"');
assertIncludes("Telegram connect core", telegramConnectCore, 'value === "true"');
assertIncludes("Telegram connect runtime config", telegramConnectRuntimeConfig, "isTelegramConnectWebhookRegisterEnabled");
assertIncludes("base-mcp README", baseMcpReadme, "With `KYRA_BASE_MCP_PREP_ENABLED` disabled or unset");
assertIncludes("base-mcp README", baseMcpReadme, "Do not enable a live Base MCP provider call without a separate review.");
assertIncludes("telegram webhook README", telegramWebhookReadme, "All runtime gates enable only for the exact string `true`.");
assertIncludes("telegram webhook README", telegramWebhookReadme, "Do not enable write, approval, wallet, Base MCP, onchain, or LLM command");
assertIncludes("Phase 6B review packet", phase6BReviewPacket, "Do not push just to preview Netlify.");

assertNotIncludes("Base MCP dependencies", baseMcpDependencies, "createBaseMcpStatusCheckAdapter");
assertNotIncludes("Base MCP dependencies", baseMcpDependencies, "storePreparedActionSummary");
assertIncludes("app config", appConfig, 'walletExecution: "disabled"');
assertIncludes("wallet boundary", walletBoundary, 'appConfig.integrations.walletExecution === "disabled"');

assertIncludes("netlify.toml", netlifyConfig, 'command = "npm run build"');
assertIncludes("netlify.toml", netlifyConfig, 'publish = "dist"');
assertIncludes("netlify.toml", netlifyConfig, "X-Frame-Options");
assertIncludes("netlify.toml", netlifyConfig, "X-Content-Type-Options");
assertIncludes("netlify.toml", netlifyConfig, "Permissions-Policy");
assertIncludes("netlify.toml", netlifyConfig, "payment=()");

assertFilesDoNotInclude(
  sourceFiles,
  /VITE_.*(?:SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY|BASE_MCP_API_KEY)/u,
  "Frontend must not expose backend secrets through VITE env keys",
);
assertFilesDoNotInclude(
  edgeRuntimeFiles,
  /\bconsole\.(?:debug|error|info|log|trace|warn)\s*\(/u,
  "Runtime Edge Functions must stay free of raw console logging before release",
);

console.log("Phase 7H release/rollback checks passed.");
