# Kyra Chain Status Provider

Default-off internal health bridge for Kyra's chain-neutral backend contract.
It accepts one authenticated server-to-server `chain_status_check`, calls only
`eth_chainId`, and returns a bounded sanitized result.

## Runtime boundary

- `KYRA_CHAIN_STATUS_PROVIDER_ENABLED` must equal `true`.
- `KYRA_CHAIN_PROVIDER_SHARED_SECRET` is backend-only and at least 32 chars.
- `KYRA_CHAIN_KEY` and `KYRA_CHAIN_ID` must match the reviewed registry.
- `KYRA_CHAIN_RPC_PROVIDER=managed_private` requires an exact hostname in
  `KYRA_CHAIN_RPC_ALLOWED_HOSTS` and rejects Robinhood public RPC hosts.
- `KYRA_CHAIN_RPC_PROVIDER=robinhood_public_testnet` accepts only the official
  Robinhood testnet RPC and cannot serve mainnet.
- The function accepts no owner, wallet, Telegram, calldata, signature, token,
  transaction, or provider-response fields.
- Request and response bodies are bounded; errors are fixed and sanitized.
- No application logs are emitted.

The public testnet RPC lane exists only for controlled Batch 5 evidence. A
Kyra-owned managed provider is required before mainnet cutover.
