import type { BaseMcpPrepareDependencies } from "./core.ts";

export type BaseMcpProviderTransport = (
  request: Request,
) => Promise<Response>;

type BaseMcpPrepareAdapter = NonNullable<
  BaseMcpPrepareDependencies["prepareBaseMcpAction"]
>;

const baseMcpStatusPath = "/status-check";

export function createBaseMcpStatusCheckAdapter(
  transport: BaseMcpProviderTransport = fetch,
): BaseMcpPrepareAdapter {
  return async (input, runtimeConfig) => {
    if (input.actionKind !== "base_mcp_status_check") {
      return {
        ok: false,
        status: "blocked",
        code: "base_mcp_unknown_action",
        message: "This Base MCP action is not supported.",
      };
    }

    if (!runtimeConfig.endpoint) {
      return {
        ok: false,
        status: "blocked",
        code: "base_mcp_not_configured",
        message: "Base MCP preparation is not configured.",
      };
    }

    if (runtimeConfig.providerProtocol !== "kyra_status_v1") {
      return {
        ok: false,
        status: "blocked",
        code: "base_mcp_not_configured",
        message: "Base MCP preparation is not configured.",
      };
    }

    try {
      const statusCheckRequest = createBaseMcpStatusCheckRequest(
        input,
        {
          endpoint: runtimeConfig.endpoint,
          apiKey: runtimeConfig.apiKey,
          timeoutMs: runtimeConfig.timeoutMs,
        },
      );

      const response = await transport(statusCheckRequest.request).finally(
        statusCheckRequest.clearTimeout,
      );

      if (!response.ok) {
        return createBaseMcpUnavailableFailure();
      }

      await readProviderJsonObject(response);

      return {
        ok: true,
        status: "preview_ready",
        summary: {
          actionKind: "base_mcp_status_check",
          chain: "Base",
          routeSummary: "Base MCP status check only.",
          valueSummary: "No token spend, no gas request, no calldata.",
          risk: "read-only",
          expiryIso: null,
          opaquePayloadRef: null,
        },
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          status: "failed",
          code: "base_mcp_timeout",
          message: "Base MCP preparation timed out.",
        };
      }

      return createBaseMcpUnavailableFailure();
    }
  };
}

function createBaseMcpStatusCheckRequest(
  input: Parameters<BaseMcpPrepareAdapter>[0],
  runtimeConfig: { endpoint: string; apiKey: string | null; timeoutMs: number },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    runtimeConfig.timeoutMs,
  );
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "x-kyra-action-kind": "base_mcp_status_check",
  });

  if (runtimeConfig.apiKey) {
    headers.set("authorization", `Bearer ${runtimeConfig.apiKey}`);
  }

  const request = new Request(createStatusCheckUrl(runtimeConfig.endpoint), {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionKind: input.actionKind,
      chain: input.chain,
      mode: input.mode,
      requestId: input.requestId,
      requestedAt: input.requestedAt,
    }),
    signal: controller.signal,
  });

  request.signal.addEventListener("abort", () => clearTimeout(timeoutId), {
    once: true,
  });

  return {
    request,
    clearTimeout: () => clearTimeout(timeoutId),
  };
}

function createStatusCheckUrl(endpoint: string) {
  return new URL(baseMcpStatusPath, endpoint).toString();
}

async function readProviderJsonObject(response: Response) {
  const body = await response.json().catch(() => null);

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error("Base MCP provider response is invalid.");
  }

  return body as Record<string, unknown>;
}

function createBaseMcpUnavailableFailure() {
  return {
    ok: false as const,
    status: "failed" as const,
    code: "base_mcp_unavailable" as const,
    message: "No Base MCP action can be prepared right now.",
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
