import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";
import { readChainProviderStatusResponse } from "./provider-contract.ts";

const expected = {
  requestId: "chain-status:request-1234",
  chainKey: "robinhood_testnet",
  chainId: 46630,
};

function response(overrides: Record<string, unknown> = {}, contentType = "application/json") {
  return new Response(JSON.stringify({
    protocol: chainStatusProviderProtocol,
    status: "ok",
    actionKind: "chain_status_check",
    chainKey: expected.chainKey,
    chainId: expected.chainId,
    mode: "read_only",
    requestId: expected.requestId,
    ...overrides,
  }), { headers: { "content-type": contentType } });
}

Deno.test("chain provider response reader accepts exact correlation", async () => {
  assertEquals((await readChainProviderStatusResponse(response(), expected)).status, "ok");
});

Deno.test("chain provider response reader rejects drift and extra fields", async () => {
  for (const candidate of [
    response({ chainId: 4663 }),
    response({ chainKey: "robinhood_mainnet" }),
    response({ requestId: "other-request" }),
    response({ extra: true }),
    response({}, "text/plain"),
  ]) {
    await assertRejects(
      () => readChainProviderStatusResponse(candidate, expected),
      Error,
      "Chain provider response is invalid.",
    );
  }
});
