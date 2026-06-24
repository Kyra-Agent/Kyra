import { readFileSync } from "node:fs";

const roadmap = readFileSync("docs/product-phase-roadmap.md", "utf8");
const readme = readFileSync("README.md", "utf8");
const phase5 = readFileSync("docs/phase-5-telegram-closeout.md", "utf8");
const phase6 = readFileSync("docs/phase-6-closeout-audit.md", "utf8");
const phase7 = readFileSync("docs/phase-7-pre-execution-audit.md", "utf8");
const phase7cOfficialContract = readFileSync(
  "docs/phase-7C-official-base-mcp-provider-contract-audit.md",
  "utf8",
);
const privateContext = readFileSync("docs/kyra-agent-context.md", "utf8");
const optionalCdp = readFileSync(
  "docs/optional-cdp-node-infrastructure.md",
  "utf8",
);
const providerSeparation = readFileSync(
  "docs/phase-7-provider-separation-decision.md",
  "utf8",
);

for (
  const expected of [
    "canonical source of truth for product phases",
    "Kyra is a platform for deploying user-owned AI agents.",
    "Phase 5 - Telegram And LLM",
    "Status: complete and live read-only.",
    "Phase 6 - Wallet And Approval Foundation",
    "Status: foundation complete, not live execution.",
    "Phase 7 - Base Account Live Execution",
    "connect owner's Base Account",
    "receive explicit Kyra owner approval",
    "receive explicit Base Account SDK approval",
    "The custom `kyra_status_v1` bridge",
    "This bridge is not a transaction adapter",
    "docs/phase-7C-official-base-mcp-provider-contract-audit.md",
    "this NO-GO applies only to the official hosted `mcp.base.org` adapter",
    "CDP Node or another RPC provider may later support",
    "It is not required for the primary Base Account product flow",
    "Status: complete and live for owner-initiated Base Account connection.",
    "Phase 7E wallet prompt/signing boundary is implemented",
    "Phase 7F prepared-action adapter allowlist is implemented",
    "Phase 7G prepared-action policy enforcement is implemented",
    "Phase 7H dual approval and freeze boundary is implemented",
    "Phase 7I result monitoring and closeout boundary is implemented",
    "Phase 7J controlled live transaction gate is implemented",
    "The product roadmap ends at Phase 7J.",
    "Supporting readiness packets",
    "Group 1: read-only caller and status surface",
    "Group 2: controlled smoke preparation and provider qualification",
    "Group 3: official-provider decisioning and offline go/no-go review",
    "Group 4: owner authority and consent blueprints",
    "Group 5: disabled route skeleton and auth-helper readiness",
    "docs/phase-7N-official-base-mcp-protocol-decision.md",
    "docs/phase-7O-official-mcp-oauth-threat-model.md",
    "docs/phase-7P-official-mcp-oauth-client-architecture.md",
    "docs/phase-7Q-official-mcp-scope-consent-qualification.md",
    "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
    "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
    "docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md",
    "docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md",
    "docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md",
    "docs/phase-7AV-disabled-route-test-harness-plan.md",
    "docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md",
    "docs/phase-7AX-disabled-only-route-skeleton.md",
    "docs/phase-7AY-owner-authentication-boundary-packet.md",
    "docs/phase-7AZ-owner-auth-helper-approval-packet.md",
    "scripts/check-official-mcp-owner-auth-boundary.mjs",
    "backend-only encrypted token reference",
    "owner-only audit",
    "must not add executable SQL, RLS changes, OAuth",
    "Group 5 keeps official MCP route code disabled-only and helper-only.",
    "fixed sanitized responses",
    "dependency-injected APIs",
    "route integration still requires",
    "independent Base Account SDK lane",
    "MCP sessions, tool invocation",
    "This restriction does not freeze the independent Base Account SDK primary",
  ]
) {
  includes("canonical roadmap", roadmap, expected);
}

for (const source of [readme, phase5, phase6, phase7]) {
  includes(
    "canonical roadmap reference",
    source,
    "docs/product-phase-roadmap.md",
  );
}

for (
  const expected of [
    "Phase 6 is foundation-complete, not execution-live",
    "Phase 7 is in progress and targets Base Account live execution",
    "The owner connects their own Base Account to that agent.",
    "Telegram remains unable to sign or submit.",
    "Phase 7C: monitor official Base MCP provider contract until a verified",
    "independent from the official MCP NO-GO.",
    "Coinbase CDP Node or another standalone RPC provider is optional infrastructure",
    "Phase 7D owner-click Base Account connection is live",
    "Phase 7E wallet prompt/signing boundary is implemented",
    "Phase 7F",
    "prepared-action allowlist",
    "Phase 7G",
    "policy enforcement",
    "Phase 7H",
    "dual approval",
    "Phase 7I",
    "result monitoring",
    "Phase 7J",
    "controlled live",
    "Supporting packet group 3 is the official-provider decisioning",
    "MCP sessions, tool invocation",
    "Supporting packet group 4 is the owner authority and consent blueprint",
    "backend-only encrypted token reference",
    "owner-only audit",
    "Supporting packet group 5 is the disabled route skeleton and auth-helper",
    "sanitized responses",
    "dependency-injected APIs",
  ]
) {
  includes("private context roadmap", privateContext, expected);
}

for (
  const expected of [
    "Status: no-go for live wallet authority.",
    "Protected resource metadata checks returned:",
    "`agent_wallet:transact` | rejected",
    "`agent_wallet:escalate` | rejected",
    "No-go for the official hosted Base MCP adapter implementation.",
  ]
) {
  includes("Phase 7C official contract audit", phase7cOfficialContract, expected);
}

includes(
  "optional CDP classification",
  optionalCdp,
  "not part of the primary Phase 7",
);
includes(
  "optional CDP classification",
  optionalCdp,
  "The Base Account SDK plus Kyra's bounded",
);

for (
  const expected of [
    "# Phase 7 Provider Separation Decision",
    "Kyra's production transaction path must not depend on the hosted official",
    "Base Account SDK",
    "Kyra Prepared-Action Adapter",
    "Official Hosted Base MCP Adapter",
    "It does not block:",
    "owner-authenticated Base Account connection in the private dashboard",
  ]
) {
  includes("provider separation decision", providerSeparation, expected);
}

for (
  const forbidden of [
    "# Phase 7AK",
    "CDP Node is required for official Base MCP",
    "must use a platform-owned wallet",
    "Telegram signs and submits",
    "Phase 7D runtime Base Account connection is still blocked.",
    "Phase 7D product runtime still depends on Phase 7C",
    "Only after a go decision, implement Base Account connection",
    "Official Base MCP remains the primary Phase 7",
  ]
) {
  excludes(
    "canonical roadmap sources",
    `${roadmap}\n${optionalCdp}\n${providerSeparation}`,
    forbidden,
  );
}

for (
  const forbidden of [
    "Kyra must not start Phase 7D wallet/Base MCP implementation",
    "Phase 7D cannot begin while provider evidence remains insufficient",
    "only after Phase 7C changes from no-go to go",
  ]
) {
  excludes("private context provider separation", privateContext, forbidden);
}

console.log("Canonical product phase roadmap checks passed.");

function includes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} contains forbidden text: ${forbidden}`);
  }
}
