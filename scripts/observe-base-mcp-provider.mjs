import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const providerEvidenceVersion = 1;
export const providerEvidenceSources = Object.freeze({
  authorizationMetadata:
    "https://mcp.base.org/.well-known/oauth-authorization-server",
  protectedResourceMetadata:
    "https://mcp.base.org/.well-known/oauth-protected-resource",
  protectedResourceMetadataMcp:
    "https://mcp.base.org/.well-known/oauth-protected-resource/mcp",
  documentationCorpus: "https://docs.base.org/llms-full.txt",
});

const sourcePolicies = Object.freeze({
  authorizationMetadata: {
    accept: "application/json",
    maxBytes: 16 * 1024,
    successContentType: "application/json",
  },
  protectedResourceMetadata: {
    accept: "application/json",
    maxBytes: 16 * 1024,
    successContentType: "application/json",
  },
  protectedResourceMetadataMcp: {
    accept: "application/json",
    maxBytes: 16 * 1024,
    successContentType: "application/json",
  },
  documentationCorpus: {
    accept: "text/plain",
    maxBytes: 1024 * 1024,
    successContentType: "text/plain",
  },
});

const forbiddenPaths = new Set(["/authorize", "/register", "/token"]);
const defaultTimeoutMs = 8_000;

export async function observeBaseMcpProviderEvidence(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const observedAt = options.observedAt ?? new Date().toISOString();
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;

  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  const sourceEntries = await Promise.all(
    Object.entries(providerEvidenceSources).map(async ([name, url]) => {
      return [
        name,
        await readPublicEvidenceSource({
          name,
          url,
          fetchImpl,
          timeoutMs,
        }),
      ];
    }),
  );
  const sources = Object.fromEntries(sourceEntries);
  const authorization = normalizeAuthorizationMetadata(
    sources.authorizationMetadata,
  );
  const protectedResources = {
    root: normalizeProtectedResourceMetadata(
      sources.protectedResourceMetadata,
    ),
    mcpPath: normalizeProtectedResourceMetadata(
      sources.protectedResourceMetadataMcp,
    ),
  };
  const documentation = normalizeDocumentationSignals(
    sources.documentationCorpus,
  );
  const blockers = [];

  if (
    !protectedResources.root.available && !protectedResources.mcpPath.available
  ) {
    blockers.push("protected_resource_metadata_unavailable");
  }
  if (
    authorization.scopes.includes("agent_wallet:transact") ||
    authorization.scopes.includes("agent_wallet:escalate")
  ) {
    blockers.push("wallet_authority_scopes_advertised");
  }
  if (!documentation.scopeToToolMappingDocumented) {
    blockers.push("scope_to_tool_mapping_unverified");
  }
  if (!documentation.escalationSemanticsDocumented) {
    blockers.push("escalation_semantics_unverified");
  }

  return {
    version: providerEvidenceVersion,
    observedAt,
    decision: blockers.length === 0 ? "manual_review_required" : "blocked",
    blockers,
    authorization,
    protectedResources,
    documentation,
    evidence: Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [
        name,
        {
          url: source.url,
          status: source.status,
          contentType: source.contentType,
          contentLength: source.contentLength,
          sha256: source.sha256,
          ok: source.ok,
          errorCode: source.errorCode,
        },
      ]),
    ),
  };
}

export function compareProviderEvidence(report, baseline) {
  const actual = createComparableEvidence(report);
  const expected = createComparableEvidence(baseline);
  const changes = [];

  compareValue("", expected, actual, changes);

  return {
    matches: changes.length === 0,
    changes,
  };
}

export function loadProviderEvidenceBaseline(
  path = "docs/phase-7R-base-mcp-provider-baseline.json",
) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

async function readPublicEvidenceSource({
  name,
  url,
  fetchImpl,
  timeoutMs,
}) {
  assertAllowedEvidenceUrl(url);
  const policy = sourcePolicies[name];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: policy.accept,
      },
      redirect: "manual",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return failedSource(url, response.status, "redirect_rejected");
    }

    const contentType = normalizeContentType(
      response.headers.get("content-type"),
    );
    if (
      response.ok &&
      contentType !== policy.successContentType
    ) {
      return failedSource(
        url,
        response.status,
        "unexpected_content_type",
        contentType,
      );
    }

    const body = await readBoundedResponseBody(response, policy.maxBytes);

    return {
      url,
      status: response.status,
      contentType,
      contentLength: body.byteLength,
      sha256: sha256(body),
      ok: response.ok,
      errorCode: response.ok ? null : `http_${response.status}`,
      text: new TextDecoder().decode(body),
    };
  } catch (error) {
    const errorCode = error?.name === "AbortError"
      ? "timeout"
      : error?.message === "response_too_large"
      ? "response_too_large"
      : "request_failed";

    return failedSource(url, 0, errorCode);
  } finally {
    clearTimeout(timeout);
  }
}

function assertAllowedEvidenceUrl(value) {
  const url = new URL(value);
  const allowed = new Set(Object.values(providerEvidenceSources));

  if (!allowed.has(url.href)) {
    throw new Error("Provider evidence URL is not allowlisted.");
  }
  if (url.protocol !== "https:") {
    throw new Error("Provider evidence URL must use HTTPS.");
  }
  if (forbiddenPaths.has(url.pathname)) {
    throw new Error("Sensitive OAuth endpoint is forbidden.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      "Provider evidence URL must not contain credentials or parameters.",
    );
  }
}

async function readBoundedResponseBody(response, maxBytes) {
  const declaredLength = Number(response.headers.get("content-length"));

  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("response_too_large");
  }

  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function normalizeAuthorizationMetadata(source) {
  const metadata = parseJsonObject(source);

  return {
    available: source.ok && metadata !== null,
    issuer: readExactHttpsUrl(metadata?.issuer),
    authorizationEndpoint: readExactHttpsUrl(metadata?.authorization_endpoint),
    tokenEndpoint: readExactHttpsUrl(metadata?.token_endpoint),
    registrationEndpoint: readExactHttpsUrl(metadata?.registration_endpoint),
    responseTypes: readStringArray(metadata?.response_types_supported),
    grantTypes: readStringArray(metadata?.grant_types_supported),
    codeChallengeMethods: readStringArray(
      metadata?.code_challenge_methods_supported,
    ),
    tokenEndpointAuthMethods: readStringArray(
      metadata?.token_endpoint_auth_methods_supported,
    ),
    scopes: readStringArray(metadata?.scopes_supported),
  };
}

function normalizeProtectedResourceMetadata(source) {
  const metadata = parseJsonObject(source);

  return {
    available: source.ok && metadata !== null,
    resource: readExactHttpsUrl(metadata?.resource),
    authorizationServers: readStringArray(
      metadata?.authorization_servers,
    ).filter((value) => readExactHttpsUrl(value) !== null),
    scopes: readStringArray(metadata?.scopes_supported),
  };
}

function normalizeDocumentationSignals(source) {
  const text = source.ok ? source.text : "";

  return {
    available: source.ok,
    readOnlyGuidesDocumented: [
      "/ai-agents/guides/check-balance",
      "/ai-agents/guides/view-history",
    ].every((value) => text.includes(value)),
    writeGuidesDocumented: [
      "/ai-agents/guides/send-tokens",
      "/ai-agents/guides/swap-tokens",
      "/ai-agents/guides/sign-messages",
      "/ai-agents/guides/batch-calls",
      "/ai-agents/guides/x402-payments",
    ].every((value) => text.includes(value)),
    arbitraryCalldataDocumented: text.includes("unsigned calldata") &&
      text.includes("send_calls"),
    scopeToToolMappingDocumented:
      /agent_wallet:(?:transact|escalate).{0,500}(?:tool|scope)/isu.test(text),
    escalationSemanticsDocumented:
      /agent_wallet:escalate.{0,500}(?:means|allows|permission|authority)/isu
        .test(text),
  };
}

function createComparableEvidence(value) {
  return {
    version: value.version,
    decision: value.decision,
    blockers: [...(value.blockers ?? [])].sort(),
    authorization: value.authorization,
    protectedResources: value.protectedResources,
    documentation: value.documentation,
    evidence: Object.fromEntries(
      Object.entries(value.evidence ?? {}).map(([name, source]) => [
        name,
        {
          url: source.url,
          status: source.status,
          contentType: source.contentType,
          ok: source.ok,
          errorCode: source.errorCode,
        },
      ]),
    ),
  };
}

function compareValue(path, expected, actual, changes) {
  if (
    expected === null || actual === null ||
    typeof expected !== "object" || typeof actual !== "object"
  ) {
    if (expected !== actual) {
      changes.push({
        path: path || "$",
        expected,
        actual,
      });
    }
    return;
  }

  const keys = new Set([
    ...Object.keys(expected),
    ...Object.keys(actual),
  ]);
  for (const key of [...keys].sort()) {
    compareValue(
      path ? `${path}.${key}` : key,
      expected[key],
      actual[key],
      changes,
    );
  }
}

function parseJsonObject(source) {
  if (!source.ok || source.contentType !== "application/json") {
    return null;
  }

  try {
    const value = JSON.parse(source.text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

function readExactHttpsUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href.replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
}

function readStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((item) => typeof item === "string" && item.length <= 160),
    ),
  ].sort();
}

function normalizeContentType(value) {
  return typeof value === "string"
    ? value.split(";", 1)[0].trim().toLowerCase()
    : "";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function failedSource(
  url,
  status,
  errorCode,
  contentType = "",
) {
  return {
    url,
    status,
    contentType,
    contentLength: 0,
    sha256: null,
    ok: false,
    errorCode,
    text: "",
  };
}

async function main() {
  const report = await observeBaseMcpProviderEvidence();
  const baseline = loadProviderEvidenceBaseline();
  const comparison = compareProviderEvidence(report, baseline);
  const output = {
    ...report,
    baselineMatch: comparison.matches,
    changes: comparison.changes,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = comparison.matches ? 0 : 2;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  await main();
}
