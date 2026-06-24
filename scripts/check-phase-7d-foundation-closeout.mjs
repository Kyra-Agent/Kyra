import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

const closeout = read("docs/phase-7D-foundation-closeout.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");
const phase7cDecision = read("docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md");
const preparedActionApproval = read("docs/phase-7D-prepared-action-storage-approval.md");
const ownerAuth = read("supabase/functions/official-mcp-shared/owner-auth.ts");
const ownership = read("supabase/functions/official-mcp-shared/ownership.ts");
const appConfig = read("src/config/appConfig.ts");
const schema = read("supabase/schema.sql");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const config = read("supabase/config.toml");

for (
  const path of [
    "supabase/functions/official-mcp-shared/owner-auth.ts",
    "supabase/functions/official-mcp-shared/ownership.ts",
    "supabase/functions/official-mcp-shared/owner-auth_test.ts",
    "supabase/functions/official-mcp-shared/ownership_test.ts",
    "scripts/check-official-mcp-owner-auth-boundary.mjs",
    "docs/phase-7D-prepared-action-storage-approval.md",
    "scripts/check-phase-7d-prepared-action-storage.mjs",
  ]
) {
  assert(existsSync(resolve(root, path)), `${path} is required for 7D closeout.`);
  includes("Phase 7D closeout", closeout, path);
}

for (
  const expected of [
    "# Phase 7D Foundation Closeout",
    "Status: foundation clear. Runtime Base Account connection remains blocked.",
    "Phase 7D product runtime still depends on Phase 7C changing from NO-GO to GO.",
    "owner-auth helper exists and is dependency-injected only",
    "ownership helper exists and is dependency-injected only",
    "inaccessible bindings return fixed sanitized 404",
    "prepared-action storage SQL remains review-only",
    "prepared-action runtime storage remains unwired",
    "official MCP route skeletons remain disabled and isolated",
    "wallet execution remains disabled",
    "Do not start Phase 7E runtime work while Phase 7C remains NO-GO.",
    "npm run check:phase-7d",
  ]
) {
  includes("Phase 7D closeout", closeout, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Runtime Base Account connection approved",
    "OAuth runtime approved",
    "token storage enabled",
    "wallet execution enabled",
    "transaction submission enabled",
  ]
) {
  excludes("Phase 7D closeout", closeout, forbidden);
}

includes("package.json", packageJson, "check-phase-7d-foundation-closeout.mjs");
includes("package.json", packageJson, "npm run check:phase-7d");
includes("roadmap", roadmap, "docs/phase-7D-foundation-closeout.md");
includes("roadmap", roadmap, "foundation closeout");
includes("Phase 7C decision", phase7cDecision, "Decision: **NO-GO**.");
includes(
  "prepared-action approval",
  preparedActionApproval,
  "Prepared-action storage is not live.",
);
includes("owner-auth", ownerAuth, "OfficialMcpOwnerAuthDependencies");
includes("ownership", ownership, "OfficialMcpOwnershipLookup");
includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("schema", schema, "create table public.prepared_actions");
excludes("dependencies", dependencies, "storePreparedActionSummary");

for (
  const route of [
    "official-mcp-oauth-start",
    "official-mcp-oauth-callback",
    "official-mcp-token-broker",
    "official-mcp-revoke",
    "official-mcp-status",
  ]
) {
  const routeSource = read(`supabase/functions/${route}/index.ts`);
  excludes(route, routeSource, "owner-auth.ts");
  excludes(route, routeSource, "ownership.ts");
  excludes(route, routeSource, "authenticateOfficialMcpOwner");
  excludes(route, routeSource, "resolveOfficialMcpOwnerAgentBinding");
  excludes(route, routeSource, "_request.json");
  excludes(route, routeSource, "new URL(_request.url");
  excludes("supabase/config.toml", config, `[functions.${route}]`);
}

console.log("Phase 7D foundation closeout checks passed.");
