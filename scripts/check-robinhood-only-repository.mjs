import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const scanRoots = ["src", "supabase/functions", "docs"];
const scanFiles = [
  ".env.example",
  "supabase/schema.sql",
  "supabase/seed.sql",
  "supabase/config.toml",
  "supabase/fix_public_agent_profiles_security.sql",
  "supabase/lockdown_authenticated_demo_writes.sql",
  "supabase/verify_chain_action_foundation.sql",
];
const forbiddenPaths = [
  "src/components/BaseAccountConnectionPanel.tsx",
  "src/services/baseMcpPrepareService.ts",
  "src/types/baseAccountConnection.ts",
  "src/types/baseMcp.ts",
  "supabase/functions/base-mcp-prepare",
  "supabase/functions/base-mcp-status-provider",
  "supabase/functions/official-mcp-oauth-start",
  "supabase/functions/official-mcp-oauth-callback",
  "supabase/functions/official-mcp-status",
  "supabase/functions/official-mcp-token-broker",
];
const textExtensions = new Set([".css", ".html", ".json", ".md", ".mjs", ".sql", ".toml", ".ts", ".tsx"]);
const legacyPatterns = [
  /KYRA_BASE_/u,
  /base_mcp/iu,
  /base-mcp/iu,
  /official[ _-]mcp/iu,
  /\bBase (?:Account|Chain|MCP|ecosystem|network|readiness|users|communities)\b/u,
  /\bnetwork\s*[:=]\s*["']base["']/iu,
  /\bchain_key\s*[:=]\s*["']base["']/iu,
];
const internalRoadmapCopy = /\b(?:Phase|Batch)\s+[0-9]/u;

function collectTextFiles(path) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return textExtensions.has(extname(path)) ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    collectTextFiles(join(path, entry.name))
  );
}

const stalePaths = forbiddenPaths.filter((path) => existsSync(join(root, path)));
if (stalePaths.length > 0) {
  throw new Error(`Legacy runtime paths remain:\n${stalePaths.join("\n")}`);
}

const files = [
  ...scanRoots.flatMap((path) => collectTextFiles(join(root, path))),
  ...scanFiles.map((path) => join(root, path)).filter(existsSync),
];
const violations = [];
for (const file of new Set(files)) {
  const text = readFileSync(file, "utf8");
  for (const pattern of legacyPatterns) {
    if (pattern.test(text)) {
      violations.push(`${relative(root, file)} matched ${pattern}`);
    }
  }
}

const runtimeCopyFiles = [
  ...collectTextFiles(join(root, "src")),
  ...collectTextFiles(join(root, "supabase/functions/telegram-webhook")),
];
for (const file of runtimeCopyFiles) {
  if (internalRoadmapCopy.test(readFileSync(file, "utf8"))) {
    violations.push(`${relative(root, file)} exposes an internal roadmap label`);
  }
}

if (violations.length > 0) {
  throw new Error(`Active repository still contains legacy Base contracts:\n${violations.join("\n")}`);
}

console.log("Robinhood-only active repository checks passed.");