// Compatibility export for historical imports. The active owner wallet runtime
// is chain-neutral and lives in OwnerWalletConnectionPanel.
export {
  OwnerWalletConnectionPanel as BaseAccountConnectionPanel,
} from "./OwnerWalletConnectionPanel";
export type {
  OwnerWalletConnectionStatus as BaseAccountConnectionStatus,
} from "./OwnerWalletConnectionPanel";
