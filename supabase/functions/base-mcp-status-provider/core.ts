export const baseMcpStatusProviderProtocol = "kyra_status_v1" as const;
export const baseMainnetChainId = "0x2105";
export const maxBaseMcpStatusProviderBodyBytes = 2048;
export const maxBaseMcpStatusProviderRequestAgeMs = 60_000;
export const maxBaseMcpStatusProviderFutureSkewMs = 10_000;
export const maxBaseRpcResponseBytes = 2048;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

interface BaseMcpStatusProviderDependencies {
  expectedBearerSecret: string;
  baseRpcUrl: string;
  baseRpcProvider: string;
  getNow?: () => Date;
  fetchRpc?: typeof fetch;
}

interface BaseMcpStatusRequest {
  actionKind: "base_mcp_status_check";
  protocol: typeof baseMcpStatusProviderProtocol;
  chain: "base";
  mode: "read_only";
  requestId: string;
  requestedAt: string;
}

export async function handleBaseMcpStatusProviderRequest(
  request: Request,
  dependencies: BaseMcpStatusProviderDependencies,
) {
  try {
    assertPost(request);
    assertStatusPath(request);
    assertJsonContentType(request);
    assertBodyLengthHeader(request);
    await assertBearerSecret(request, dependencies.expectedBearerSecret);

    const body = await readBoundedJsonObject(
      request,
      maxBaseMcpStatusProviderBodyBytes,
    );
    const statusRequest = readStatusRequest(body);
    assertFreshRequest(
      statusRequest.requestedAt,
      dependencies.getNow?.() ?? new Date(),
    );

    const baseRpcUrl = normalizeBaseRpcUrl(
      dependencies.baseRpcUrl,
      dependencies.baseRpcProvider,
    );
    await verifyBaseMainnet(baseRpcUrl, dependencies.fetchRpc ?? fetch);

    return jsonResponse({
      protocol: baseMcpStatusProviderProtocol,
      status: "ok",
      actionKind: "base_mcp_status_check",
      chain: "base",
      mode: "read_only",
      requestId: statusRequest.requestId,
    }, 200);
  } catch (error) {
    if (error instanceof ProviderHttpError) {
      return jsonResponse({
        status: error.code,
        message: error.message,
      }, error.status);
    }

    return jsonResponse({
      status: "unavailable",
      message: "Base status provider is unavailable.",
    }, 503);
  }
}

export function readStatusRequest(
  body: Record<string, unknown>,
): BaseMcpStatusRequest {
  if (
    Object.keys(body).sort().join(",") !==
      "actionKind,chain,mode,protocol,requestId,requestedAt"
  ) {
    throw invalidRequest();
  }

  if (
    body.actionKind !== "base_mcp_status_check" ||
    body.protocol !== baseMcpStatusProviderProtocol ||
    body.chain !== "base" ||
    body.mode !== "read_only" ||
    typeof body.requestId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u.test(body.requestId) ||
    typeof body.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(body.requestedAt))
  ) {
    throw invalidRequest();
  }

  return {
    actionKind: body.actionKind,
    protocol: body.protocol,
    chain: body.chain,
    mode: body.mode,
    requestId: body.requestId,
    requestedAt: new Date(Date.parse(body.requestedAt)).toISOString(),
  };
}

export function normalizeBaseRpcUrl(value: string, provider: string) {
  try {
    const url = new URL(value.trim());

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid");
    }

    if (provider === "coinbase_cdp") {
      if (
        url.hostname !== "api.developer.coinbase.com" ||
        !/^\/rpc\/v1\/base\/[A-Za-z0-9_-]{16,256}$/u.test(url.pathname)
      ) {
        throw new Error("invalid");
      }

      return url.toString();
    }

    if (provider === "base_public_smoke") {
      if (
        url.hostname !== "mainnet.base.org" ||
        (url.pathname !== "/" && url.pathname !== "")
      ) {
        throw new Error("invalid");
      }

      return "https://mainnet.base.org/";
    }

    throw new Error("invalid");
  } catch {
    throw new ProviderHttpError(
      503,
      "unavailable",
      "Base status provider is unavailable.",
    );
  }
}

async function verifyBaseMainnet(baseRpcUrl: string, fetchRpc: typeof fetch) {
  const response = await fetchRpc(baseRpcUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
      id: "kyra-base-status",
    }),
    signal: AbortSignal.timeout(2000),
  });

  if (!response.ok) {
    throw new Error("Base RPC unavailable.");
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();

  if (contentType !== "application/json") {
    throw new Error("Base RPC response invalid.");
  }

  const text = await readBoundedText(response, maxBaseRpcResponseBytes);
  const value = JSON.parse(text);

  if (
    !isPlainRecord(value) ||
    value.jsonrpc !== "2.0" ||
    value.id !== "kyra-base-status" ||
    value.result !== baseMainnetChainId ||
    "error" in value
  ) {
    throw new Error("Base RPC response invalid.");
  }
}

async function assertBearerSecret(request: Request, expectedSecret: string) {
  if (!expectedSecret || expectedSecret.length < 32) {
    throw new ProviderHttpError(
      503,
      "unavailable",
      "Base status provider is unavailable.",
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const suppliedSecret = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7)
    : "";

  if (
    !suppliedSecret ||
    !(await constantTimeSecretEquals(suppliedSecret, expectedSecret))
  ) {
    throw new ProviderHttpError(
      401,
      "unauthorized",
      "Base status provider authorization failed.",
    );
  }
}

async function constantTimeSecretEquals(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }

  return mismatch === 0;
}

function assertPost(request: Request) {
  if (request.method !== "POST") {
    throw new ProviderHttpError(
      405,
      "method_not_allowed",
      "Base status provider requires POST.",
    );
  }
}

function assertStatusPath(request: Request) {
  if (
    new URL(request.url).pathname.replace(/\/+$/u, "") !==
      "/status-check" &&
    !new URL(request.url).pathname.replace(/\/+$/u, "").endsWith(
      "/status-check",
    )
  ) {
    throw new ProviderHttpError(
      404,
      "not_found",
      "Base status provider route was not found.",
    );
  }
}

function assertJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();

  if (contentType !== "application/json") {
    throw invalidRequest();
  }
}

function assertBodyLengthHeader(request: Request) {
  const value = request.headers.get("content-length");

  if (value === null) return;

  const length = Number(value);

  if (
    !Number.isSafeInteger(length) ||
    length < 0 ||
    length > maxBaseMcpStatusProviderBodyBytes
  ) {
    throw new ProviderHttpError(
      413,
      "payload_too_large",
      "Base status provider request is too large.",
    );
  }
}

async function readBoundedJsonObject(request: Request, maxBytes: number) {
  const text = await readBoundedText(request, maxBytes);
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw invalidRequest();
  }

  if (!isPlainRecord(value)) {
    throw invalidRequest();
  }

  return value;
}

async function readBoundedText(
  source: Request | Response,
  maxBytes: number,
) {
  if (!source.body) {
    throw invalidRequest();
  }

  const reader = source.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ProviderHttpError(
          413,
          "payload_too_large",
          "Base status provider request is too large.",
        );
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function assertFreshRequest(requestedAt: string, now: Date) {
  const requestedAtMs = Date.parse(requestedAt);
  const nowMs = now.getTime();

  if (
    !Number.isFinite(nowMs) ||
    requestedAtMs < nowMs - maxBaseMcpStatusProviderRequestAgeMs ||
    requestedAtMs > nowMs + maxBaseMcpStatusProviderFutureSkewMs
  ) {
    throw invalidRequest();
  }
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function invalidRequest() {
  return new ProviderHttpError(
    400,
    "invalid_request",
    "Base status provider request is invalid.",
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null);
}

class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
