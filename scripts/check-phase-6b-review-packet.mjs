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

const packet = read("docs/phase-6B-review-packet.md");
const audit = read("docs/phase-6B-base-mcp-audit.md");
const plan = read("docs/phase-6B-base-mcp-prep-plan.md");
const phase6Checklist = read("docs/phase-6-wallet-base-checklist.md");
const adapterContract = read("docs/phase-6B-base-mcp-adapter-contract.md");
const readModel = read("docs/phase-6B-prepared-action-read-model.md");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const schema = read("supabase/schema.sql");
const packageJson = read("package.json");

for (const file of [
  "docs/phase-6B-base-mcp-audit.md",
  "docs/phase-6B-base-mcp-adapter-contract.md",
  "docs/phase-6B-prepared-action-read-model.md",
  "docs/phase-6B-base-mcp-prep-plan.md",
  "supabase/functions/base-mcp-prepare/core.ts",
  "supabase/functions/base-mcp-prepare/runtime-config.ts",
  "supabase/functions/base-mcp-prepare/dependencies.ts",
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
  "supabase/functions/base-mcp-prepare/storage-adapter.ts",
  "supabase/prepared_action_storage_schema_draft.sql",
  "supabase/prepared_action_storage_forward_review.sql",
  "supabase/prepared_action_storage_rollback_review.sql",
  "supabase/verify_prepared_action_storage_review.sql",
  "scripts/check-base-mcp-contract.mjs",
  "scripts/check-prepared-action-boundary.mjs",
  "scripts/check-public-privacy.mjs",
  "scripts/check-functions.mjs",
]) {
  assertIncludes("Phase 6B review packet", packet, file);
}

for (const boundary of [
  "User privacy, user wallet security, and user Telegram bot token security are the",
  "no live Base MCP provider call wired into runtime",
  "no prepared-action SQL applied to Supabase",
  "Runtime dependencies do not wire `createBaseMcpStatusCheckAdapter`.",
  "Runtime dependencies do not wire `storePreparedActionSummary`.",
  "Do not push just to preview Netlify.",
  "Do not apply SQL without a separate explicit approval.",
  "Keep wallet signing and transaction submission deferred to Phase 6C.",
]) {
  assertIncludes("Phase 6B review packet", packet, boundary);
}

for (const command of [
  "npm run check:phase-6b",
  "deno test supabase/functions/base-mcp-prepare/index_test.ts supabase/functions/base-mcp-prepare/runtime-config_test.ts supabase/functions/base-mcp-prepare/storage-adapter_test.ts supabase/functions/base-mcp-prepare/provider-adapter_test.ts",
  "npm run check:base-mcp",
  "npm run check:prepared-actions",
  "npm run check:privacy",
  "npm run check:functions",
  "npm run build",
  "git diff --check",
]) {
  assertIncludes("Phase 6B review packet", packet, command);
}

assertIncludes("Phase 6B audit", audit, "provider adapter draft tested with a fake transport only");
assertIncludes("Phase 6B audit", audit, "prepared-action storage adapter draft tested with a fake client only");
assertIncludes("Phase 6B plan", plan, "Provider adapter draft is fake-transport only and not runtime-wired.");
assertIncludes("Phase 6 checklist", phase6Checklist, "docs/phase-6B-review-packet.md");
assertIncludes("Phase 6 checklist", phase6Checklist, "provider/storage drafts stay unwired");
assertIncludes("Phase 6B adapter contract", adapterContract, "Wire a live provider adapter only after explicit review.");
assertIncludes("Prepared action read model", readModel, "there is still no prepared-action database write in production.");
assertIncludes("package.json", packageJson, "\"check:phase-6b\"");

assert(
  !dependencies.includes("createBaseMcpStatusCheckAdapter"),
  "Runtime dependencies must not wire provider adapter during review packet phase.",
);
assert(
  !dependencies.includes("storePreparedActionSummary"),
  "Runtime dependencies must not wire storage adapter during review packet phase.",
);
assert(
  !schema.includes("public.prepared_actions"),
  "Prepared actions SQL must remain unapplied in supabase/schema.sql.",
);

console.log("Phase 6B review packet checks passed.");
