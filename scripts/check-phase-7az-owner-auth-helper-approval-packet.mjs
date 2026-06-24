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

const doc = read("docs/phase-7AZ-owner-auth-helper-approval-packet.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const skeletonDoc = read("docs/phase-7AX-disabled-only-route-skeleton.md");
const authBoundary = read(
  "docs/phase-7AY-owner-authentication-boundary-packet.md",
);
const config = read("supabase/config.toml");
const schema = read("supabase/schema.sql");
const appConfig = read("src/config/appConfig.ts");
const disabledResponse = read(
  "supabase/functions/official-mcp-shared/disabled-response.ts",
);

for (
  const expected of [
    "# Phase 7AZ Owner Auth Helper Approval Packet",
    "Status: approval packet complete. Auth helper code is not approved.",
    "Approval state: `ready_to_request_owner_auth_helper_approval`.",
    "`owner_approved_auth_helpers`",
    "The list is an approval boundary, not permission to create the files.",
    "pure dependency-bound modules",
    "must not:",
    "read `Deno.env`",
    "import a Supabase client library",
    "interface OfficialMcpOwnerAuthDependencies",
    "function readOfficialMcpBearerAuthorization",
    "async function authenticateOfficialMcpOwner",
    "interface OfficialMcpOwnershipLookup",
    "async function resolveOfficialMcpOwnerAgentBinding",
    "External policy: fixed sanitized 404 for every inaccessible binding.",
    "`requested_binding_not_found`",
    "Allowed external codes:",
    "Test-First Order",
    "none of the five official MCP route files imports `owner-auth.ts`",
    "User wallet authority and user Telegram bot-token privacy remain the highest",
    "helper approval does not permit",
    "owner-auth and ownership helper files remain absent",
    "npm run check:phase-7az",
  ]
) {
  includes("Phase 7AZ packet", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Approval state: `owner_approved_auth_helpers`.",
    "helper implementation complete",
    "route integration approved",
    "provider contact approved",
    "OAuth processing enabled",
    "token storage enabled",
    "wallet execution enabled",
    "deploy completed",
    "push completed",
  ]
) {
  excludes("Phase 7AZ packet", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7az"');
includes("package.json", packageJson, "npm run check:phase-7az");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AZ-owner-auth-helper-approval-packet.md",
);
includes(
  "private context",
  context,
  "Phase 7AZ owner-auth helper approval packet is complete locally",
);
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes("Phase 7AX skeleton", skeletonDoc, "Phase 7AX result: `disabled_safe`.");
includes(
  "Phase 7AY auth boundary",
  authBoundary,
  "Decision state: `owner_auth_contract_defined`.",
);
includes("app config", appConfig, 'walletExecution: "disabled"');
includes("disabled response", disabledResponse, "gateEnabled ? 503 : 403");

for (
  const path of [
    "supabase/functions/official-mcp-shared/owner-auth.ts",
    "supabase/functions/official-mcp-shared/owner-auth_test.ts",
    "supabase/functions/official-mcp-shared/ownership.ts",
    "supabase/functions/official-mcp-shared/ownership_test.ts",
    "scripts/check-official-mcp-owner-auth-boundary.mjs",
  ]
) {
  assert(!existsSync(resolve(root, path)), `${path} must remain absent in Phase 7AZ.`);
}

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
  excludes(route, routeSource, "assertBearerAuthorization");
  excludes(route, routeSource, "createClient");
  excludes(route, routeSource, "_request.json");
  excludes(route, routeSource, "new URL(_request.url");
  excludes("supabase/config.toml", config, `[functions.${route}]`);
}

for (
  const forbiddenSchemaTerm of [
    "official_mcp_credentials",
    "official_mcp_oauth_transactions",
    "official_mcp_wallet_authority_bindings",
  ]
) {
  excludes("supabase/schema.sql", schema, forbiddenSchemaTerm);
}

console.log("Phase 7AZ owner-auth helper approval packet checks passed.");
