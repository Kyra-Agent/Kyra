const ownerPolicyImportPattern =
  /import\s+\{[^}]+\}\s+from\s+"\.\.\/config\/ownerTransactionPolicy";\s*/u;

const ownerPolicySource = `
const ownerTransactionPolicyVersion = 2;
const ownerTransactionValueWei = "100000000000000";
const ownerTransactionValue = 100000000000000n;
const ownerTransactionValueLabel = "0.0001 ETH";
const ownerTransactionCalldata = "0x";
const isAllowedOwnerTransactionValueWei =
  (value) => value === ownerTransactionValueWei;
`;

export function inlineOwnerTransactionPolicy(source) {
  return `${ownerPolicySource}\n${source.replace(ownerPolicyImportPattern, "")}`;
}
