const rpcUrl = process.env.KYRA_BASE_RPC_URL?.trim() ?? "";
const url = readCoinbaseCdpBaseRpcUrl(rpcUrl);

const chainId = await callRpc(url, "eth_chainId", "kyra-chain-id");

if (chainId !== "0x2105") {
  throw new Error("Coinbase CDP RPC returned the wrong Base chain ID.");
}

const blockNumber = await callRpc(url, "eth_blockNumber", "kyra-block-number");

if (
  typeof blockNumber !== "string" ||
  !/^0x[0-9a-f]+$/u.test(blockNumber) ||
  Number.parseInt(blockNumber.slice(2), 16) <= 0
) {
  throw new Error("Coinbase CDP RPC returned an invalid block number.");
}

console.log("Coinbase CDP Base RPC validation passed.");

function readCoinbaseCdpBaseRpcUrl(value) {
  try {
    const parsed = new URL(value);

    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "api.developer.coinbase.com" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !/^\/rpc\/v1\/base\/[A-Za-z0-9_-]{16,256}$/u.test(parsed.pathname)
    ) {
      throw new Error("invalid");
    }

    return parsed.toString();
  } catch {
    throw new Error(
      "KYRA_BASE_RPC_URL must be an exact Coinbase CDP Base endpoint.",
    );
  }
}

async function callRpc(endpoint, method, id) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params: [],
      id,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error("Coinbase CDP RPC request failed.");
  }

  const contentType = response.headers.get("content-type")?.split(";", 1)[0]
    .trim().toLowerCase();

  if (contentType !== "application/json") {
    throw new Error("Coinbase CDP RPC returned an invalid content type.");
  }

  const contentLength = response.headers.get("content-length");

  if (
    contentLength !== null &&
    (!Number.isSafeInteger(Number(contentLength)) ||
      Number(contentLength) < 0 ||
      Number(contentLength) > 4096)
  ) {
    throw new Error("Coinbase CDP RPC returned an oversized response.");
  }

  const text = await readBoundedText(response, 4096);
  const body = JSON.parse(text);

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    body.jsonrpc !== "2.0" ||
    body.id !== id ||
    typeof body.result !== "string" ||
    "error" in body
  ) {
    throw new Error("Coinbase CDP RPC returned an invalid response.");
  }

  return body.result;
}

async function readBoundedText(response, maxBytes) {
  if (!response.body) {
    throw new Error("Coinbase CDP RPC returned an empty response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      bytes += value.byteLength;

      if (bytes > maxBytes) {
        await reader.cancel();
        throw new Error("Coinbase CDP RPC returned an oversized response.");
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
