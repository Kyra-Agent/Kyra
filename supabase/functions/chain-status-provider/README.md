# Kyra Chain Status Provider

Production status: active as an internal server-to-server health bridge.

The function accepts one authenticated `chain_status_check`, calls only `eth_chainId`, and returns a bounded sanitized result. It is not a browser, wallet, Telegram, or transaction endpoint.

## Runtime Boundary

- The runtime gate must equal the exact reviewed value before provider access is mounted.
- The shared provider secret remains backend-only.
- Chain key and chain ID must match the Robinhood registry.
- Robinhood mainnet uses only its managed, allowlisted HTTPS RPC configuration and never falls back to testnet or generic RPC settings.
- Robinhood Chain Testnet accepts only the reviewed testnet lane and cannot serve mainnet.
- Requests and responses are size-bounded, errors are fixed and sanitized, and application payloads are not logged.
- Owner IDs, wallet data, Telegram data, calldata, signatures, token data, transactions, and raw provider responses are rejected.

Mainnet and controlled testnet status checks are live. Provider configuration never replaces wallet approval or user signing authority.
