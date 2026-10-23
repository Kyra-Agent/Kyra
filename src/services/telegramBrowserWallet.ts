import { getAddress, toHex } from "viem";
import { currentProductChain } from "../config/productChains";
import type { MiniAppTransaction, MiniAppWallet } from "./telegramWalletConnect";

// Browser-extension wallets for the Mini App once the owner opens it in their
// own browser (Telegram Desktop's window has no extensions). Wallets announce
// themselves through EIP-6963, so each shows by its own name and the owner
// picks one; nothing is chosen for them.

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

export interface BrowserWalletOption {
  id: string;
  name: string;
  icon: string | null;
  provider: Eip1193Provider;
}

const targetChainHex = toHex(currentProductChain.id);

export function discoverBrowserWallets(onChange: (wallets: BrowserWalletOption[]) => void) {
  const found = new Map<string, BrowserWalletOption>();
  const announce = (event: Event) => {
    const detail = (event as CustomEvent<{
      info?: { uuid?: unknown; name?: unknown; icon?: unknown };
      provider?: Eip1193Provider;
    }>).detail;
    const info = detail?.info;
    if (
      !detail?.provider || typeof detail.provider.request !== "function" ||
      typeof info?.uuid !== "string" || typeof info.name !== "string"
    ) return;
    found.set(info.uuid, {
      id: info.uuid,
      name: info.name.slice(0, 40),
      // Only inline images, so a wallet cannot make the page load a URL.
      icon: typeof info.icon === "string" && info.icon.startsWith("data:image/") ? info.icon : null,
      provider: detail.provider,
    });
    onChange([...found.values()]);
  };
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  // A wallet that predates EIP-6963 only sets window.ethereum.
  const fallback = setTimeout(() => {
    const legacy = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    if (!found.size && legacy && typeof legacy.request === "function") {
      found.set("injected", { id: "injected", name: "Browser wallet", icon: null, provider: legacy });
      onChange([...found.values()]);
    }
  }, 400);

  return () => {
    clearTimeout(fallback);
    window.removeEventListener("eip6963:announceProvider", announce);
  };
}

export async function connectBrowserWallet(option: BrowserWalletOption): Promise<MiniAppWallet> {
  const accounts = await option.provider.request({ method: "eth_requestAccounts" });
  return await readBrowserWallet(option, accounts);
}

export async function readBrowserWallet(
  option: BrowserWalletOption,
  accounts?: unknown,
): Promise<MiniAppWallet> {
  const list = accounts ?? await option.provider.request({ method: "eth_accounts" });
  const first = Array.isArray(list) ? list[0] : null;
  if (typeof first !== "string") throw new Error("wallet_returned_no_account");
  const chainId = await option.provider.request({ method: "eth_chainId" });
  return {
    address: getAddress(first),
    onTargetChain: typeof chainId === "string" && chainId.toLowerCase() === targetChainHex,
    walletName: option.name,
    source: "browser",
  };
}

// Switches to Robinhood Chain, adding it first if the wallet does not know it.
export async function switchBrowserWalletChain(option: BrowserWalletOption) {
  try {
    await option.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainHex }],
    });
  } catch (error) {
    if (!isUnknownChain(error)) throw error;
    await option.provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: targetChainHex,
        chainName: currentProductChain.name,
        nativeCurrency: currentProductChain.nativeCurrency,
        rpcUrls: [currentProductChain.publicRpcUrl],
        blockExplorerUrls: [currentProductChain.explorerUrl],
      }],
    });
  }
}

export async function sendBrowserTransaction(
  option: BrowserWalletOption,
  transaction: MiniAppTransaction,
) {
  // An extension sends on whatever chain it is on, so check right before
  // asking it to send.
  const chainId = await option.provider.request({ method: "eth_chainId" });
  if (typeof chainId !== "string" || chainId.toLowerCase() !== targetChainHex) {
    throw new Error("wallet_wrong_chain");
  }
  const hash = await option.provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value: toHex(BigInt(transaction.valueWei)),
    }],
  });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/u.test(hash)) {
    throw new Error("wallet_returned_invalid_hash");
  }
  return hash.toLowerCase() as `0x${string}`;
}

export function watchBrowserWallet(option: BrowserWalletOption, onChange: () => void) {
  const listener = () => onChange();
  option.provider.on?.("accountsChanged", listener);
  option.provider.on?.("chainChanged", listener);
  return () => {
    option.provider.removeListener?.("accountsChanged", listener);
    option.provider.removeListener?.("chainChanged", listener);
  };
}

function isUnknownChain(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : null;
  const nested = "data" in error && error.data && typeof error.data === "object" &&
      "originalError" in error.data
    ? (error.data.originalError as { code?: unknown } | null)?.code
    : null;
  return code === 4902 || nested === 4902;
}
