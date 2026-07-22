import type {
  ChainRpcProviderKind,
  ChainStatusProviderRuntimeConfig,
} from "./runtime-config.ts";

export const chainStatusProviderProtocol = "kyra_chain_status_v1" as const;
export const maxChainStatusProviderBodyBytes = 2048;
export const maxChainStatusProviderRequestAgeMs = 60_000;
export const maxChainStatusProviderFutureSkewMs = 10_000;
export const maxChainRpcResponseBytes = 2048;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

interface ChainStatusProviderDependencies {
  runtimeConfig: ChainStatusProviderRuntimeConfig;
  getNow?: () => Date;
  fetchRpc?: typeof fetch;
}

interface ChainStatusRequest {
  actionKind: "chain_status_check";
  protocol: typeof chainStatusProviderProtocol;
  chainKey: string;
  chainId: number;
  mode: "read_only";
  requestId: string;
  requestedAt: string;
}

export async function handleChainStatusProviderRequest(
  request: Request,
  dependencies: ChainStatusProviderDependencies,
) {
  if (!dependencies.runtimeConfig.enabled) {
    return jsonResponse({
      status: "disabled",
      message: "Chain status provider is disabled.",
    }, 501);
  }

  try {
    assertPost(request);
    assertStatusPath(request);
    assertJsonContentType(request);
    assertBodyLengthHeader(request);
    await assertBearerSecret(
      request,
      dependencies.runtimeConfig.expectedBearerSecret,
    );

    const body = await readBoundedJsonObject(
      request,
      maxChainStatusProviderBodyBytes,
    );
    const statusRequest = readStatusRequest(body);
    const { chain } = dependencies.runtimeConfig;

    if (
      statusRequest.chainKey !== chain.key ||
      statusRequest.chainId !== chain.chainId
    ) {
      throw invalidRequest();
    }

    assertFreshRequest(
      statusRequest.requestedAt,
      dependencies.getNow?.() ?? new Date(),
    );
    const rpcUrl = normalizeChainRpcUrl(
      dependencies.runtimeConfig.rpcUrl,
      dependencies.runtimeConfig.providerKind,
      dependencies.runtimeConfig.allowedRpcHosts,
      chain.key,
    );
    await verifyChainId(
      rpcUrl,
      chain.chainIdHex,
      dependencies.fetchRpc ?? fetch,
    );

    return jsonResponse({
      protocol: chainStatusProviderProtocol,
      status: "ok",
      actionKind: "chain_status_check",
      chainKey: chain.key,
      chainId: chain.chainId,
      mode: "read_only",
      requestId: statusRequest.requestId,
    }, 200);
  } catch (error) {
    if (error instanceof ProviderHttpError) {
      return jsonResponse({ status: error.code, message: error.message }, error.status);
    }

    return jsonResponse({
      status: "unavailable",
      message: "Chain status provider is unavailable.",
    }, 503);
  }
}

export function readStatusRequest(
  body: Record<string, unknown>,
): ChainStatusRequest {
  if (
    Object.keys(body).sort().join(",") !==
      "actionKind,chainId,chainKey,mode,protocol,requestId,requestedAt" ||
    body.actionKind !== "chain_status_check" ||
    body.protocol !== chainStatusProviderProtocol ||
    typeof body.chainKey !== "string" ||
    !/^[a-z][a-z0-9_]{1,63}$/u.test(body.chainKey) ||
    !Number.isSafeInteger(body.chainId) ||
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
    chainKey: body.chainKey,
    chainId: body.chainId as number,
    mode: body.mode,
    requestId: body.requestId,
    requestedAt: new Date(Date.parse(body.requestedAt)).toISOString(),
  };
}

export function normalizeChainRpcUrl(
  value: string,
  providerKind: ChainRpcProviderKind,
  allowedHosts: readonly string[],
  chainKey: string,
) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname.length > 512
    ) {
      throw new Error("invalid");
    }

    if (providerKind === "robinhood_public_testnet") {
      if (
        chainKey !== "robinhood_testnet" ||
        hostname !== "rpc.testnet.chain.robinhood.com" ||
        (url.pathname !== "/" && url.pathname !== "")
      ) {
        throw new Error("invalid");
      }

      return "https://rpc.testnet.chain.robinhood.com/";
    }

    if (
      providerKind !== "managed_private" ||
      !allowedHosts.includes(hostname) ||
      hostname === "rpc.mainnet.chain.robinhood.com" ||
      hostname === "rpc.testnet.chain.robinhood.com"
    ) {
      throw new Error("invalid");
    }

    return url.toString();
  } catch {
    throw unavailable();
  }
}

async function verifyChainId(
  rpcUrl: string,
  expectedChainIdHex: string,
  fetchRpc: typeof fetch,
) {
  const response = await fetchRpc(rpcUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
      id: "kyra-chain-status",
    }),
    signal: AbortSignal.timeout(2000),
  });

  if (!response.ok) throw new Error("RPC unavailable.");

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") throw new Error("RPC invalid.");

  const text = await readBoundedText(response, maxChainRpcResponseBytes);
  const value = JSON.parse(text);

  if (
    !isPlainRecord(value) ||
    value.jsonrpc !== "2.0" ||
    value.id !== "kyra-chain-status" ||
    value.result !== expectedChainIdHex ||
    "error" in value
  ) {
    throw new Error("RPC invalid.");
  }
}

async function assertBearerSecret(request: Request, expectedSecret: string) {
  if (!expectedSecret || expectedSecret.length < 32) throw unavailable();

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
      "Chain status provider authorization failed.",
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
    throw new ProviderHttpError(405, "method_not_allowed", "Chain status provider requires POST.");
  }
}

function assertStatusPath(request: Request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "");
  if (pathname !== "/status-check" && !pathname.endsWith("/status-check")) {
    throw new ProviderHttpError(404, "not_found", "Chain status provider route was not found.");
  }
}

function assertJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();
  if (contentType !== "application/json") throw invalidRequest();
}

function assertBodyLengthHeader(request: Request) {
  const value = request.headers.get("content-length");
  if (value === null) return;
  const length = Number(value);
  if (!Number.isSafeInteger(length) || length < 0 || length > maxChainStatusProviderBodyBytes) {
    throw new ProviderHttpError(413, "payload_too_large", "Chain status provider request is too large.");
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
  if (!isPlainRecord(value)) throw invalidRequest();
  return value;
}

async function readBoundedText(source: Request | Response, maxBytes: number) {
  if (!source.body) throw invalidRequest();
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
        throw new ProviderHttpError(413, "payload_too_large", "Chain status provider payload is too large.");
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
    requestedAtMs < nowMs - maxChainStatusProviderRequestAgeMs ||
    requestedAtMs > nowMs + maxChainStatusProviderFutureSkewMs
  ) {
    throw invalidRequest();
  }
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function invalidRequest() {
  return new ProviderHttpError(400, "invalid_request", "Chain status provider request is invalid.");
}

function unavailable() {
  return new ProviderHttpError(503, "unavailable", "Chain status provider is unavailable.");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
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
