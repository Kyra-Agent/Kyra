import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";
import type {
  ChainActionPrepareDependencies,
  ChainActionPrepareRequest,
} from "./core.ts";
import { readChainProviderStatusResponse } from "./provider-contract.ts";

export type ChainProviderTransport = (request: Request) => Promise<Response>;
type ChainActionAdapter = NonNullable<
  ChainActionPrepareDependencies["prepareChainAction"]
>;

export function createChainStatusCheckAdapter(
  transport: ChainProviderTransport = fetch,
): ChainActionAdapter {
  return async (input, runtimeConfig) => {
    if (input.actionKind !== "chain_status_check") {
      return blocked("chain_action_unknown", "This chain action is not supported.");
    }

    if (
      !runtimeConfig.endpoint ||
      !runtimeConfig.sharedSecret ||
      runtimeConfig.providerProtocol !== chainStatusProviderProtocol
    ) {
      return blocked(
        "chain_action_not_configured",
        "Chain action preparation is not configured.",
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      runtimeConfig.timeoutMs,
    );

    try {
      const response = await transport(new Request(
        createStatusUrl(runtimeConfig.endpoint),
        {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${runtimeConfig.sharedSecret}`,
            "content-type": "application/json",
            "x-kyra-action-kind": "chain_status_check",
          },
          body: JSON.stringify(createProviderRequest(input)),
          signal: controller.signal,
        },
      ));

      if (!response.ok) return unavailable();
      await readChainProviderStatusResponse(response, {
        requestId: input.requestId,
        chainKey: input.chainKey,
        chainId: input.chainId,
      });

      return {
        ok: true,
        status: "preview_ready",
        summary: {
          actionKind: "chain_status_check",
          chainKey: input.chainKey,
          chainId: input.chainId,
          chainName: runtimeConfig.chain.name,
          routeSummary: `${runtimeConfig.chain.name} status check only.`,
          valueSummary: "No token spend, gas request, calldata, or signature.",
          risk: "read-only",
          expiryIso: null,
        },
      };
    } catch (error) {
      if (isAbortError(error)) {
        return {
          ok: false,
          status: "failed",
          code: "chain_action_timeout",
          message: "Chain action preparation timed out.",
        };
      }
      return unavailable();
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

function createProviderRequest(input: ChainActionPrepareRequest) {
  return {
    actionKind: input.actionKind,
    protocol: chainStatusProviderProtocol,
    chainKey: input.chainKey,
    chainId: input.chainId,
    mode: input.mode,
    requestId: input.requestId,
    requestedAt: input.requestedAt,
  };
}

function createStatusUrl(endpoint: string) {
  const url = new URL(endpoint);
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/status-check`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function blocked(
  code: "chain_action_unknown" | "chain_action_not_configured",
  message: string,
) {
  return { ok: false as const, status: "blocked" as const, code, message };
}

function unavailable() {
  return {
    ok: false as const,
    status: "failed" as const,
    code: "chain_action_unavailable" as const,
    message: "No chain action can be prepared right now.",
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
