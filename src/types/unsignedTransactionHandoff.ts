import { currentProductChain } from "../config/productChains";

export const productChainId = currentProductChain.id;
export const walletUnsignedTransactionHandoffVersion = 1;
export const walletSignableActionKinds = ["robinhood_reviewed_transaction"] as const;

export type WalletSignableActionKind =
  (typeof walletSignableActionKinds)[number];
export type WalletUnsignedTransactionRisk = "low" | "medium" | "high";
export type WalletGasPayer = "connected_wallet";

export interface WalletUnsignedTransactionHandoff {
  version: typeof walletUnsignedTransactionHandoffVersion;
  preparedActionId: string;
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  actionKind: WalletSignableActionKind;
  chainId: typeof productChainId;
  chainName: typeof currentProductChain.name;
  to: `0x${string}`;
  valueWei: string;
  data: `0x${string}`;
  gasPayer: WalletGasPayer;
  routeSummary: string;
  valueSummary: string;
  risk: WalletUnsignedTransactionRisk;
  createdAt: string;
  expiresAt: string;
  privateKey?: never;
  seedPhrase?: never;
  telegramToken?: never;
  rawProviderPayload?: never;
  txHash?: never;
}

export interface WalletUnsignedTransactionHandoffValidation {
  ok: boolean;
  reason: string | null;
}

const maxHandoffLifetimeMs = 15 * 60 * 1000;

export function validateUnsignedTransactionHandoff(
  handoff: WalletUnsignedTransactionHandoff,
  nowMs = Date.now(),
): WalletUnsignedTransactionHandoffValidation {
  if (handoff.version !== walletUnsignedTransactionHandoffVersion) {
    return reject("Unsupported wallet handoff version.");
  }

  if (!walletSignableActionKinds.includes(handoff.actionKind)) {
    return reject("Unsupported signable action kind.");
  }

  if (String(handoff.actionKind) === "chain_status_check") {
    return reject("Read-only status checks cannot be signed.");
  }

  if (
    handoff.chainId !== productChainId ||
    handoff.chainName !== currentProductChain.name
  ) {
    return reject(`Wallet handoff must target ${currentProductChain.name}.`);
  }

  if (handoff.gasPayer !== "connected_wallet") {
    return reject("The connected wallet must pay gas.");
  }

  if (!isEvmAddress(handoff.to)) {
    return reject("Wallet handoff target address is invalid.");
  }

  if (!isHexData(handoff.data)) {
    return reject("Wallet handoff calldata must be hex data.");
  }

  if (!isSafeValueWei(handoff.valueWei)) {
    return reject("Wallet handoff value must be a non-negative wei integer.");
  }

  const createdAtMs = Date.parse(handoff.createdAt);
  const expiresAtMs = Date.parse(handoff.expiresAt);

  if (!Number.isFinite(createdAtMs) || !Number.isFinite(expiresAtMs)) {
    return reject("Wallet handoff timestamps must be valid ISO dates.");
  }

  if (expiresAtMs <= nowMs) {
    return reject("Wallet handoff is expired.");
  }

  if (expiresAtMs - createdAtMs > maxHandoffLifetimeMs) {
    return reject("Wallet handoff expiry window is too long.");
  }

  for (
    const [field, value] of [
      ["preparedActionId", handoff.preparedActionId],
      ["ownerUserId", handoff.ownerUserId],
      ["workspaceId", handoff.workspaceId],
      ["agentId", handoff.agentId],
      ["routeSummary", handoff.routeSummary],
      ["valueSummary", handoff.valueSummary],
    ] as const
  ) {
    if (!value.trim()) {
      return reject(`Wallet handoff ${field} is required.`);
    }
  }

  return { ok: true, reason: null };
}

export function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/u.test(value);
}

export function isHexData(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x(?:[a-fA-F0-9]{2})*$/u.test(value);
}

export function isSafeValueWei(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d{0,77})$/u.test(value);
}

function reject(reason: string): WalletUnsignedTransactionHandoffValidation {
  return { ok: false, reason };
}
