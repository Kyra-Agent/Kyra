export const baseMcpProviderProtocol = "kyra_status_v1" as const;
export const maxBaseMcpProviderResponseBytes = 4096;

export interface BaseMcpProviderStatusResponse {
  protocol: typeof baseMcpProviderProtocol;
  status: "ok";
  actionKind: "base_mcp_status_check";
  chain: "base";
  mode: "read_only";
  requestId: string;
}

export async function readBaseMcpProviderStatusResponse(
  response: Response,
  expectedRequestId: string,
): Promise<BaseMcpProviderStatusResponse> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase() ?? "";

  if (contentType !== "application/json") {
    throw new Error("Base MCP provider response is invalid.");
  }

  const contentLength = response.headers.get("content-length");

  if (contentLength !== null) {
    const parsedLength = Number(contentLength);

    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > maxBaseMcpProviderResponseBytes
    ) {
      throw new Error("Base MCP provider response is invalid.");
    }
  }

  const text = await readBoundedResponseText(response);
  let value: unknown;

  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Base MCP provider response is invalid.");
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !==
      "actionKind,chain,mode,protocol,requestId,status"
  ) {
    throw new Error("Base MCP provider response is invalid.");
  }

  const record = value as Record<string, unknown>;

  if (
    record.protocol !== baseMcpProviderProtocol ||
    record.status !== "ok" ||
    record.actionKind !== "base_mcp_status_check" ||
    record.chain !== "base" ||
    record.mode !== "read_only" ||
    record.requestId !== expectedRequestId
  ) {
    throw new Error("Base MCP provider response is invalid.");
  }

  return record as unknown as BaseMcpProviderStatusResponse;
}

async function readBoundedResponseText(response: Response) {
  if (!response.body) {
    throw new Error("Base MCP provider response is invalid.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > maxBaseMcpProviderResponseBytes) {
        await reader.cancel();
        throw new Error("Base MCP provider response is invalid.");
      }

      text += decoder.decode(value, { stream: true });
    }

    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return text;
}
