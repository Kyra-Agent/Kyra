import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";

export const maxChainProviderResponseBytes = 4096;

export interface ChainProviderStatusResponse {
  protocol: typeof chainStatusProviderProtocol;
  status: "ok";
  actionKind: "chain_status_check";
  chainKey: string;
  chainId: number;
  mode: "read_only";
  requestId: string;
}

export async function readChainProviderStatusResponse(
  response: Response,
  expected: { requestId: string; chainKey: string; chainId: number },
): Promise<ChainProviderStatusResponse> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase() ?? "";
  if (contentType !== "application/json") throw invalidResponse();

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > maxChainProviderResponseBytes
    ) {
      throw invalidResponse();
    }
  }

  const text = await readBoundedResponseText(response);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw invalidResponse();
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "actionKind,chainId,chainKey,mode,protocol,requestId,status"
  ) {
    throw invalidResponse();
  }

  const record = value as Record<string, unknown>;
  if (
    record.protocol !== chainStatusProviderProtocol ||
    record.status !== "ok" ||
    record.actionKind !== "chain_status_check" ||
    record.chainKey !== expected.chainKey ||
    record.chainId !== expected.chainId ||
    record.mode !== "read_only" ||
    record.requestId !== expected.requestId
  ) {
    throw invalidResponse();
  }

  return record as unknown as ChainProviderStatusResponse;
}

async function readBoundedResponseText(response: Response) {
  if (!response.body) throw invalidResponse();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxChainProviderResponseBytes) {
        await reader.cancel();
        throw invalidResponse();
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function invalidResponse() {
  return new Error("Chain provider response is invalid.");
}
