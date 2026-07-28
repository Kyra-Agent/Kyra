export const ownerTransactionPolicyVersion = 2 as const;
export const ownerTransactionValueWei = "100000000000000" as const;
export const ownerTransactionCalldata = "0x" as const;

export function isAllowedOwnerTransactionValueWei(
  value: unknown,
): value is typeof ownerTransactionValueWei {
  return value === ownerTransactionValueWei;
}