export const ownerTransactionPolicyVersion = 2 as const;
export const ownerTransactionValueWei = "100000000000000" as const;
export const ownerTransactionValue = 100_000_000_000_000n;
export const ownerTransactionValueLabel = "0.0001 ETH" as const;
export const ownerTransactionCalldata = "0x" as const;

export function isAllowedOwnerTransactionValueWei(
  value: unknown,
): value is typeof ownerTransactionValueWei {
  return value === ownerTransactionValueWei;
}