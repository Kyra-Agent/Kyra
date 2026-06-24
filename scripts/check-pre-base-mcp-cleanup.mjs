import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

const packageJson = JSON.parse(read("package.json"));
const netlify = read("netlify.toml");
const appConfig = read("src/config/appConfig.ts");
const repositoryFactory = read("src/services/repositoryFactory.ts");
const backendTypes = read("src/types/backend.ts");
const demoBackend = read("src/data/demoBackend.ts");
const dashboardService = read("src/services/supabaseDashboardService.ts");
const cleanupAudit = read("docs/phase-7-pre-base-mcp-cleanup-audit.md");
const roadmap = read("docs/product-phase-roadmap.md");

assert(
  packageJson.overrides?.ws === "^8.21.0",
  "package.json must override ws to a non-vulnerable reviewed version.",
);
includes(
  "package.json scripts",
  JSON.stringify(packageJson.scripts),
  "check:pre-base-mcp",
);

includes("netlify headers", netlify, "Content-Security-Policy");
includes("netlify CSP", netlify, "default-src 'self'");
includes("netlify CSP", netlify, "object-src 'none'");
includes("netlify CSP", netlify, "frame-ancestors 'none'");
includes("netlify CSP", netlify, "connect-src 'self' https://*.supabase.co");

includes("app config", appConfig, 'telegram: telegramBackendConfigured ? "live read-only"');
includes("app config", appConfig, '"custom read-only bridge"');
includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, 'telegram: "simulated"');
excludes("app config", appConfig, 'baseMcp: "simulated"');

includes(
  "repository runtime note",
  repositoryFactory,
  "Onchain execution stays disabled until Base MCP approval gates are ready.",
);
excludes(
  "repository runtime note",
  repositoryFactory,
  "Onchain execution stays simulated.",
);

includes("backend wallet policy type", backendTypes, '"active" | "gated" | "inactive"');
includes("demo backend wallet policy labels", demoBackend, 'status: "gated"');
excludes("demo backend wallet policy labels", demoBackend, 'status: "simulated"');
includes("dashboard wallet policy labels", dashboardService, 'label: "Policy gated"');
includes("dashboard wallet policy labels", dashboardService, 'status: "gated"');
excludes("dashboard wallet policy labels", dashboardService, 'status: "simulated"');
excludes("dashboard wallet policy labels", dashboardService, 'label: "Policy simulated"');

for (
  const expected of [
    "# Phase 7 Pre-Base MCP Cleanup Audit",
    "Telegram `live read-only`",
    "Base MCP `custom read-only bridge`",
    "wallet execution `disabled`",
    "No platform-owned wallet fallback.",
    "official Base MCP live execution is not complete",
  ]
) {
  includes("cleanup audit", cleanupAudit, expected);
}

includes(
  "canonical roadmap",
  roadmap,
  "Phase 7F prepared-action adapter allowlist is implemented",
);
includes(
  "canonical roadmap",
  roadmap,
  "Phase 7G prepared-action policy enforcement is implemented",
);
includes(
  "canonical roadmap",
  roadmap,
  "Phase 7H dual approval and freeze boundary is implemented",
);
includes(
  "canonical roadmap",
  roadmap,
  "Phase 7I result monitoring and closeout boundary is implemented",
);
includes(
  "canonical roadmap",
  roadmap,
  "The current primary work item is Phase 7J",
);
includes(
  "canonical roadmap",
  roadmap,
  "Wallet signing, token approval, swaps, transfers, contract calls, transaction",
);

console.log("Pre-Base MCP cleanup checks passed.");
