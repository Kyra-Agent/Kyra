import { toEventSelector } from "npm:viem@2.57.7";
import { HttpError } from "./core.ts";
import {
  createBatchRpc,
  extractChainDataTargets,
  formatAmount,
  hasChainDataTargets,
  readChainDataRpcConfig,
  readLiveChainData,
} from "./chain-data.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

const wallet = "0xb3921dc28f3456596ef4e08dd2a430a605c74928";
const token = "0x1cad5848e7556fa9272302264e3cb2904bde77ac";
const usdg = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const counterparty = "0xd05700000000000000000000000000000000035e5".slice(0, 42);
const txHash = `0x${"ab".repeat(32)}`;
const transferTopic = toEventSelector("Transfer(address,address,uint256)");

function pad(address: string) {
  return `0x${address.slice(2).padStart(64, "0")}`;
}

function uint(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function abiString(value: string) {
  const hex = [...new TextEncoder().encode(value)]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `0x${"20".padStart(64, "0")}${value.length.toString(16).padStart(64, "0")}${
    hex.padEnd(Math.ceil(hex.length / 64) * 64 || 64, "0")
  }`;
}

// Minimal Robinhood Chain JSON-RPC stand-in: one wallet, one token, one tx.
function createFakeRpc(options: { chainId?: string; status?: number } = {}) {
  const calls: string[] = [];

  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    if (options.status) {
      return new Response("busy", { status: options.status });
    }

    const batch = JSON.parse(String(init?.body)) as Array<{
      id: number;
      method: string;
      params: Array<Record<string, unknown> | string>;
    }>;

    const results = batch.map((call) => {
      calls.push(call.method);
      const [first] = call.params;
      const target = typeof first === "object" ? String(first.to ?? "") : String(first ?? "");
      const data = typeof first === "object" ? String(first.data ?? "") : "";

      switch (call.method) {
        case "eth_chainId":
          return options.chainId ?? "0x1237";
        case "eth_blockNumber":
          return "0x100000";
        case "eth_getCode":
          return target === token || target === usdg ? "0x6080" : "0x";
        case "eth_getBalance":
          return target === wallet ? "0x0d8826f4b6a60000" : "0x0";
        case "eth_getTransactionCount":
          return "0x35";
        case "eth_call": {
          const isToken = target === token || target === usdg;
          if (!isToken) return "0x";
          if (data === "0x06fdde03") return abiString(target === token ? "Mitsu" : "Global Dollar");
          if (data === "0x95d89b41") return abiString(target === token ? "MITSU" : "USDG");
          if (data === "0x313ce567") return uint(target === token ? 18n : 6n);
          if (data === "0x18160ddd") return uint(1_000_000n * 10n ** 18n);
          if (data.startsWith("0x70a08231")) {
            return uint(target === usdg ? 1_525_120n : target === token ? 2_099n * 10n ** 12n : 0n);
          }
          return "0x";
        }
        case "eth_getLogs": {
          const filter = first as Record<string, unknown>;
          if (filter.address) {
            return [{}, {}, {}];
          }
          const topics = filter.topics as Array<string | null>;
          if (topics[2] === pad(wallet)) {
            return [{
              address: usdg,
              topics: [transferTopic, pad(counterparty), pad(wallet)],
              data: uint(1_525_120n),
              blockNumber: "0xffff00",
              logIndex: "0x1",
              transactionHash: txHash,
            }];
          }
          return [];
        }
        case "eth_getTransactionByHash":
          return { from: wallet, to: counterparty, value: "0x0", blockNumber: "0xffff00" };
        case "eth_getTransactionReceipt":
          return {
            status: "0x1",
            logs: [{
              address: usdg,
              topics: [transferTopic, pad(counterparty), pad(wallet)],
              data: uint(1_525_120n),
              blockNumber: "0xffff00",
              logIndex: "0x1",
              transactionHash: txHash,
            }],
          };
        default:
          return null;
      }
    });

    return new Response(
      JSON.stringify(results.map((result, index) => ({
        jsonrpc: "2.0",
        id: batch[index].id,
        result,
      }))),
      { status: 200 },
    );
  }) as typeof fetch;

  return { fetchImpl, calls };
}

Deno.test("chain data extracts addresses and tx hashes without confusing them", () => {
  const targets = extractChainDataTargets(
    `wallet ${wallet.toUpperCase().replace("0X", "0x")} token ${token} tx ${txHash}`,
  );

  assertEquals(targets.addresses.join(","), `${wallet},${token}`);
  assertEquals(targets.txHash, txHash);
  assertEquals(extractChainDataTargets("plan my launch").addresses.length, 0);
  assert(!hasChainDataTargets(extractChainDataTargets("hello")), "Plain chat has no targets.");
});

Deno.test("chain data reuses the last remembered address for follow-ups", () => {
  const history = [
    { role: "user", content: `check ${wallet}` },
    { role: "assistant", content: `Wallet ${token} looks fine` },
  ];

  assertEquals(
    extractChainDataTargets("what about its recent transfers?", history).addresses[0],
    wallet,
  );
  assertEquals(
    extractChainDataTargets("write a launch tweet", history).addresses.length,
    0,
  );
});

Deno.test("chain data RPC config requires https and an allowlisted host", () => {
  const env = (url: string, hosts = "rpc.example.com") => (key: string) =>
    key === "KYRA_ROBINHOOD_MAINNET_RPC_URL" ? url : hosts;

  assertEquals(
    readChainDataRpcConfig(env("https://rpc.example.com/key"))?.rpcUrl,
    "https://rpc.example.com/key",
  );
  assertEquals(readChainDataRpcConfig(env("http://rpc.example.com")), null);
  assertEquals(readChainDataRpcConfig(env("https://evil.example.net")), null);
  assertEquals(readChainDataRpcConfig(env("https://u:p@rpc.example.com")), null);
  assertEquals(readChainDataRpcConfig(() => undefined), null);
});

Deno.test("chain data describes a wallet, a token, a holder check, and a transaction", async () => {
  const { fetchImpl } = createFakeRpc();
  const text = await readLiveChainData({
    targets: { addresses: [wallet, token], txHash },
    rpcUrl: "https://rpc.example.com",
    fetchImpl,
  });

  assert(text.startsWith("Live Robinhood Chain data, read at block 1,048,576"), text);
  assert(text.includes(`Wallet ${wallet}`), "Wallet section missing.");
  assert(text.includes("- ETH: 0.975072"), "ETH balance must be formatted to six decimals.");
  assert(text.includes("- USDG: 1.52512"), "Core token balance missing.");
  assert(text.includes("- Transactions sent from this wallet: 53"), "Nonce missing.");
  assert(text.includes("- In: 1.52512 USDG from"), "Incoming transfer missing.");
  assert(text.includes("Holder check:") && text.includes("holds MITSU"), "Holder check missing.");
  assert(text.includes(`Token ${token}`) && text.includes("Mitsu (MITSU), 18 decimals"), "Token section missing.");
  assert(text.includes("Total supply: 1,000,000 MITSU"), "Supply missing.");
  assert(text.includes("Transfers in the last ~5 min: 3"), "Token activity missing.");
  assert(text.includes("- Status: succeeded"), "Transaction status missing.");
  assert(text.includes("Not included: holder counts"), "Limits must be stated.");
  assert(
    text.includes("- Price: no liquid USDG or WETH pool found"),
    "Tokens without a pool must not get an invented price.",
  );
  assert(!/[0-9a-fA-F]{64}/.test(text), "Full 64-hex hashes must never appear.");
});

Deno.test("chain data refuses the wrong chain and reports rate limits", async () => {
  for (
    const [options, code] of [
      [{ chainId: "0x1" }, "chain_data_wrong_chain"],
      [{ status: 429 }, "chain_data_rate_limited"],
      [{ status: 500 }, "chain_data_unavailable"],
    ] as const
  ) {
    const { fetchImpl } = createFakeRpc(options);
    let failure = "";
    try {
      await readLiveChainData({
        targets: { addresses: [wallet], txHash: null },
        rpcUrl: "https://rpc.example.com",
        fetchImpl,
      });
    } catch (error) {
      failure = error instanceof HttpError ? error.code : "other";
    }
    assertEquals(failure, code);
  }
});

Deno.test("chain data formats amounts for people", () => {
  assertEquals(formatAmount(1_234_567_891_234_567_890_000n, 18), "1,234.567891");
  assertEquals(formatAmount(1_000_000_000n * 10n ** 6n, 6), "1,000,000,000");
  assertEquals(formatAmount(1n, 18), "<0.000001");
  assertEquals(formatAmount(0n, 18), "0");
});

Deno.test("chain data says transfers are unavailable when log queries are rejected", async () => {
  const base = createFakeRpc().fetchImpl;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body)) as Array<{ id: number; method: string }>;
    if (batch.every((call) => call.method === "eth_getLogs")) {
      return new Response(
        JSON.stringify(batch.map((call) => ({
          jsonrpc: "2.0",
          id: call.id,
          error: { code: -32602, message: "range too large" },
        }))),
        { status: 200 },
      );
    }
    return await base(url, init);
  }) as typeof fetch;

  const text = await readLiveChainData({
    targets: { addresses: [wallet], txHash: null },
    rpcUrl: "https://rpc.example.com",
    fetchImpl,
  });

  assert(text.includes("not available from the chain reader"), text);
  assert(!text.includes("No token transfers"), "A failed read must not claim zero transfers.");
});

Deno.test("chain data splits large RPC batches and keeps results in order", async () => {
  const sizes: number[] = [];
  const fakeFetch = (async (_url: string, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body)) as Array<{ id: number; params: unknown[] }>;
    sizes.push(batch.length);
    return new Response(
      JSON.stringify(batch.map((call) => ({ jsonrpc: "2.0", id: call.id, result: call.params[0] }))),
      { status: 200 },
    );
  }) as typeof fetch;
  const rpc = createBatchRpc("https://rpc.example", fakeFetch, 1_000);
  const results = await rpc(
    Array.from({ length: 250 }, (_, index) => ({ method: "eth_call", params: [index] })),
  );

  assertEquals(sizes.join(","), "100,100,50");
  assertEquals(results.length, 250);
  assertEquals(results[0], 0);
  assertEquals(results[249], 249);
});
