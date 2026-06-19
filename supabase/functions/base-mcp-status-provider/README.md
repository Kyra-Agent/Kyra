# Kyra Base Status Provider

Internal server-to-server bridge for the exact `kyra_status_v1` status contract.

The function accepts only one authenticated, read-only `POST /status-check`
shape from `base-mcp-prepare`. It verifies that the configured RPC reports Base
Mainnet chain ID `8453`, then returns the six-field provider response expected
by Kyra.

## Security Boundary

- Requires `KYRA_BASE_MCP_PROVIDER_SHARED_SECRET` with at least 32 characters.
- Requires backend-only `KYRA_BASE_RPC_URL` using HTTPS.
- Accepts no owner, workspace, agent, Telegram, wallet, token, calldata,
  signature, or transaction fields.
- Performs only `eth_chainId`.
- Returns no RPC body, block data, wallet data, or provider diagnostics.
- Uses bounded request and RPC response bodies.
- Rejects stale requests and mismatched request contracts.
- Emits no application logs.

The public Base RPC may be used only for one controlled smoke. Base documents
it as rate-limited and unsuitable for production traffic. A reviewed production
node provider is required before sustained use.
