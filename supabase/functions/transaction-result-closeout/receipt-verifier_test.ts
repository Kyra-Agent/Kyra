import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
} from "npm:viem@2.52.2";
import { HttpError, type StoredTransactionIntent } from "./core.ts";
import {
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";
import {
  encodeKyraTransferData,
  kyraTokenAddress,
  transferTransactionPolicyVersion,
} from "../_shared/transfer-transaction-policy.ts";
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

const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const txHash = `0x${"a".repeat(64)}`;
const intentBase = {
  id: "11111111-1111-4111-8111-111111111111",
  workspace_id: "22222222-2222-4222-8222-222222222222",
  agent_id: "33333333-3333-4333-8333-333333333333",
  action_kind: "robinhood_reviewed_transaction" as const,
  chain_key: "robinhood_mainnet" as const,
  chain_id: 4663 as const,
  status: "approved" as const,
  token_decimals: 18 as const,
  expires_at: "2030-01-01T00:00:00.000Z",
};
const legacyIntent: StoredTransactionIntent = {
  ...intentBase,
  request_id: "phase8-agent-wallet",
  sender_address: sender,
  recipient: sender,
  asset_kind: "native",
  token_address: null,
  token_symbol: "ETH",
  amount_atomic: ownerTransactionValueWei,
  value_wei: ownerTransactionValueWei,
  calldata: "0x",
  policy_version: ownerTransactionPolicyVersion,
};
const nativeAmount = "1000000000000000";
const nativeIntent: StoredTransactionIntent = {
  ...intentBase,
  request_id: "transfer-native-review",
  sender_address: sender,
  recipient,
  asset_kind: "native",
  token_address: null,
  token_symbol: "ETH",
  amount_atomic: nativeAmount,
  value_wei: nativeAmount,
  calldata: "0x",
  policy_version: transferTransactionPolicyVersion,
};
const kyraAmount = 125_000_000_000_000_000_000n;
const kyraIntent: StoredTransactionIntent = {
  ...intentBase,
  request_id: "transfer-kyra-review",
  sender_address: sender,
  recipient,
  asset_kind: "erc20",
  token_address: kyraTokenAddress,
  token_symbol: "KYRA",
  amount_atomic: kyraAmount.toString(),
  value_wei: "0",
  calldata: encodeKyraTransferData(recipient, kyraAmount),
  policy_version: transferTransactionPolicyVersion,
};

function rpcFetch(
  intent: StoredTransactionIntent,
  transactionOverrides: Record<string, unknown> = {},
  receiptOverrides: Record<string, unknown> = {},
): typeof fetch {
  return (async (_input, init) => {
    const requestInit = init as
      | { body?: BodyInit | null; redirect?: string }
      | undefined;
    assert(
      requestInit?.redirect === "error",
      "RPC requests must reject redirects",
    );
    const request = JSON.parse(String(requestInit?.body)) as { method: string };
    const transaction = {
      hash: txHash,
      from: intent.sender_address,
      to: intent.asset_kind === "native"
        ? intent.recipient
        : intent.token_address,
      value: `0x${BigInt(intent.value_wei).toString(16)}`,
      input: intent.calldata,
      chainId: "0x1237",
      ...transactionOverrides,
    };
    const logs = intent.asset_kind === "erc20"
      ? [{
        address: intent.token_address,
        topics: encodeEventTopics({
          abi: erc20Abi,
          eventName: "Transfer",
          args: {
            from: intent.sender_address as `0x${string}`,
            to: intent.recipient as `0x${string}`,
          },
        }),
        data: encodeAbiParameters([{ type: "uint256" }], [
          BigInt(intent.amount_atomic),
        ]),
      }]
      : [];
    const result = request.method === "eth_chainId"
      ? "0x1237"
      : request.method === "eth_getTransactionByHash"
      ? transaction
      : {
        transactionHash: txHash,
        from: intent.sender_address,
        to: intent.asset_kind === "native"
          ? intent.recipient
          : intent.token_address,
        status: "0x1",
        blockNumber: "0x2a",
        logs,
        ...receiptOverrides,
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

Deno.test("receipt verification supports legacy and T1 native transfers", async () => {
  for (const intent of [legacyIntent, nativeIntent]) {
    const result = await verifyTransactionReceipt({
      rpcUrl: "https://rpc.example.test",
      txHash,
      intent,
      fetchImpl: rpcFetch(intent),
      now: new Date("2026-07-26T12:00:00.000Z"),
    });
    assert(result.status === "confirmed", "confirmed receipt expected");
    assert(result.blockNumber === 42, "receipt block expected");
  }
});

Deno.test("receipt verification requires the exact KYRA Transfer event", async () => {
  const result = await verifyTransactionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent: kyraIntent,
    fetchImpl: rpcFetch(kyraIntent),
  });
  assert(result.status === "confirmed", "confirmed KYRA transfer expected");

  const badLogs = [{
    address: kyraTokenAddress,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Transfer",
      args: { from: sender, to: recipient },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [1n]),
  }];
  await assertRejectsCode(
    () =>
      verifyTransactionReceipt({
        rpcUrl: "https://rpc.example.test",
        txHash,
        intent: kyraIntent,
        fetchImpl: rpcFetch(kyraIntent, {}, { logs: badLogs }),
      }),
    "receipt_transfer_event_mismatch",
  );
});

Deno.test("receipt verification rejects transaction shape mutations", async () => {
  const mutations = [
    { value: "0x1" },
    { input: "0x00" },
    { from: recipient },
    { to: "0x4444444444444444444444444444444444444444" },
  ];

  for (const mutation of mutations) {
    await assertRejectsCode(
      () =>
        verifyTransactionReceipt({
          rpcUrl: "https://rpc.example.test",
          txHash,
          intent: nativeIntent,
          fetchImpl: rpcFetch(nativeIntent, mutation),
        }),
      "receipt_scope_mismatch",
    );
  }
});
