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
  mcpEndpointChallenge: "https://mcp.base.org/mcp",
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
  mcpEndpointChallenge: {
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
  const mcpChallenge = normalizeMcpEndpointChallenge(
    sources.mcpEndpointChallenge,
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
  if (!mcpChallenge.resourceMetadata) {
    blockers.push("mcp_challenge_resource_metadata_missing");
  }
  if (mcpChallenge.scopes.length === 0) {
    blockers.push("mcp_challenge_scope_missing");
  }

  return {
    version: providerEvidenceVersion,
    observedAt,
    decision: blockers.length === 0 ? "manual_review_required" : "blocked",
    blockers,
    authorization,
    protectedResources,
    mcpChallenge,
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
          wwwAuthenticate: source.wwwAuthenticate ?? null,
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
      return failedSource(
        url,
        response.status,
        "redirect_rejected",
        "",
        response.headers.get("www-authenticate"),
      );
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
        response.headers.get("www-authenticate"),
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
      wwwAuthenticate: sanitizeWwwAuthenticate(
        response.headers.get("www-authenticate"),
      ),
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
      "/agents/guides/check-balance",
      "/agents/guides/view-history",
    ].every((value) => text.includes(value)),
    writeGuidesDocumented: [
      "/agents/guides/send-tokens",
      "/agents/guides/swap-tokens",
      "/agents/guides/sign-messages",
      "/agents/guides/batch-calls",
      "/agents/guides/x402-payments",
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

function normalizeMcpEndpointChallenge(source) {
  const challenge = parseBearerChallenge(source.wwwAuthenticate);

  return {
    available: source.status === 401 && challenge.scheme === "bearer",
    status: source.status,
    bearerRealm: challenge.realm,
    resourceMetadata: readExactHttpsUrl(challenge.resource_metadata),
    scopes: readScopeList(challenge.scope),
  };
}

function createComparableEvidence(value) {
  return {
    version: value.version,
    decision: value.decision,
    blockers: [...(value.blockers ?? [])].sort(),
    authorization: value.authorization,
    protectedResources: value.protectedResources,
    mcpChallenge: value.mcpChallenge,
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
          wwwAuthenticate: source.wwwAuthenticate ?? null,
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

function sanitizeWwwAuthenticate(value) {
  if (typeof value !== "string") return null;

  return value
    .replace(/token="?[^",\s]+"?/giu, 'token="[redacted]"')
    .slice(0, 300);
}

function parseBearerChallenge(value) {
  if (typeof value !== "string") {
    return { scheme: null, realm: null, resource_metadata: null, scope: null };
  }

  const trimmed = value.trim();
  const schemeMatch = trimmed.match(/^([A-Za-z]+)\s*(.*)$/su);
  const scheme = schemeMatch?.[1]?.toLowerCase() ?? null;
  const params = schemeMatch?.[2] ?? "";
  const parsed = { scheme, realm: null, resource_metadata: null, scope: null };
  const pattern = /([A-Za-z_][A-Za-z0-9_-]*)="([^"]*)"/gu;

  for (const match of params.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (key === "realm" || key === "resource_metadata" || key === "scope") {
      parsed[key] = match[2].slice(0, 200);
    }
  }

  return parsed;
}

function readScopeList(value) {
  if (typeof value !== "string") return [];

  return [
    ...new Set(
      value
        .split(/\s+/u)
        .filter((item) => item.length > 0 && item.length <= 160),
    ),
  ].sort();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function failedSource(
  url,
  status,
  errorCode,
  contentType = "",
  wwwAuthenticate = null,
) {
  return {
    url,
    status,
    contentType,
    contentLength: 0,
    sha256: null,
    ok: false,
    errorCode,
    wwwAuthenticate: sanitizeWwwAuthenticate(wwwAuthenticate),
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
