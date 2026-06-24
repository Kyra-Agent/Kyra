import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const allowedFiles = [
  "supabase/functions/official-mcp-shared/gates.ts",
  "supabase/functions/official-mcp-shared/redaction.ts",
  "supabase/functions/official-mcp-shared/disabled-response.ts",
  "supabase/functions/official-mcp-shared/owner-auth.ts",
  "supabase/functions/official-mcp-shared/ownership.ts",
  "supabase/functions/official-mcp-shared/gates_test.ts",
  "supabase/functions/official-mcp-shared/owner-auth_test.ts",
  "supabase/functions/official-mcp-shared/redaction_test.ts",
  "supabase/functions/official-mcp-shared/ownership_test.ts",
  "supabase/functions/official-mcp-oauth-start/index.ts",
  "supabase/functions/official-mcp-oauth-start/index_test.ts",
  "supabase/functions/official-mcp-oauth-callback/index.ts",
  "supabase/functions/official-mcp-oauth-callback/index_test.ts",
  "supabase/functions/official-mcp-token-broker/index.ts",
  "supabase/functions/official-mcp-token-broker/index_test.ts",
  "supabase/functions/official-mcp-revoke/index.ts",
  "supabase/functions/official-mcp-revoke/index_test.ts",
  "supabase/functions/official-mcp-status/index.ts",
  "supabase/functions/official-mcp-status/index_test.ts",
].sort();

const officialDirectories = [
  "supabase/functions/official-mcp-shared",
  "supabase/functions/official-mcp-oauth-start",
  "supabase/functions/official-mcp-oauth-callback",
  "supabase/functions/official-mcp-token-broker",
  "supabase/functions/official-mcp-revoke",
  "supabase/functions/official-mcp-status",
];

function collectFiles(path) {
  const absolute = resolve(root, path);
  const output = [];

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = join(absolute, entry.name);

    if (entry.isDirectory()) {
      output.push(...collectFiles(relative(root, child)));
    } else {
      output.push(relative(root, child).replaceAll("\\", "/"));
    }
  }

  return output;
}

for (const path of allowedFiles) {
  assert(existsSync(resolve(root, path)), `${path} is required.`);
}

const actualFiles = officialDirectories.flatMap(collectFiles).sort();
assert(
  JSON.stringify(actualFiles) === JSON.stringify(allowedFiles),
  `Official MCP disabled skeleton file boundary changed.\nExpected: ${
    allowedFiles.join(", ")
  }\nActual: ${actualFiles.join(", ")}`,
);

const runtimeFiles = allowedFiles.filter((path) => !path.endsWith("_test.ts"));
const runtimeSource = runtimeFiles.map((path) => read(path)).join("\n");

for (
  const forbiddenPattern of [
    [/\bfetch\s*\(/u, "provider or network fetch"],
    [/https?:\/\//u, "provider URL"],
    [/mcp\.base\.org/iu, "official Base MCP host"],
    [/createClient\s*\(/u, "database or auth client"],
    [/crypto\.subtle/iu, "PKCE, state, or token crypto"],
    [/authorization_endpoint/iu, "OAuth authorization endpoint"],
    [/token_endpoint/iu, "OAuth token endpoint"],
    [/code_verifier/iu, "PKCE verifier"],
    [/code_challenge/iu, "PKCE challenge"],
    [/localStorage|sessionStorage/u, "browser token storage"],
    [/signMessage|signTypedData|sendTransaction|writeContract/u, "wallet execution"],
    [/eth_sendTransaction|wallet_sendCalls/iu, "transaction RPC"],
    [/_request\.(?:text|json|formData|arrayBuffer)\s*\(/u, "request body read"],
    [/new URL\s*\(\s*_request\.url/u, "request query parsing"],
  ]
) {
  assert(
    !forbiddenPattern[0].test(runtimeSource),
    `Disabled skeleton must not contain ${forbiddenPattern[1]}.`,
  );
}

const gates = read("supabase/functions/official-mcp-shared/gates.ts");
const disabledResponse = read(
  "supabase/functions/official-mcp-shared/disabled-response.ts",
);
const redaction = read("supabase/functions/official-mcp-shared/redaction.ts");

assert(
  gates.includes('return value === "true";'),
  "Official MCP gates must enable only on exact lowercase true.",
);
for (
  const key of [
    "KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED",
    "KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED",
    "KYRA_OFFICIAL_MCP_TOKEN_BROKER_ENABLED",
    "KYRA_OFFICIAL_MCP_REVOKE_ENABLED",
    "KYRA_OFFICIAL_MCP_STATUS_ENABLED",
  ]
) {
  assert(gates.includes(key), `Missing independent route gate: ${key}.`);
}

for (
  const required of [
    "official_mcp_${route}_not_implemented",
    "official_mcp_${route}_disabled",
    "gateEnabled ? 503 : 403",
    '"cache-control": "no-store"',
    '"referrer-policy": "no-referrer"',
    '"x-content-type-options": "nosniff"',
  ]
) {
  assert(
    disabledResponse.includes(required),
    `Disabled response helper must include: ${required}`,
  );
}

for (
  const required of [
    "authorization[_ -]?code",
    "oauth[_ -]?state",
    "access[_ -]?token",
    "refresh[_ -]?token",
    "telegram[_ -]?(?:bot[_ -]?)?token",
    "service[_ -]?role",
  ]
) {
  assert(redaction.includes(required), `Redaction must cover: ${required}`);
}

const config = read("supabase/config.toml");
for (
  const section of [
    "[functions.official-mcp-oauth-start]",
    "[functions.official-mcp-oauth-callback]",
    "[functions.official-mcp-token-broker]",
    "[functions.official-mcp-revoke]",
    "[functions.official-mcp-status]",
  ]
) {
  assert(
    !config.includes(section),
    `${section} must not be added before deploy approval.`,
  );
}

for (
  const path of [
    "supabase/functions/official-mcp-refresh-token",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(!existsSync(resolve(root, path)), `${path} must remain absent.`);
}

const frontendSource = [
  read("src/pages/Dashboard.tsx"),
  read("src/pages/PublicAgent.tsx"),
  read("src/services/baseMcpPrepareService.ts"),
].join("\n");
const telegramSource = read("supabase/functions/telegram-webhook/core.ts");

for (
  const route of [
    "official-mcp-oauth-start",
    "official-mcp-oauth-callback",
    "official-mcp-token-broker",
    "official-mcp-revoke",
    "official-mcp-status",
  ]
) {
  assert(!frontendSource.includes(route), `${route} must not be wired to frontend.`);
  assert(!telegramSource.includes(route), `${route} must not be wired to Telegram.`);
}

const schema = read("supabase/schema.sql");
for (
  const term of [
    "official_mcp_credentials",
    "official_mcp_oauth_transactions",
    "official_mcp_wallet_authority_bindings",
  ]
) {
  assert(!schema.includes(term), `Schema must not include ${term}.`);
}

console.log("Official MCP disabled route skeleton checks passed.");
