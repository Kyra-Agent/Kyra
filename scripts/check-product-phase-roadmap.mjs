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
const readinessCloseout = readFileSync(
  "docs/supporting-readiness-closeout.md",
  "utf8",
);

for (
  const expected of [
    "canonical source of truth for product phases",
    "Kyra is a platform for deploying user-owned AI agents.",
    "## The 10 Product Phases",
    "This is the only active roadmap.",
    "| 1 | Product Foundation |",
    "| 2 | Backend Foundation |",
    "| 3 | Security + Privacy Foundation |",
    "| 4 | Agent Deployment Flow |",
    "| 5 | Telegram + LLM Live |",
    "| 6 | Wallet/Approval Foundation |",
    "| 7 | Base Account + Execution Readiness |",
    "| 8 | Controlled Live Transaction |",
    "| 9 | Public Execution Hardening |",
    "| 10 | Product Release Readiness |",
    "## Phase 5 - Telegram + LLM Live",
    "Status: complete and live read-only.",
    "## Phase 6 - Wallet/Approval Foundation",
    "Status: foundation complete, not live execution.",
    "## Phase 7 - Base Account + Execution Readiness",
    "Status: complete as readiness; not live execution.",
    "Phase 7E wallet prompt/signing boundary is implemented",
    "Phase 7F prepared-action adapter allowlist is implemented",
    "Phase 7G prepared-action policy enforcement is implemented",
    "Phase 7H dual approval and freeze boundary is implemented",
    "Phase 7I result monitoring and closeout boundary is implemented",
    "Phase 7J controlled live transaction gate is implemented",
    "## Phase 8 - Controlled Live Transaction",
    "Phase 8 is not complete until this complete user flow works:",
    "receive explicit Kyra owner approval",
    "receive explicit Base Account SDK approval",
    "## Phase 9 - Public Execution Hardening",
    "## Phase 10 - Product Release Readiness",
    "## Base MCP Position",
    "Official hosted Base MCP remains an optional provider adapter.",
    "This NO-GO applies only to the official hosted `mcp.base.org` adapter.",
    "Coinbase CDP Node or another RPC provider may later support",
    "the primary Base Account product flow",
    "User wallet authority and user Telegram bot-token privacy are priority one.",
    "docs/supporting-readiness-closeout.md",
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
    "Current canonical roadmap status:",
    "| 7 | Base Account + execution readiness complete; not live execution |",
    "| 8 | In progress: controlled live transaction Batch 18 |",
    "| 9 | Pending: public execution hardening |",
    "| 10 | Pending: product release readiness |",
    "Phase 8 is in progress: one controlled live transaction",
    "Older Phase 7A-Z documents are supporting evidence packets under Phase 7.",
  ]
) {
  includes("README roadmap", readme, expected);
}

for (
  const expected of [
    "# Supporting Readiness Closeout",
    "They support the 10-phase product roadmap",
    "The groups are not additional product phases.",
    "User wallet authority and user Telegram bot-token privacy remain the top",
    "Phase 7 is complete as Base Account + execution readiness.",
    "Phase 8 is in progress and covers the first controlled live transaction.",
    "Phase 9 covers public execution hardening.",
    "Phase 10 covers product release readiness.",
    "owner-only execution candidate selection",
  ]
) {
  includes("supporting readiness closeout", readinessCloseout, expected);
}

for (
  const expected of [
    "Canonical 10-phase roadmap",
    "Phase 7 is complete as Base Account + execution readiness",
    "Phase 8 is in progress:",
    "controlled live transaction",
    "Phase 9 is pending: public execution hardening",
    "Phase 10 is pending: product release readiness",
    "Supporting readiness packets are evidence under Phase 7",
    "User wallet",
    "Telegram bot-token privacy are priority one",
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
    `${roadmap}\n${readme}\n${readinessCloseout}\n${optionalCdp}\n${providerSeparation}`,
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
