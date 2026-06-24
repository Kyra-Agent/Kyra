import {
  compareProviderEvidence,
  observeBaseMcpProviderEvidence,
  providerEvidenceSources,
} from "./observe-base-mcp-provider.mjs";

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const authorizationMetadata = {
  issuer: "https://mcp.base.org",
  authorization_endpoint: "https://mcp.base.org/authorize",
  token_endpoint: "https://mcp.base.org/token",
  registration_endpoint: "https://mcp.base.org/register",
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: ["agent_wallet:transact", "agent_wallet:escalate"],
};
const documentation = [
  "/agents/guides/check-balance",
  "/agents/guides/view-history",
  "/agents/guides/send-tokens",
  "/agents/guides/swap-tokens",
  "/agents/guides/sign-messages",
  "/agents/guides/batch-calls",
  "/agents/guides/x402-payments",
  "custom plugins produce unsigned calldata and use send_calls",
].join("\n");
const agentDocumentation = [
  "`send` `swap` `sign` `send_calls`",
  "approvalUrl requestId",
].join("\n");

function createResponse(body, init) {
  return new Response(body, init);
}

function createFakeFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });

    if (overrides[url]) {
      return overrides[url](url, init);
    }
    if (url === providerEvidenceSources.authorizationMetadata) {
      return createResponse(JSON.stringify(authorizationMetadata), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (
      url === providerEvidenceSources.protectedResourceMetadata ||
      url === providerEvidenceSources.protectedResourceMetadataMcp
    ) {
      return createResponse("404 page not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (url === providerEvidenceSources.mcpEndpointChallenge) {
      return createResponse('{"error":"invalid_token"}', {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="mcp"',
          "set-cookie": "secret=value",
        },
      });
    }
    if (url === providerEvidenceSources.documentationCorpus) {
      return createResponse(documentation, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (url === providerEvidenceSources.agentDocumentationCorpus) {
      return createResponse(agentDocumentation, {
        status: 200,
        headers: { "content-type": "application/octet-stream, text/plain" },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  return { calls, fetchImpl };
}

{
  const { calls, fetchImpl } = createFakeFetch();
  const report = await observeBaseMcpProviderEvidence({
    fetchImpl,
    observedAt: "2026-06-19T00:00:00.000Z",
  });

  assert(calls.length === 6, "Monitor must call exactly six public sources.");
  for (const call of calls) {
    const url = new URL(call.url);
    assert(call.init.method === "GET", "Monitor must use GET only.");
    assert(call.init.redirect === "manual", "Monitor must reject redirects.");
    assert(call.init.credentials === "omit", "Monitor must omit credentials.");
    assert(!call.init.body, "Monitor must not send a request body.");
    assert(
      !Object.keys(call.init.headers).some((key) =>
        key.toLowerCase() === "authorization" ||
        key.toLowerCase() === "cookie"
      ),
      "Monitor must not send authorization or cookie headers.",
    );
    assert(
      !["/authorize", "/register", "/token"].includes(url.pathname),
      "Monitor must never call a sensitive OAuth endpoint.",
    );
  }

  assert(report.decision === "blocked", "Current evidence must stay blocked.");
  assert(
    report.authorization.scopes.join(",") ===
      "agent_wallet:escalate,agent_wallet:transact",
    "Scopes must be normalized and sorted.",
  );
  assert(
    report.blockers.includes("protected_resource_metadata_unavailable"),
    "Missing protected resource metadata must remain a blocker.",
  );
  assert(
    report.documentation.arbitraryCalldataDocumented,
    "Documentation risk signal must detect arbitrary calldata.",
  );
  assert(
    report.documentation.writeToolNamesDocumented,
    "Agent documentation must expose the reviewed write tool names.",
  );
  assert(
    report.blockers.includes("authoritative_input_schemas_unverified") &&
      report.blockers.includes("approval_lifecycle_unverified") &&
      report.blockers.includes("oauth_token_lifecycle_unverified"),
    "Missing schema, approval lifecycle, and token lifecycle evidence must block.",
  );
  assert(
    report.mcpChallenge.available && report.mcpChallenge.bearerRealm === "mcp",
    "MCP endpoint challenge must capture only the bounded bearer realm.",
  );
  assert(
    report.blockers.includes("mcp_challenge_resource_metadata_missing") &&
      report.blockers.includes("mcp_challenge_scope_missing"),
    "Missing MCP challenge resource metadata and scope must remain blockers.",
  );
  assert(
    !JSON.stringify(report).toLowerCase().includes("set-cookie"),
    "Report must not expose response cookies.",
  );
}

{
  const { fetchImpl } = createFakeFetch({
    [providerEvidenceSources.authorizationMetadata]: () =>
      createResponse("", {
        status: 302,
        headers: {
          location: "https://mcp.base.org/authorize",
          "set-cookie": "secret=value",
        },
      }),
  });
  const report = await observeBaseMcpProviderEvidence({ fetchImpl });

  assert(
    report.evidence.authorizationMetadata.errorCode === "redirect_rejected",
    "Redirects must fail closed without following sensitive endpoints.",
  );
  assert(
    report.authorization.available === false,
    "Rejected redirects must not become metadata.",
  );
}

{
  const oversized = "x".repeat(16 * 1024 + 1);
  const { fetchImpl } = createFakeFetch({
    [providerEvidenceSources.authorizationMetadata]: () =>
      createResponse(oversized, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });
  const report = await observeBaseMcpProviderEvidence({ fetchImpl });

  assert(
    report.evidence.authorizationMetadata.errorCode === "response_too_large",
    "Oversized metadata must fail closed.",
  );
}

{
  const { fetchImpl } = createFakeFetch();
  const report = await observeBaseMcpProviderEvidence({ fetchImpl });
  const comparison = compareProviderEvidence(report, report);
  assert(comparison.matches, "Identical evidence must match.");

  const drifted = structuredClone(report);
  drifted.authorization.scopes.push("wallet:read");
  const drift = compareProviderEvidence(drifted, report);
  assert(!drift.matches, "Scope drift must be detected.");
  assert(
    drift.changes.some((change) =>
      change.path.startsWith("authorization.scopes")
    ),
    "Scope drift path must be reported.",
  );
}

console.log("Phase 7R provider evidence monitor tests passed.");
