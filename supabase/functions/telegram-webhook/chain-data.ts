import {
  decodeAbiParameters,
  formatUnits,
  hexToString,
  toEventSelector,
} from "npm:viem@2.57.7";
import { HttpError } from "./core.ts";

// Read-only Robinhood Chain data for Telegram answers. When a chat message
// contains a wallet address, token address, or transaction hash, the webhook
// reads public chain state here and hands the agent brain a plain-text fact
// block. Nothing in this module signs, sends, or simulates transactions.

export interface ChainDataTargets {
  addresses: string[];
  txHash: string | null;
}

export interface ChainDataRpcConfig {
  rpcUrl: string;
}

interface RpcCall {
  method: string;
  params: unknown[];
}

interface TokenMeta {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface TransferRow {
  token: string;
  from: string;
  to: string;
  raw: bigint | null;
  tokenId: string | null;
  blockNumber: number;
  logIndex: number;
  txHash: string;
}

const robinhoodChainIdHex = "0x1237";
// ERC-20 and ERC-721 share this event signature.
const transferTopic = toEventSelector("Transfer(address,address,uint256)");
const explorerUrl = "https://robinhoodchain.blockscout.com";
const selectors = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
};
// Well-known Robinhood Chain tokens checked for every wallet.
const coreTokens: readonly TokenMeta[] = [
  {
    address: "0x0bd7d308f8e1639fab988df18a8011f41eacad73",
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
  },
  {
    address: "0x5fc5360d0400a0fd4f2af552add042d716f1d168",
    name: "Global Dollar",
    symbol: "USDG",
    decimals: 6,
  },
];
const maxAddresses = 3;
const maxListedTransfers = 8;
const maxExtraTokens = 5;
// The RPC accepts at most 30,000 blocks per log query (~50 minutes at ~0.1 s
// per block); wallets are searched in up to three windows.
const walletLogWindowBlocks = 28_000;
const walletLogWindows = 3;
const tokenActivityBlocks = 3_000;
const approxSecondsPerBlock = 0.1;
const defaultTimeoutMs = 6_000;
const maxFactBlockLength = 2_600;

const addressPattern = /(?<![0-9a-fA-Fx])0x[0-9a-fA-F]{40}(?![0-9a-fA-F])/g;
const txHashPattern = /(?<![0-9a-fA-Fx])0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/;
const chainFollowUpPattern =
  /\b(wallet|address|balance|balances|holding|holdings|portfolio|token|tokens|holder|holders|hold|holds|transfer|transfers|history|activity|supply|it|that|this|same)\b/i;

export function extractChainDataTargets(
  text: unknown,
  history: ReadonlyArray<{ role: string; content: string }> = [],
): ChainDataTargets {
  const message = typeof text === "string" ? text : "";
  const txHash = message.match(txHashPattern)?.[0]?.toLowerCase() ?? null;
  let addresses = uniqueAddresses(message);

  // "What about its supply?" after pasting an address earlier: reuse the most
  // recent address from the owner's own remembered messages.
  if (!addresses.length && !txHash && chainFollowUpPattern.test(message)) {
    for (const turn of [...history].reverse()) {
      if (turn.role !== "user") {
        continue;
      }
      const found = uniqueAddresses(turn.content);
      if (found.length) {
        addresses = found;
        break;
      }
    }
  }

  return { addresses: addresses.slice(0, maxAddresses), txHash };
}

export function hasChainDataTargets(targets: ChainDataTargets) {
  return targets.addresses.length > 0 || targets.txHash !== null;
}

export function readChainDataRpcConfig(
  getEnv: (key: string) => string | undefined,
): ChainDataRpcConfig | null {
  const rawUrl = getEnv("KYRA_ROBINHOOD_MAINNET_RPC_URL")?.trim();
  const rawAllowedHosts = getEnv("KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS")
    ?.trim();

  if (!rawUrl || !rawAllowedHosts) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    const allowedHosts = new Set(
      rawAllowedHosts.split(",").map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );

    if (
      url.protocol !== "https:" || url.username || url.password ||
      !allowedHosts.has(url.hostname.toLowerCase())
    ) {
      return null;
    }

    return { rpcUrl: url.toString() };
  } catch {
    return null;
  }
}

// Reads chain state for the targets and returns a plain-text fact block.
export async function readLiveChainData(input: {
  targets: ChainDataTargets;
  rpcUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<string> {
  const rpc = createBatchRpc(
    input.rpcUrl,
    input.fetchImpl ?? fetch,
    input.timeoutMs ?? defaultTimeoutMs,
  );
  const sections: string[] = [];

  const base = await rpc([
    { method: "eth_chainId", params: [] },
    { method: "eth_blockNumber", params: [] },
    ...input.targets.addresses.flatMap((address) => [
      { method: "eth_getCode", params: [address, "latest"] },
      { method: "eth_getBalance", params: [address, "latest"] },
      { method: "eth_getTransactionCount", params: [address, "latest"] },
      ethCall(address, selectors.name),
      ethCall(address, selectors.symbol),
      ethCall(address, selectors.decimals),
      ethCall(address, selectors.totalSupply),
    ]),
  ]);

  if (typeof base[0] !== "string" || base[0].toLowerCase() !== robinhoodChainIdHex) {
    throw chainDataFailure("chain_data_wrong_chain");
  }

  const head = readHexNumber(base[1]);

  if (head === null) {
    throw chainDataFailure("chain_data_unavailable");
  }

  // Anything that is not an ERC-20 token is treated as an account: a plain
  // wallet, or a contract such as a smart wallet, pool, or vault.
  const wallets: Array<{
    address: string;
    ethWei: bigint;
    nonce: number | null;
    isContract: boolean;
  }> = [];
  const tokens: Array<TokenMeta & { totalSupply: bigint | null }> = [];

  input.targets.addresses.forEach((address, index) => {
    const offset = 2 + index * 7;
    const code = base[offset];
    const ethWei = readHexBigInt(base[offset + 1]) ?? 0n;
    const nonce = readHexNumber(base[offset + 2]);
    const decimals = readUint(base[offset + 5]);

    const isContract = typeof code === "string" && code !== "0x" && code !== "0x0";

    if (isContract && decimals !== null && decimals <= 36) {
      tokens.push({
        address,
        name: readAbiString(base[offset + 3]) ?? "Unknown token",
        symbol: readAbiString(base[offset + 4]) ?? "TOKEN",
        decimals: Number(decimals),
        totalSupply: readHexBigInt(base[offset + 6]),
      });
      return;
    }

    wallets.push({ address, ethWei, nonce, isContract });
  });

  // Balances of core tokens and of any token named in the same message, plus
  // recent token activity, in one batch.
  const balanceTokens = uniqueTokens([...coreTokens, ...tokens]);
  const second = await rpc([
    ...wallets.flatMap((wallet) =>
      balanceTokens.map((token) =>
        ethCall(token.address, selectors.balanceOf + padAddress(wallet.address))
      )
    ),
    ...tokens.map((token) => ({
      method: "eth_getLogs",
      params: [{
        address: token.address,
        fromBlock: toHex(Math.max(0, head - tokenActivityBlocks)),
        toBlock: toHex(head),
        topics: [transferTopic],
      }],
    })),
  ]);

  const walletBalances = wallets.map((_, walletIndex) =>
    balanceTokens.map((token, tokenIndex) => ({
      token,
      raw: readHexBigInt(second[walletIndex * balanceTokens.length + tokenIndex]),
    }))
  );
  const activityOffset = wallets.length * balanceTokens.length;
  const tokenActivity = tokens.map((_, index) => second[activityOffset + index]);

  // Recent transfers per wallet, searched backward in bounded windows.
  const walletTransfers: TransferRow[][] = [];
  // A rejected log query must not read as "no transfers".
  const walletTransfersUnavailable: boolean[] = [];
  let windowsSearched = 0;

  for (const wallet of wallets) {
    const rows: TransferRow[] = [];
    let windows = 0;
    let unavailable = false;

    for (let windowIndex = 0; windowIndex < walletLogWindows; windowIndex += 1) {
      const toBlock = head - windowIndex * walletLogWindowBlocks;
      const fromBlock = Math.max(0, toBlock - walletLogWindowBlocks + 1);
      const topic = padAddress(wallet.address);
      const logs = await rpc([
        transferLogs(fromBlock, toBlock, [transferTopic, null, `0x${topic}`]),
        transferLogs(fromBlock, toBlock, [transferTopic, `0x${topic}`]),
      ]);

      if (!Array.isArray(logs[0]) || !Array.isArray(logs[1])) {
        unavailable = rows.length === 0;
        break;
      }

      windows += 1;
      rows.push(...readTransferRows(logs[0]), ...readTransferRows(logs[1]));

      if (rows.length >= 5 || fromBlock === 0) {
        break;
      }
    }

    windowsSearched = Math.max(windowsSearched, windows);
    walletTransfers.push(dedupeTransfers(rows));
    walletTransfersUnavailable.push(unavailable);
  }

  // Metadata and balances for tokens the wallets touched recently.
  const known = new Map(balanceTokens.map((token) => [token.address, token]));
  const extraTokenAddresses = [
    ...new Set(walletTransfers.flat().map((row) => row.token)),
  ].filter((address) => !known.has(address)).slice(0, maxExtraTokens);

  if (extraTokenAddresses.length) {
    const meta = await rpc(extraTokenAddresses.flatMap((address) => [
      ethCall(address, selectors.name),
      ethCall(address, selectors.symbol),
      ethCall(address, selectors.decimals),
    ]));

    extraTokenAddresses.forEach((address, index) => {
      const decimals = readUint(meta[index * 3 + 2]);
      known.set(address, {
        address,
        name: readAbiString(meta[index * 3]) ?? "Unknown token",
        symbol: readAbiString(meta[index * 3 + 1]) ?? "TOKEN",
        decimals: decimals !== null && decimals <= 36 ? Number(decimals) : 0,
      });
    });

    if (wallets.length) {
      const extraBalances = await rpc(wallets.flatMap((wallet) =>
        extraTokenAddresses.map((address) =>
          ethCall(address, selectors.balanceOf + padAddress(wallet.address))
        )
      ));

      wallets.forEach((_, walletIndex) => {
        extraTokenAddresses.forEach((address, tokenIndex) => {
          walletBalances[walletIndex].push({
            token: known.get(address)!,
            raw: readHexBigInt(
              extraBalances[walletIndex * extraTokenAddresses.length + tokenIndex],
            ),
          });
        });
      });
    }
  }

  const windowMinutes = Math.round(
    (windowsSearched * walletLogWindowBlocks * approxSecondsPerBlock) / 60,
  );

  wallets.forEach((wallet, index) => {
    const lines = [
      `${wallet.isContract ? "Smart contract account" : "Wallet"} ${wallet.address}`,
    ];
    lines.push(`- ETH: ${formatAmount(wallet.ethWei, 18)}`);

    const holdings = walletBalances[index]
      .filter((entry) => entry.raw !== null && entry.raw > 0n);
    for (const entry of holdings) {
      lines.push(`- ${entry.token.symbol}: ${formatAmount(entry.raw!, entry.token.decimals)}`);
    }
    if (!holdings.length) {
      lines.push("- No balance in WETH, USDG, or recently used tokens");
    }
    if (wallet.nonce !== null && !wallet.isContract) {
      lines.push(`- Transactions sent from this wallet: ${groupDigits(String(wallet.nonce))}`);
    }

    const transfers = walletTransfers[index].slice(0, maxListedTransfers);
    lines.push(
      walletTransfersUnavailable[index]
        ? "- Recent token transfers: not available from the chain reader right now"
        : transfers.length
        ? `- Latest token transfers (searched the last ~${windowMinutes} min):`
        : `- No token transfers in the last ~${windowMinutes} min`,
    );
    for (const row of transfers) {
      lines.push(`  ${describeTransfer(row, wallet.address, known)}`);
    }

    for (const token of tokens) {
      const entry = walletBalances[index].find((item) => item.token.address === token.address);
      if (entry && entry.raw !== null) {
        lines.push(
          `- Holder check: ${shortAddress(wallet.address)} ${
            entry.raw > 0n ? "holds" : "does not hold"
          } ${token.symbol}${entry.raw > 0n ? ` (${formatAmount(entry.raw, token.decimals)})` : ""}`,
        );
      }
    }

    lines.push(`- Explorer: ${explorerUrl}/address/${wallet.address}`);
    sections.push(lines.join("\n"));
  });

  tokens.forEach((token, index) => {
    const lines = [`Token ${token.address}`];
    lines.push(`- ${token.name} (${token.symbol}), ${token.decimals} decimals`);
    if (token.totalSupply !== null) {
      lines.push(`- Total supply: ${formatAmount(token.totalSupply, token.decimals)} ${token.symbol}`);
    }
    const activityMinutes = Math.max(
      1,
      Math.round((tokenActivityBlocks * approxSecondsPerBlock) / 60),
    );
    const activity = tokenActivity[index];
    lines.push(
      Array.isArray(activity)
        ? `- Transfers in the last ~${activityMinutes} min: ${groupDigits(String(activity.length))}`
        : `- Transfers in the last ~${activityMinutes} min: more than 10,000 or not readable`,
    );
    lines.push(`- Explorer: ${explorerUrl}/token/${token.address}`);
    sections.push(lines.join("\n"));
  });

  if (input.targets.txHash) {
    sections.push(await describeTransaction(rpc, input.targets.txHash, known));
  }

  const header =
    `Live Robinhood Chain data, read at block ${groupDigits(String(head))}:`;
  const footer =
    "Not included: USD prices, holder counts, and history older than the window above.";
  let block = [header, ...sections, footer].join("\n\n");

  if (block.length > maxFactBlockLength) {
    block = `${block.slice(0, maxFactBlockLength - 40).replace(/\n[^\n]*$/, "")}\n(more data trimmed)`;
  }

  return block;
}

async function describeTransaction(
  rpc: (calls: RpcCall[]) => Promise<unknown[]>,
  txHash: string,
  known: Map<string, TokenMeta>,
) {
  const [transaction, receipt] = await rpc([
    { method: "eth_getTransactionByHash", params: [txHash] },
    { method: "eth_getTransactionReceipt", params: [txHash] },
  ]);

  // Full 64-hex strings look like private keys to the reply safety filter, so
  // the fact block only ever shows a shortened hash.
  if (!isRecord(transaction)) {
    return `Transaction ${shortHash(txHash)}\n- Not found on Robinhood Chain mainnet`;
  }

  const lines = [`Transaction ${shortHash(txHash)}`];
  const status = isRecord(receipt) ? receipt.status : null;
  lines.push(
    `- Status: ${
      status === "0x1" ? "succeeded" : status === "0x0" ? "failed" : "pending"
    }`,
  );
  if (typeof transaction.from === "string") {
    lines.push(`- From: ${transaction.from.toLowerCase()}`);
  }
  lines.push(
    `- To: ${
      typeof transaction.to === "string" ? transaction.to.toLowerCase() : "contract creation"
    }`,
  );
  const value = readHexBigInt(transaction.value);
  if (value !== null && value > 0n) {
    lines.push(`- ETH sent: ${formatAmount(value, 18)}`);
  }
  const block = readHexNumber(transaction.blockNumber);
  if (block !== null) {
    lines.push(`- Block: ${groupDigits(String(block))}`);
  }

  const transfers = isRecord(receipt) && Array.isArray(receipt.logs)
    ? readTransferRows(receipt.logs)
    : [];
  const unknown = [...new Set(transfers.map((row) => row.token))]
    .filter((address) => !known.has(address))
    .slice(0, 3);

  if (unknown.length) {
    const meta = await rpc(unknown.flatMap((address) => [
      ethCall(address, selectors.symbol),
      ethCall(address, selectors.decimals),
    ]));
    unknown.forEach((address, index) => {
      const decimals = readUint(meta[index * 2 + 1]);
      known.set(address, {
        address,
        name: "",
        symbol: readAbiString(meta[index * 2]) ?? "TOKEN",
        decimals: decimals !== null && decimals <= 36 ? Number(decimals) : 0,
      });
    });
  }

  if (transfers.length) {
    lines.push(`- Token transfers in this transaction: ${transfers.length}`);
    for (const row of transfers.slice(0, 5)) {
      lines.push(`  ${describeTransfer(row, null, known)}`);
    }
  }

  lines.push(`- Explorer: search the hash at ${explorerUrl}`);
  return lines.join("\n");
}

function describeTransfer(
  row: TransferRow,
  wallet: string | null,
  known: Map<string, TokenMeta>,
) {
  const token = known.get(row.token);
  const symbol = token?.symbol ?? shortAddress(row.token);
  const amount = row.tokenId !== null
    ? `NFT #${row.tokenId.length > 12 ? `${row.tokenId.slice(0, 12)}...` : row.tokenId} of ${symbol}`
    : `${row.raw === null ? "?" : formatAmount(row.raw, token?.decimals ?? 18)} ${symbol}`;
  const tx = `tx ${shortHash(row.txHash)}`;

  if (wallet && row.to === wallet) {
    return `- In: ${amount} from ${shortAddress(row.from)} (${tx})`;
  }
  if (wallet && row.from === wallet) {
    return `- Out: ${amount} to ${shortAddress(row.to)} (${tx})`;
  }
  return `- ${amount} from ${shortAddress(row.from)} to ${shortAddress(row.to)}`;
}

function readTransferRows(value: unknown): TransferRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rows: TransferRow[] = [];

  for (const log of value) {
    if (!isRecord(log) || !Array.isArray(log.topics)) {
      continue;
    }
    const topics = log.topics.filter((topic): topic is string => typeof topic === "string");
    if (topics[0]?.toLowerCase() !== transferTopic || topics.length < 3) {
      continue;
    }

    const isNft = topics.length === 4;
    rows.push({
      token: String(log.address ?? "").toLowerCase(),
      from: topicAddress(topics[1]),
      to: topicAddress(topics[2]),
      raw: isNft ? null : readHexBigInt(log.data),
      tokenId: isNft ? (readHexBigInt(topics[3]) ?? 0n).toString() : null,
      blockNumber: readHexNumber(log.blockNumber) ?? 0,
      logIndex: readHexNumber(log.logIndex) ?? 0,
      txHash: String(log.transactionHash ?? ""),
    });
  }

  return rows;
}

function dedupeTransfers(rows: TransferRow[]) {
  const seen = new Set<string>();

  return rows
    .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex)
    .filter((row) => {
      const key = `${row.txHash}:${row.logIndex}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function createBatchRpc(rpcUrl: string, fetchImpl: typeof fetch, timeoutMs: number) {
  return async (calls: RpcCall[]): Promise<unknown[]> => {
    if (!calls.length) {
      return [];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call })),
        ),
        signal: controller.signal,
      });

      if (response.status === 429) {
        throw chainDataFailure("chain_data_rate_limited");
      }
      if (!response.ok) {
        throw chainDataFailure("chain_data_unavailable");
      }

      const payload = await response.json();

      if (!Array.isArray(payload)) {
        throw chainDataFailure("chain_data_unavailable");
      }

      const results: unknown[] = new Array(calls.length).fill(null);
      for (const item of payload) {
        if (isRecord(item) && typeof item.id === "number" && "result" in item) {
          results[item.id] = item.result;
        }
      }
      return results;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw chainDataFailure(
        controller.signal.aborted ? "chain_data_timeout" : "chain_data_unavailable",
      );
    } finally {
      clearTimeout(timer);
    }
  };
}

function ethCall(to: string, data: string): RpcCall {
  return { method: "eth_call", params: [{ to, data }, "latest"] };
}

function transferLogs(fromBlock: number, toBlock: number, topics: unknown[]): RpcCall {
  return {
    method: "eth_getLogs",
    params: [{ fromBlock: toHex(fromBlock), toBlock: toHex(toBlock), topics }],
  };
}

function readAbiString(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value) || value.length <= 2) {
    return null;
  }

  try {
    const [decoded] = decodeAbiParameters([{ type: "string" }], value as `0x${string}`);
    return cleanLabel(decoded);
  } catch {
    // Some older tokens return bytes32 instead of a string.
    if (value.length === 66) {
      try {
        return cleanLabel(hexToString(value as `0x${string}`, { size: 32 }));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanLabel(value: string) {
  const label = value.replace(/\u0000/g, "").replace(/[^\p{L}\p{N} ._$#&()+-]/gu, "")
    .trim().slice(0, 40);
  return label || null;
}

function readUint(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{1,64}$/.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function readHexBigInt(value: unknown) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) {
    return null;
  }
  try {
    return BigInt(value.length > 66 ? value.slice(0, 66) : value);
  } catch {
    return null;
  }
}

function readHexNumber(value: unknown) {
  const parsed = readHexBigInt(value);
  return parsed !== null && parsed <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(parsed) : null;
}

export function formatAmount(raw: bigint, decimals: number) {
  const [whole, fraction = ""] = formatUnits(raw, decimals).split(".");
  const keep = whole.length > 6 ? 2 : 6;
  const trimmed = fraction.slice(0, keep).replace(/0+$/, "");
  const text = `${groupDigits(whole)}${trimmed ? `.${trimmed}` : ""}`;
  return text === "0" && raw > 0n ? "<0.000001" : text;
}

function groupDigits(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function uniqueAddresses(text: string) {
  return [...new Set((text.match(addressPattern) ?? []).map((item) => item.toLowerCase()))];
}

function uniqueTokens(tokens: TokenMeta[]) {
  const seen = new Map<string, TokenMeta>();
  for (const token of tokens) {
    seen.set(token.address, token);
  }
  return [...seen.values()];
}

function padAddress(address: string) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function topicAddress(topic: string) {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

function toHex(value: number) {
  return `0x${value.toString(16)}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(hash: string) {
  return hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-4)}` : hash;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chainDataFailure(code: string) {
  return new HttpError(502, code, "Robinhood Chain data is unavailable right now.");
}
