import { HttpError, type StoredTransactionIntent } from "./core.ts";
import {
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";
import {
  readReceiptRpcConfig,
  verifyTransactionReceipt,
} from "./receipt-verifier.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejectsCode(run: () => Promise<unknown>, code: string) {
  try {
    await run();
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, `expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error("expected promise to reject");
}

const recipient = "0x1111111111111111111111111111111111111111";
const txHash = "0x" + "a".repeat(64);
const intent: StoredTransactionIntent = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  agent_id: "33333333-3333-4333-8333-333333333333",
  request_id: "phase8-agent-wallet",
  action_kind: "robinhood_reviewed_transaction",
  chain_key: "robinhood_mainnet",
  chain_id: 4663,
  status: "approved",
  recipient,
  value_wei: ownerTransactionValueWei,
  calldata: "0x",
  policy_version: ownerTransactionPolicyVersion,
  expires_at: "2030-01-01T00:00:00.000Z",
};

function rpcFetch(overrides: Record<string, unknown> = {}): typeof fetch {
  return (async (_input, init) => {
    const requestInit = init as
      | { body?: BodyInit | null; redirect?: string }
      | undefined;
    const body = requestInit?.body;
    assert(
      requestInit?.redirect === "error",
      "RPC requests must reject redirects",
    );
    const request = JSON.parse(String(body)) as { method: string };
    const transaction = {
      hash: txHash,
      from: recipient,
      to: recipient,
      value: `0x${BigInt(ownerTransactionValueWei).toString(16)}`,
      input: "0x",
      chainId: "0x1237",
      ...overrides,
    };
    const result = request.method === "eth_chainId"
      ? "0x1237"
      : request.method === "eth_getTransactionByHash"
      ? transaction
      : {
        transactionHash: txHash,
        from: recipient,
        to: recipient,
        status: "0x1",
        blockNumber: "0x2a",
      };
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

Deno.test("receipt RPC config requires HTTPS and an allowlisted host", () => {
  const config = readReceiptRpcConfig((key) =>
    ({
      KYRA_ROBINHOOD_MAINNET_RPC_URL: "https://rpc.example.test/path",
      KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS:
        "rpc.example.test,backup.example.test",
    })[key]
  );
  assert(
    config.rpcUrl === "https://rpc.example.test/path",
    "normalized RPC URL expected",
  );

  try {
    readReceiptRpcConfig((key) =>
      ({
        KYRA_ROBINHOOD_MAINNET_RPC_URL: "http://rpc.example.test",
        KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS: "rpc.example.test",
      })[key]
    );
  } catch (error) {
    assert(
      error instanceof HttpError && error.code === "receipt_rpc_invalid",
      "HTTP RPC must fail closed",
    );
    return;
  }
  throw new Error("expected insecure RPC to be rejected");
});

Deno.test("receipt verification derives confirmed state from Robinhood Chain", async () => {
  const result = await verifyTransactionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent,
    fetchImpl: rpcFetch(),
    now: new Date("2026-07-26T12:00:00.000Z"),
  });
  assert(result.status === "confirmed", "confirmed receipt expected");
  assert(
    result.failureCode === null,
    "confirmed receipt cannot have a failure code",
  );
  assert(
    result.blockNumber === 42,
    "receipt block should be parsed server-side",
  );
});

Deno.test("receipt verification rejects a transaction shape mutation", async () => {
  const mutations = [
    { value: "0x1" },
    { input: "0x00" },
    { from: "0x2222222222222222222222222222222222222222" },
    { to: "0x2222222222222222222222222222222222222222" },
  ];

  for (const mutation of mutations) {
    await assertRejectsCode(
      () =>
        verifyTransactionReceipt({
          rpcUrl: "https://rpc.example.test",
          txHash,
          intent,
          fetchImpl: rpcFetch(mutation),
        }),
      "receipt_scope_mismatch",
    );
  }
});
