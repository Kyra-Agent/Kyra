// Compatibility aliases for historical Phase 7/8 modules. New runtime code uses
// the chain-neutral owner wallet contract directly.
export {
  ownerWalletChainId as baseAccountChainId,
  ownerWalletConnectorType as baseAccountConnectorId,
  walletBindingMatchesTarget as bindingMatchesTarget,
  walletConnectionMatchesBinding as connectionMatchesBinding,
  createOwnerWalletConnectionBinding as createBaseAccountConnectionBinding,
  getOwnerWalletConnectionFailureMessage as getBaseAccountConnectionFailureMessage,
  isOwnerWalletConnectionTarget as isBaseAccountConnectionTarget,
  maskOwnerWalletAddress as maskBaseAccountAddress,
} from "./ownerWalletConnection";

export type {
  OwnerWalletConnectionBinding as BaseAccountConnectionBinding,
  OwnerWalletConnectionFailureCode as BaseAccountConnectionFailureCode,
  OwnerWalletConnectionSnapshot as BaseAccountConnectionSnapshot,
  OwnerWalletConnectionTarget as BaseAccountConnectionTarget,
} from "./ownerWalletConnection";
