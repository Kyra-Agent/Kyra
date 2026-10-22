import type { UniversalProvider as UniversalProviderClass } from "@walletconnect/universal-provider";
import { getAddress, toHex } from "viem";
import { currentProductChain } from "../config/productChains";

// WalletConnect for the Telegram Mini App. Telegram's webview has no browser
// extension, so the owner's phone wallet connects over the WalletConnect
// relay. This talks to the relay directly instead of through Reown's AppKit
// modal, which would pull Coinbase, Base, and Solana SDKs into the build.
// Kyra only ever asks the wallet to send a transaction the owner confirms.

export interface MiniAppWallet {
  address: `0x${string}`;
  onTargetChain: boolean;
  walletName: string;
}

export interface MiniAppTransaction {
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
  valueWei: string;
}

// Wallets the Mini App offers to open with the pairing link, by their
// published universal links. Each accepts `<link>/wc?uri=<pairing uri>`.
export const walletDeepLinks = [
  { name: "MetaMask", link: "https://metamask.app.link" },
  { name: "Trust Wallet", link: "https://link.trustwallet.com" },
  { name: "Rainbow", link: "https://rnbwapp.com" },
] as const;

export type WalletDeepLink = typeof walletDeepLinks[number];

export const walletConnectProjectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() || "";

type UniversalProvider = InstanceType<typeof UniversalProviderClass>;

const chainRef = `eip155:${currentProductChain.id}`;
// WalletConnect's sign client reads this key and, when it is set, brings the
// chosen wallet app forward for every request it sends.
const deepLinkChoiceKey = "WALLETCONNECT_DEEPLINK_CHOICE";
const methods = ["eth_sendTransaction", "wallet_addEthereumChain", "wallet_switchEthereumChain"];
const events = ["accountsChanged", "chainChanged"];
// The relay answers in about a second; past these limits the page tells the
// owner WalletConnect is unreachable instead of spinning.
const restoreTimeoutMs = 8_000;
const pairingTimeoutMs = 20_000;
let providerPromise: Promise<UniversalProvider> | null = null;

function loadProvider() {
  providerPromise ??= import("@walletconnect/universal-provider")
    .then(({ UniversalProvider }) =>
      UniversalProvider.init({
        projectId: walletConnectProjectId,
        metadata: {
          name: "Kyra Agent",
          description: "Robinhood Chain AI agents. Your wallet decides.",
          url: "https://kyraagent.xyz",
          icons: ["https://kyraagent.xyz/brand/kyra.jpg"],
        },
      })
    )
    .catch((error: unknown) => {
      providerPromise = null;
      throw error;
    });
  return providerPromise;
}

// A session from an earlier visit is reused, so reopening the Mini App from
// the next bot button needs no new pairing.
export async function restoreWallet(): Promise<MiniAppWallet | null> {
  if (!walletConnectProjectId) return null;
  const provider = await withTimeout(loadProvider(), restoreTimeoutMs);
  return provider.session ? readWallet(provider) : null;
}

export async function connectWallet(onPairingUri: (uri: string) => void) {
  let paired = false;
  let pairingTimer: ReturnType<typeof setTimeout> | undefined;
  // Only reaching the relay is timed; once the pairing link shows, the owner
  // takes as long as they need in their wallet (WalletConnect expires the
  // proposal itself after five minutes).
  const pairingDeadline = new Promise<never>((_, reject) => {
    pairingTimer = setTimeout(() => {
      if (!paired) reject(new Error("walletconnect_unreachable"));
    }, pairingTimeoutMs);
  });
  const provider = await Promise.race([loadProvider(), pairingDeadline]);
  const listener = (uri: string) => {
    paired = true;
    onPairingUri(uri);
  };
  provider.on("display_uri", listener);
  try {
    const connecting = provider.connect({
      optionalNamespaces: {
        eip155: {
          chains: [chainRef],
          methods,
          events,
          rpcMap: {
            [String(currentProductChain.id)]: currentProductChain.publicRpcUrl,
            [chainRef]: currentProductChain.publicRpcUrl,
          },
        },
      },
    });
    await Promise.race([connecting, pairingDeadline]);
  } finally {
    clearTimeout(pairingTimer);
    provider.off("display_uri", listener);
  }
  const wallet = readWallet(provider);
  if (!wallet) throw new Error("wallet_returned_no_account");
  return wallet;
}

// Remembers the wallet the owner opened so later requests open it too.
export async function chooseWalletApp(wallet: WalletDeepLink, pairingUri: string) {
  const provider = await loadProvider();
  await provider.client.core.storage.setItem(deepLinkChoiceKey, JSON.stringify({
    href: wallet.link,
    name: wallet.name,
  }));
  return `${wallet.link}/wc?uri=${encodeURIComponent(pairingUri)}`;
}

export async function disconnectWallet() {
  if (!providerPromise) return;
  try {
    const provider = await providerPromise;
    await provider.client.core.storage.removeItem(deepLinkChoiceKey);
    if (provider.session) await provider.disconnect();
  } catch {
    // The session is gone either way.
  }
}

export async function onWalletSessionEnd(listener: () => void) {
  const provider = await loadProvider();
  provider.on("session_delete", listener);
  provider.on("session_expire", listener);
  return () => {
    provider.off("session_delete", listener);
    provider.off("session_expire", listener);
  };
}

// For a wallet that paired without Robinhood Chain: ask it to add the chain
// on a chain it did approve. The owner reconnects afterwards so the new
// session includes Robinhood Chain.
export async function addRobinhoodChain() {
  const provider = await loadProvider();
  const approved = provider.session?.namespaces.eip155?.accounts[0]?.split(":").slice(0, 2).join(":");
  if (!approved) throw new Error("wallet_not_connected");
  await provider.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: toHex(currentProductChain.id),
      chainName: currentProductChain.name,
      nativeCurrency: currentProductChain.nativeCurrency,
      rpcUrls: [currentProductChain.publicRpcUrl],
      blockExplorerUrls: [currentProductChain.explorerUrl],
    }],
  }, approved);
  await disconnectWallet();
}

export async function sendWalletTransaction(transaction: MiniAppTransaction) {
  const provider = await loadProvider();
  const hash = await provider.request<string>({
    method: "eth_sendTransaction",
    params: [{
      from: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value: toHex(BigInt(transaction.valueWei)),
    }],
  }, chainRef);
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(hash)) {
    throw new Error("wallet_returned_invalid_hash");
  }
  return hash.toLowerCase() as `0x${string}`;
}

export function isWalletConnectUnreachable(error: unknown) {
  return error instanceof Error &&
    (error.message === "walletconnect_unreachable" || error.message === "walletconnect_timeout");
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("walletconnect_timeout")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function readWallet(provider: UniversalProvider): MiniAppWallet | null {
  const session = provider.session;
  const accounts = session?.namespaces.eip155?.accounts ?? [];
  if (!session || !accounts.length) return null;
  const target = accounts.find((account: string) => account.startsWith(`${chainRef}:`));
  let address: `0x${string}`;
  try {
    address = getAddress((target ?? accounts[0]).split(":")[2] ?? "");
  } catch {
    return null;
  }
  return {
    address,
    onTargetChain: Boolean(target),
    walletName: session.peer.metadata.name.slice(0, 40) || "Your wallet",
  };
}
