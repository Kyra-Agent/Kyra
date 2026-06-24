import { readFileSync } from "node:fs";
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

const doc = read("docs/phase-7AY-owner-authentication-boundary-packet.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const phase7B = read("docs/phase-7B-ownership-rls-write-path-audit.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const walletBlueprint = read(
  "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
);
const schemaBlueprint = read(
  "docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md",
);
const skeletonDoc = read("docs/phase-7AX-disabled-only-route-skeleton.md");
const telegramCore = read("supabase/functions/telegram-connect/core.ts");
const baseMcpCore = read("supabase/functions/base-mcp-prepare/core.ts");
const schema = read("supabase/schema.sql");
const config = read("supabase/config.toml");
const appConfig = read("src/config/appConfig.ts");

for (
  const expected of [
    "# Phase 7AY Owner Authentication Boundary Packet",
    "Status: owner-authentication boundary audit complete. Runtime remains NO-GO.",
    "Decision state: `owner_auth_contract_defined`.",
    "The only owner identity source for owner-facing routes is a Supabase Auth user",
    "Possession of the service-role key is not caller",
    "verified Supabase user id",
    "-> workspaces.owner_user_id",
    "-> agent_instances.workspace_id",
    "Future caller class: private Kyra dashboard owner only.",
    "Future caller class: provider browser redirect bound to a previously",
    "Future caller class: internal backend only.",
    "one-time server-stored OAuth transaction",
    "secure HttpOnly browser-binding cookie match",
    "Gateway JWT verification is defense in depth.",
    "disabled routes do not read body or query data",
    "The current shared Telegram `Access-Control-Allow-Origin: *` helper must not be",
    "Telegram bot tokens and official MCP credentials remain completely separate.",
    "supabase/functions/official-mcp-shared/owner-auth.ts",
    "Those files are not approved in Phase 7AY.",
    "missing bearer fails before environment, database, body, or query access",
    "Phase 7AX route skeletons remain `disabled_safe`",
    "npm run check:phase-7ay",
  ]
) {
  includes("Phase 7AY packet", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Decision state: `owner_auth_implemented`",
    "auth helpers are implemented",
    "Supabase client added to official routes",
    "provider contact approved",
    "OAuth processing enabled",
    "token storage enabled",
    "wallet execution enabled",
    "deploy completed",
    "push completed",
  ]
) {
  excludes("Phase 7AY packet", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7ay"');
includes("package.json", packageJson, "npm run check:phase-7ay");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AY-owner-authentication-boundary-packet.md",
);
includes(
  "private context",
  context,
  "Phase 7AY owner-authentication boundary packet is complete locally",
);
includes("Phase 7B audit", phase7B, "## RLS And Grant Rules");
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes(
  "wallet blueprint",
  walletBlueprint,
  "-> deployed agent instance",
);
includes(
  "schema blueprint",
  schemaBlueprint,
  "Secret-bearing tables have no browser-readable",
);
includes("Phase 7AX skeleton", skeletonDoc, "Phase 7AX result: `disabled_safe`.");

includes("Telegram auth core", telegramCore, "assertBearerAuthorization");
includes("Telegram auth core", telegramCore, "assertAuthenticatedUserId");
includes("Telegram auth core", telegramCore, "lookupAgentOwnershipRecord");
includes("Telegram auth core", telegramCore, "assertAgentOwnership");
includes(
  "Base MCP core",
  baseMcpCore,
  "const authorization = assertBearerAuthorization(request);",
);
includes(
  "Base MCP core",
  baseMcpCore,
  "const ownerUserId = assertAuthenticatedUserId(user);",
);
includes(
  "Base MCP core",
  baseMcpCore,
  "assertAgentOwnership(allowedPrepareRequest.agentId, ownerUserId, ownership);",
);
includes("schema", schema, "owner_user_id uuid not null references auth.users(id)");
includes("schema", schema, "alter table public.workspaces enable row level security;");
includes("schema", schema, "alter table public.agent_instances enable row level security;");
includes("schema", schema, "using (owner_user_id = auth.uid());");
includes("app config", appConfig, 'walletExecution: "disabled"');

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
  excludes(route, routeSource, "createClient");
  excludes(route, routeSource, "assertBearerAuthorization");
  excludes(route, routeSource, "lookupAgentOwnership");
  excludes(route, routeSource, "_request.json");
  excludes(route, routeSource, "new URL(_request.url");
  excludes("supabase/config.toml", config, `[functions.${route}]`);
}

for (
  const path of [
    "supabase/functions/official-mcp-shared/owner-auth.ts",
    "supabase/functions/official-mcp-shared/owner-auth_test.ts",
    "supabase/functions/official-mcp-shared/ownership.ts",
    "supabase/functions/official-mcp-shared/ownership_test.ts",
  ]
) {
  assert(
    doc.includes(path),
    `${path} must remain documented as the Phase 7AY owner-auth boundary.`,
  );
}

console.log("Phase 7AY owner-authentication boundary packet checks passed.");
