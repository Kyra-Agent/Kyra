import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (name, source, value) =>
  assert(source.includes(value), `${name} must include: ${value}`);
const excludes = (name, source, value) =>
  assert(!source.includes(value), `${name} must not include: ${value}`);

const doc = read("docs/phase-7M-provider-contract-qualification.md");
const contract = read("supabase/functions/base-mcp-prepare/provider-contract.ts");
const contractTest = read("supabase/functions/base-mcp-prepare/provider-contract_test.ts");
const adapter = read("supabase/functions/base-mcp-prepare/provider-adapter.ts");
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (const value of [
  "Status: local provider contract hardened; no production provider approved.",
  "## Request Contract",
  "## Response Contract",
  "## Automatic Rejection Matrix",
  "## Qualification Decision",
  "## Preserved Boundaries",
  "4096 bytes",
  "Request-id mismatch or replayed response.",
  "Runtime gate remains default-off.",
]) includes("Phase 7M doc", doc, value);

includes("provider contract", contract, 'baseMcpProviderProtocol = "kyra_status_v1"');
includes("provider contract", contract, "maxBaseMcpProviderResponseBytes = 4096");
includes("provider contract", contract, 'contentType !== "application/json"');
includes("provider contract", contract, "Object.keys(value).sort().join");
includes("provider contract", contract, "record.requestId !== expectedRequestId");
includes("provider contract", contract, "reader.cancel()");
includes("provider adapter", adapter, "readBaseMcpProviderStatusResponse(response, input.requestId)");
includes("provider adapter", adapter, "protocol: baseMcpProviderProtocol");

for (const value of [
  "rejects mismatches and extra fields",
  "requires JSON and bounded body",
  'rawCalldata: "0xdeadbeef"',
  'requestId: "base-status:wrong-request"',
]) includes("provider contract tests", contractTest, value);

for (const forbidden of [
  "ownerUserId",
  "workspaceId: input.workspaceId",
  "agentId: input.agentId",
  "walletAddress",
  "tokenAmount",
  "calldata:",
  "botToken",
]) excludes("provider adapter", adapter, forbidden);

excludes("Telegram runtime", telegram, "readBaseMcpProviderStatusResponse");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7M provider qualification checks passed.");
