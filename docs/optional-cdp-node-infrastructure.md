# Optional Coinbase CDP Node Infrastructure

Date: 2026-06-20

Status: optional infrastructure prepared; not part of the primary Phase 7
product flow.

## Classification

Coinbase Developer Platform Node is an optional RPC provider for independent
chain verification, monitoring, analytics, or fallback reads.

It is not required for:

- connecting a user's Base Account
- official Base MCP OAuth
- Base MCP tool discovery
- creating a Base MCP approval link
- Base Account transaction approval

The canonical product sequence is defined in
`docs/product-phase-roadmap.md`. The Base Account SDK plus Kyra's bounded
prepared-action adapter is the primary Phase 7 integration. Official hosted
Base MCP and CDP Node are separate optional provider lanes.

Reasons:

- Base lists CDP as a supported Base Mainnet node provider.
- CDP documents production-ready Base Mainnet RPC infrastructure.
- The endpoint uses standard Ethereum JSON-RPC.
- The current free allowance is sufficient for Kyra's bounded status checks.
- The provider is operationally aligned with the Base ecosystem.

The public `https://mainnet.base.org` endpoint remains smoke-only because Base
documents it as rate-limited and unsuitable for production systems.

## Required Endpoint

The only accepted production endpoint shape is:

```text
https://api.developer.coinbase.com/rpc/v1/base/[client-api-key]
```

The actual endpoint must be stored only as the Supabase
`KYRA_BASE_RPC_URL` secret. Do not paste it into source, documentation,
frontend variables, Telegram, logs, screenshots, or activity records.

Set:

```text
KYRA_BASE_RPC_PROVIDER=coinbase_cdp
KYRA_BASE_RPC_URL=[full CDP Base endpoint stored as a Supabase secret]
```

Keep:

```text
KYRA_BASE_MCP_PREP_ENABLED=false
```

until endpoint validation and one controlled owner-dashboard smoke pass.

## Validation Contract

`npm run validate:base-rpc`:

- reads the endpoint only from `KYRA_BASE_RPC_URL`
- accepts only the exact Coinbase CDP hostname and Base path
- rejects query strings, fragments, userinfo, non-HTTPS URLs, and other chains
- calls only `eth_chainId` and `eth_blockNumber`
- requires chain ID `8453`
- bounds every response to 4096 bytes
- never prints the endpoint, client key, raw response, or block number

## Current State

The repository and Supabase project do not contain a Coinbase CDP Node endpoint.
Creating one requires the owner to access the CDP Portal. Coinbase documents
that Node accounts require a payment method on file starting January 2026.

No payment method, account registration, endpoint creation, or key handling was
performed automatically.

No CDP endpoint is currently required to continue the Base Account primary
lane or monitor the official Base MCP adapter.

## Optional Activation Sequence

1. Owner creates or selects a CDP project.
2. Owner selects Base Mainnet on the CDP Node page.
3. Owner stores the copied endpoint directly as a Supabase secret.
4. Set `KYRA_BASE_RPC_PROVIDER=coinbase_cdp`.
5. Run the endpoint validator without printing the environment value.
6. Deploy `base-mcp-status-provider` while the main runtime gate remains off.
7. Perform one direct authenticated provider probe.
8. Open the main runtime gate for one owner-dashboard status check.
9. Confirm `preview_ready` and no storage, wallet, signing, or transaction side
   effects.
10. Return the runtime gate to off and verify `base_mcp_disabled`.

## Security Boundaries

- No wallet address or wallet authority reaches CDP Node.
- No Telegram token or chat identity reaches CDP Node.
- No owner, workspace, agent, email, Supabase, or session identifier reaches
  CDP Node.
- No calldata, signature, transaction, balance, or history request is allowed.
- Official Base MCP OAuth and `agent_wallet:*` scopes remain disabled.
- The only runtime RPC method remains `eth_chainId`.

## Sources

- Base Connecting to Base:
  `https://docs.base.org/base-chain/quickstart/connecting-to-base`
- Base Node Providers:
  `https://docs.base.org/base-chain/node-operators/node-providers`
- Coinbase CDP Node overview:
  `https://docs.cdp.coinbase.com/data/node/overview`
- Coinbase CDP Node quickstart:
  `https://docs.cdp.coinbase.com/data/node/quickstart`
