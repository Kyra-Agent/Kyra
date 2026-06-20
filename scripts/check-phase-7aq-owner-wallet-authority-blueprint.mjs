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

const doc = read("docs/phase-7AQ-owner-wallet-authority-blueprint.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const freezeGuard = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const oauthArchitecture = read(
  "docs/phase-7P-official-mcp-oauth-client-architecture.md",
);
const walletDecision = read("docs/phase-6C-wallet-provider-decision.md");
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const baseMcpService = read("src/services/baseMcpPrepareService.ts");

for (
  const expected of [
    "# Phase 7AQ Owner Wallet Authority Blueprint",
    "Status: blueprint complete. Runtime remains NO-GO and disabled.",
    "This blueprint exists so a future GO decision has an exact implementation path",
    "owner user",
    "deployed agent instance",
    "Base Account",
    "official Base MCP resource",
    "exact scope",
    "exact consent packet",
    "Future Base Account connection may be initiated only from the private Kyra",
    "Telegram commands",
    "LLM output",
    "page load",
    "background jobs",
    "OAuth consent, Kyra action approval, and Base Account approval are separate",
    "Future official Base MCP tokens must be:",
    "backend-only",
    "encrypted at rest",
    "resolved by opaque reference",
    "Disconnect And Revocation",
    "Replay And Expiry Protection",
    "one-time OAuth state",
    "PKCE S256",
    "browser-binding nonce",
    "Current code remains limited to:",
    "no official Base MCP OAuth routes",
    "no wallet prompt",
    "no transaction submission",
    "Phase 7D may start only after:",
    "npm run check:phase-7aq",
  ]
) {
  includes("Phase 7AQ blueprint", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Phase 7D may start now",
    "OAuth is implemented",
    "token storage is approved",
    "wallet prompt is enabled",
    "transaction submission is enabled",
    "Telegram may approve",
  ]
) {
  excludes("Phase 7AQ blueprint", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7aq"');
includes("package.json", packageJson, "npm run check:phase-7aq");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
);
includes(
  "private context",
  context,
  "Phase 7AQ owner wallet authority blueprint is complete",
);
includes("decision packet", decisionPacket, "Decision: **NO-GO**.");
includes("freeze guard", freezeGuard, "The freeze stays active while Phase 7AO is NO-GO.");
includes(
  "OAuth architecture",
  oauthArchitecture,
  "The browser never receives an official MCP access token",
);
includes("wallet provider decision", walletDecision, "`walletExecution` remains disabled");

includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
includes("Base MCP service", baseMcpService, 'actionKind: "base_mcp_status_check"');
includes("Base MCP service", baseMcpService, 'mode: "read_only"');

assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "Official MCP OAuth start disabled-only skeleton must exist after Phase 7AX.",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-callback")),
  "Official MCP OAuth callback disabled-only skeleton must exist after Phase 7AX.",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-token-broker")),
  "Official MCP token broker disabled-only skeleton must exist after Phase 7AX.",
);

console.log("Phase 7AQ owner wallet authority blueprint checks passed.");
