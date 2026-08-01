import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
} from "npm:viem@2.52.2";
import { HttpError, type StoredSwapExecutionIntent } from "./core.ts";
import {
  kyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";
import { swapExecutionPolicyVersion } from "../_shared/swap-execution-policy.ts";
import {
  readReceiptRpcConfig,
  verifySwapExecutionReceipt,
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

const ownerUserId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";
const quoteReviewId = "44444444-4444-4444-8444-444444444444";
const sender = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";
const spender = "0x0000000000001fF3684f28c67538d4D072C22734";
const txHash = `0x${"a".repeat(64)}`;

function intent(
  step: "allowance_set" | "swap" | "allowance_revoke",
): StoredSwapExecutionIntent {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    owner_user_id: ownerUserId,
    workspace_id: workspaceId,
    agent_id: agentId,
    quote_review_id: quoteReviewId,
    request_id: `swap:${step}:0001`,
    step,
    chain_key: robinhoodMainnetChainKey,
    chain_id: robinhoodMainnetChainId,
    sender_address: sender,
    transaction_to: step === "swap" ? target : kyraTokenAddress,
    transaction_data: "0x1234",
    transaction_value_wei: step === "swap" ? "7" : "0",
    token_address: step === "swap" ? null : kyraTokenAddress,
    spender_address: step === "swap" ? null : spender,
    allowance_amount_atomic: step === "swap"
      ? null
      : step === "allowance_set"
      ? "1000000000000000000"
      : "0",
    status: "approved",
    policy_version: swapExecutionPolicyVersion,
    expires_at: "2030-01-01T00:00:00.000Z",
  };
}

function approvalLog(stored: StoredSwapExecutionIntent, value?: bigint) {
  return {
    address: stored.token_address,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Approval",
      args: {
        owner: stored.sender_address as `0x${string}`,
        spender: stored.spender_address as `0x${string}`,
      },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [
      value ?? BigInt(stored.allowance_amount_atomic ?? "0"),
    ]),
  };
}

function rpcFetch(
  stored: StoredSwapExecutionIntent,
  options: {
    chainId?: string;
    transaction?: Record<string, unknown>;
    receipt?: Record<string, unknown> | null;
  } = {},
): typeof fetch {
  return (async (_input, init) => {
    const requestInit = init as { body?: BodyInit | null; redirect?: string };
    assert(requestInit.redirect === "error", "RPC redirects must be rejected");
    const request = JSON.parse(String(requestInit.body)) as { method: string };
    const transaction = {
      hash: txHash,
      from: stored.sender_address,
      to: stored.transaction_to,
      value: `0x${BigInt(stored.transaction_value_wei).toString(16)}`,
      input: stored.transaction_data,
      chainId: "0x1237",
      ...options.transaction,
    };
    const defaultReceipt = {
      transactionHash: txHash,
      from: stored.sender_address,
      to: stored.transaction_to,
      status: "0x1",
      blockNumber: "0x2a",
      logs: stored.step === "swap" ? [] : [approvalLog(stored)],
    };
    const result = request.method === "eth_chainId"
      ? options.chainId ?? "0x1237"
      : request.method === "eth_getTransactionByHash"
      ? transaction
      : options.receipt === undefined
      ? defaultReceipt
      : options.receipt;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

Deno.test("swap receipt RPC requires HTTPS and an allowlisted host", () => {
  const config = readReceiptRpcConfig((key) =>
    ({
      KYRA_ROBINHOOD_MAINNET_RPC_URL: "https://rpc.example.test/path",
      KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS: "rpc.example.test",
    })[key]
  );
  assert(config.rpcUrl === "https://rpc.example.test/path", "URL expected");

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
      "insecure RPC must fail closed",
    );
    return;
  }
  throw new Error("expected insecure RPC rejection");
});

Deno.test("exact reviewed swap transaction confirms", async () => {
  const stored = intent("swap");
  const result = await verifySwapExecutionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent: stored,
    fetchImpl: rpcFetch(stored),
  });
  assert(result.status === "confirmed", "confirmed swap expected");
  assert(result.blockNumber === 42, "block number expected");
});

Deno.test("swap receipt rejects transaction shape mutation", async () => {
  const stored = intent("swap");
  for (
    const mutation of [
      { input: "0x5678" },
      { value: "0x0" },
      { from: target },
      { to: sender },
    ]
  ) {
    await assertRejectsCode(
      () =>
        verifySwapExecutionReceipt({
          rpcUrl: "https://rpc.example.test",
          txHash,
          intent: stored,
          fetchImpl: rpcFetch(stored, { transaction: mutation }),
        }),
      "receipt_scope_mismatch",
    );
  }
});

Deno.test("allowance confirmation requires exact Approval event", async () => {
  const stored = intent("allowance_set");
  const result = await verifySwapExecutionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent: stored,
    fetchImpl: rpcFetch(stored),
  });
  assert(result.status === "confirmed", "exact approval should confirm");

  await assertRejectsCode(
    () =>
      verifySwapExecutionReceipt({
        rpcUrl: "https://rpc.example.test",
        txHash,
        intent: stored,
        fetchImpl: rpcFetch(stored, {
          receipt: {
            transactionHash: txHash,
            from: stored.sender_address,
            to: stored.transaction_to,
            status: "0x1",
            blockNumber: "0x2a",
            logs: [approvalLog(stored, 1n)],
          },
        }),
      }),
    "receipt_approval_event_mismatch",
  );
});

Deno.test("allowance revoke requires a zero-value Approval event", async () => {
  const stored = intent("allowance_revoke");
  const result = await verifySwapExecutionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent: stored,
    fetchImpl: rpcFetch(stored),
  });
  assert(result.status === "confirmed", "zero-value revoke should confirm");

  await assertRejectsCode(
    () =>
      verifySwapExecutionReceipt({
        rpcUrl: "https://rpc.example.test",
        txHash,
        intent: stored,
        fetchImpl: rpcFetch(stored, {
          receipt: {
            transactionHash: txHash,
            from: stored.sender_address,
            to: stored.transaction_to,
            status: "0x1",
            blockNumber: "0x2a",
            logs: [approvalLog(stored, 1n)],
          },
        }),
      }),
    "receipt_approval_event_mismatch",
  );
});

Deno.test("wrong chain fails and missing receipt stays submitted", async () => {
  const stored = intent("swap");
  await assertRejectsCode(
    () =>
      verifySwapExecutionReceipt({
        rpcUrl: "https://rpc.example.test",
        txHash,
        intent: stored,
        fetchImpl: rpcFetch(stored, { chainId: "0x1" }),
      }),
    "receipt_chain_mismatch",
  );

  const pending = await verifySwapExecutionReceipt({
    rpcUrl: "https://rpc.example.test",
    txHash,
    intent: stored,
    fetchImpl: rpcFetch(stored, { receipt: null }),
  });
  assert(pending.status === "submitted", "missing receipt should stay pending");
});
