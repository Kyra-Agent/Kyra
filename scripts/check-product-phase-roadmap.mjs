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

for (
  const expected of [
    "canonical source of truth for product phases",
    "Kyra is a platform for deploying user-owned AI agents.",
    "Phase 5 - Telegram And LLM",
    "Status: complete and live read-only.",
    "Phase 6 - Wallet And Approval Foundation",
    "Status: foundation complete, not live execution.",
    "Phase 7 - Official Base MCP Live Execution",
    "connect owner's Base Account",
    "receive explicit Kyra owner approval",
    "receive explicit Base Account approval",
    "The custom `kyra_status_v1` bridge",
    "This bridge is not official Base MCP",
    "docs/phase-7C-official-base-mcp-provider-contract-audit.md",
    "decision: no-go for live wallet authority",
    "CDP Node or another RPC provider may later support",
    "It is not required for the official Base MCP product flow",
    "Phase 7D foundation is clear.",
    "Phase 7D runtime Base Account connection is still blocked.",
    "Phase 7E runtime OAuth and token work must not begin yet.",
    "safe next work is limited to:",
    "Do not start the next runtime phase until the roadmap, Phase 7C audit",
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
    "Phase 7 is in progress and targets official Base MCP live execution",
    "The owner connects their own Base Account to that agent.",
    "Telegram remains unable to sign or submit.",
    "Phase 7C: monitor official Base MCP provider contract until a verified",
    "only after Phase 7C changes from no-go to go.",
    "Coinbase CDP Node or another standalone RPC provider is optional infrastructure",
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
    "No-go for Phase 7D wallet/Base MCP implementation.",
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
  "Official Base MCP remains the primary Phase 7",
);

for (
  const forbidden of [
    "# Phase 7AK",
    "CDP Node is required for official Base MCP",
    "must use a platform-owned wallet",
    "Telegram signs and submits",
  ]
) {
  excludes("canonical roadmap sources", `${roadmap}\n${optionalCdp}`, forbidden);
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
