# Robinhood Chain Migration Blueprint

Date: 2026-07-22

Status: Batch 1 architecture and Batch 2 chain abstraction are complete
locally. Runtime cutover has not started, production behavior is unchanged,
and no Robinhood Chain capability may be described as live yet.

## Decision

Kyra will migrate its primary onchain lane from Base to Robinhood Chain while
preserving the existing non-custodial, approval-first product boundary.

This is a new release track under the existing 10-phase product roadmap. It is
not Phase 11 and it does not rewrite the historical evidence from Phases 1-10.
The reason for migration is an owner-directed product decision; this document
does not make a technical availability claim about Base.

The migration must preserve this invariant:

```text
authenticated owner
-> selected deployed Kyra agent
-> bounded prepared action
-> deterministic policy and NYX-05 risk review
-> explicit Kyra owner approval
-> explicit user-wallet approval
-> user wallet signs and submits on Robinhood Chain
-> sanitized owner-only result and receipt verification
```

Kyra never receives or stores a seed phrase or private key. Telegram and public
agent profiles cannot sign, approve, or submit transactions.

## Verified Network Facts

| Property | Robinhood Chain mainnet | Robinhood Chain testnet |
| --- | --- | --- |
| Chain ID | `4663` | `46630` |
| Hex chain ID | `0x1237` | `0xb626` |
| Native gas token | ETH | ETH |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` | `https://explorer.testnet.chain.robinhood.com` |
| Architecture | Arbitrum L2 on Ethereum | Arbitrum L2 test environment |
| Tooling | EVM, JSON-RPC, Viem, Wagmi | EVM, JSON-RPC, Viem, Wagmi |

Live verification performed on 2026-07-22:

- mainnet `eth_chainId` returned `0x1237`, decimal `4663`
- testnet `eth_chainId` returned `0xb626`, decimal `46630`
- both official public RPC endpoints answered JSON-RPC requests
- both Blockscout explorer endpoints returned HTTP success
- the official status page reported Robinhood Chain operational

Public RPC endpoints are rate-limited and are not approved as Kyra's production
transaction infrastructure. Robinhood recommends Alchemy for production and
also documents QuickNode, Blockdaemon, dRPC, and Validation Cloud as providers.

## Official Sources

- Network, endpoints, and provider guidance:
  `https://docs.robinhood.com/chain/connecting/`
- Wallet compatibility and manual network configuration:
  `https://docs.robinhood.com/chain/add-network-to-wallet/`
- EVM, Wagmi/Viem, account abstraction, and ecosystem support:
  `https://docs.robinhood.com/chain/`
- Mainnet support article and Robinhood Wallet support:
  `https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet/`
- Canonical and third-party bridge behavior:
  `https://docs.robinhood.com/chain/bridging/`
- Canonical token contract references:
  `https://docs.robinhood.com/chain/contracts/`
- Current network status:
  `https://status.robinhoodchain.offchain.io/`
- Service, wallet, availability, and affiliation boundaries:
  `https://docs.robinhood.com/chain/terms-of-service/`

## MCP And Provider Boundary

The reviewed official Robinhood Chain documentation exposes EVM JSON-RPC,
wallet connectivity, account abstraction, bridges, data services, and standard
developer tooling. It does not document an official Robinhood MCP transaction
service equivalent to the former Base MCP lane.

Therefore:

- Robinhood Chain is the target blockchain.
- A production RPC provider is infrastructure, not wallet authority.
- Kyra's prepared-action adapter remains the agent-to-transaction boundary.
- The user's EVM wallet remains the signing and submission authority.
- Existing `base-mcp-*` function names are temporary internal compatibility
  names only; they must not be relabeled as Robinhood MCP.
- Renaming deployed Supabase functions requires an explicit compatibility and
  rollback plan. No mass route rename is allowed during the first code batch.
- Official Base MCP OAuth, token, and hosted-tool routes remain disabled and are
  retired from the new primary architecture.

## Target Architecture

### Chain configuration

Create one canonical chain definition consumed by frontend, domain guards,
Supabase functions, tests, and public copy:

- `name`: `Robinhood Chain`
- `chainId`: `4663`
- `chainIdHex`: `0x1237`
- `nativeCurrency`: ETH with 18 decimals
- `explorerUrl`: `https://robinhoodchain.blockscout.com`
- production RPC: environment-provided server-side provider URL
- public RPC: development, health evidence, and manual fallback diagnostics only
- testnet chain ID: `46630`

No chain ID, RPC URL, or explorer URL may remain duplicated across active
source files after the abstraction batch closes. Base-specific compatibility
names remain explicit until the wallet and backend migration batches replace
their underlying contracts.

### Wallet connection

Replace the Base Account-only connector with a non-custodial EVM wallet
boundary compatible with Robinhood Chain.

Initial supported lanes:

1. Browser-injected EVM wallets for desktop users.
2. Robinhood Wallet compatibility, validated through the supported mobile or
   EVM connection route before it is advertised.
3. WalletConnect only after a Kyra-owned project configuration exists and its
   metadata, allowed origins, privacy behavior, and secret handling are audited.

Connection state stays browser-session scoped. Kyra stores only the minimum
owner/workspace/agent binding needed for policy checks. A chain, account,
workspace, owner, selected-agent, or prepared-action drift invalidates the
execution window and forces re-review.

### RPC and backend provider

Production requirements:

- provider endpoint configured through backend secrets
- no provider API key in Vite variables, public HTML, logs, or public docs
- strict Robinhood Chain ID verification on every provider health response
- hostname allowlist and HTTPS-only provider URLs
- request timeout, rate limit, circuit breaker, and emergency disable
- receipt verification from an independent read path where practical
- sanitized errors; raw provider response bodies stay private
- no silent fallback from mainnet to testnet or another chain

Provider selection is not complete until a Kyra-owned production endpoint is
configured. Alchemy is the default candidate because it is Robinhood's
documented recommendation, but Kyra must keep the provider behind an interface
so it can be changed without changing wallet authority or transaction policy.

### Prepared action and execution

All new actions must bind to chain ID `4663`. The initial allowlist remains
narrow:

- testnet: zero-value self-send for connection, prompt, submission, receipt,
  and closeout verification
- mainnet: one owner-controlled low-value action only after testnet closeout
- no arbitrary calldata
- no unlimited token approval
- no automated swap or bridge
- no Telegram or public-profile submitter
- no autonomous retry after wallet rejection or provider failure

Stock Tokens, tokenized ETFs, cross-chain bridges, gas sponsorship, session
keys, and account abstraction are out of the initial migration scope. They need
separate contract allowlists, risk models, jurisdiction review, user disclosure,
and release approval.

### Data compatibility

Historical Base records remain immutable historical evidence. Migration must:

- add explicit chain identity to new records
- prevent Base records from being submitted on Robinhood Chain
- avoid destructive rewriting of old transaction, approval, or audit rows
- keep public views sanitized across both historical and new data
- use a reversible database migration with RLS and ownership tests
- preserve owner, workspace, and deployed-agent scope

## Repository Impact Audit

The initial repository scan found 260 files containing Base-specific product,
provider, chain, or historical evidence references:

| Area | Files found | Migration treatment |
| --- | ---: | --- |
| Frontend and domain code | 39 | Replace runtime chain and connector assumptions |
| Supabase and Edge Functions | 29 | Add chain/provider abstraction and safe compatibility routes |
| Tests and check scripts | 99 | Migrate active assertions; retain explicit historical guards where needed |
| Docs and root metadata | 93 | Update current truth at cutover; preserve historical evidence labels |

The count is an impact inventory, not a mandate to edit every file. Historical
phase documents remain historical. Active runtime, tests, public copy, canonical
roadmap, and current context must agree before cutover.

Highest-risk hardcoded boundaries already confirmed:

- Wagmi provider imports Base and uses the Base Account connector.
- unsigned handoff requires chain ID `8453` and chain name `Base`.
- wallet eligibility and connection binding require Base Account and Base.
- Supabase provider status validates `0x2105` and Base RPC/provider URLs.
- transaction and closeout tests assert Base-only behavior.
- README, dashboard, deploy flow, public profiles, and writer context use
  Base-native product wording.

Known baseline verification finding:

- `npm audit --audit-level=high` reports one high-severity advisory through the
  Base-only dependency chain `@base-org/account` -> `@coinbase/cdp-sdk` ->
  `axios`. The proposed automatic fix is a breaking downgrade and is not
  accepted. Batch 3 must remove the obsolete Base connector dependency and the
  audit must return clean before Robinhood Chain cutover.

## Security And Privacy Non-Negotiables

- User wallet authority and Telegram bot-token privacy remain priority one.
- No custody, seed phrases, private keys, hidden signing, or platform wallet.
- Every transaction requires an authenticated owner and selected deployed agent.
- Kyra approval and wallet approval remain separate explicit events.
- Chain ID, account, action, nonce, expiry, value, calldata, and recipient are
  frozen before approval.
- Any drift, disconnect, timeout, replay, duplicate submit, or provider mismatch
  fails closed.
- Telegram remains read-only for wallet and transaction requests.
- Public profiles never expose wallet, provider, approval, transaction, or raw
  operational internals.
- Provider credentials and session tokens are backend-only and redacted.
- Logs store sanitized references, not secrets or raw signed payloads.
- Emergency disable and rollback stay available before any mainnet enablement.
- Public wording must not imply Robinhood affiliation, sponsorship, or
  endorsement.

## Migration Batches

### Batch 1 - Evidence and architecture

Status: complete when this blueprint, roadmap state, writer-context warning,
and automated document guard pass.

No runtime behavior changes.

### Batch 2 - Chain abstraction

Status: locally complete and verified; not deployed and not a production
cutover.

- add canonical Robinhood Chain mainnet/testnet definitions
- replace duplicated Base chain constants in active domain code
- add chain mismatch, drift, and fail-closed tests
- keep wallet signing and production submitter default-off

Implemented evidence:

- `src/config/productChains.ts` is the only active source of Base and Robinhood
  Chain numeric IDs, hex IDs, public diagnostic RPC URLs, and explorer URLs
- `currentProductChain` remains Base while `migrationTargetChain` is Robinhood
  Chain, preventing an implicit production cutover
- handoff, wallet binding, wallet network validation, Phase 8 policy, Phase 9
  eligibility, app config, and connector guards consume the registry
- malformed, decimal, hexadecimal, wrong-chain, current-chain, and migration-
  target inputs are covered by fail-closed tests
- `npm run check:chain-abstraction` guards against duplicated chain constants
  and confirms wallet execution stays disabled

Compatibility intentionally retained for Batch 3 and Batch 4:

- the Base Account connector is still the production wallet connector
- `base_*` action kinds, Base MCP function names, stored Base records, and
  current Base-facing copy remain unchanged
- Robinhood Chain is not present in the wallet runtime and cannot be selected,
  signed, submitted, or advertised as live

### Batch 3 - Wallet migration

- replace Base Account-only connection with audited EVM wallet connectors
- validate connect, disconnect, account change, chain change, rejection, expiry,
  and refresh behavior
- validate Robinhood Wallet compatibility before public claims
- keep all connection and execution state owner-only

### Batch 4 - Backend and provider migration

- introduce chain-neutral provider and prepared-action contracts
- migrate Supabase status, prepare, policy, rate-limit, and receipt paths
- add reversible schema migration and RLS tests
- configure a Kyra-owned production RPC secret
- retain compatibility wrappers until production callers are migrated

### Batch 5 - Testnet closeout

- deploy the migration behind disabled runtime flags
- complete one owner-controlled Robinhood Chain testnet transaction
- verify wallet prompt, chain ID, receipt, owner-only result, replay protection,
  rate limits, rollback, emergency disable, and public privacy
- record sanitized evidence without exposing wallet internals

### Batch 6 - Controlled mainnet cutover

- freeze one reviewed low-value mainnet action
- require explicit owner release approval
- complete one controlled mainnet transaction and receipt closeout
- switch active product copy and network defaults atomically
- monitor production and preserve rollback to the last known-good release
- retire Base-only runtime dependencies after the rollback window closes

## Cutover Gates

Robinhood Chain must not become Kyra's advertised live transaction lane until:

- all Batch 2-5 tests pass
- build and dependency audit pass
- the Base-only connector dependency and its transitive high-severity audit
  finding are removed
- Supabase RLS and Edge Function tests pass
- testnet end-to-end evidence exists
- a Kyra-owned production RPC provider is configured
- wallet support is manually verified on desktop and mobile paths
- chain and account drift fail closed
- transaction simulation or equivalent risk review is available
- receipt verification and owner-only closeout are proven
- incident response, emergency disable, and rollback are exercised
- secret scan and public privacy audit are clean
- owner explicitly approves the mainnet window and public copy cutover

## Rollback

Every runtime batch remains default-off until verified. If any chain, wallet,
provider, receipt, privacy, or policy check fails:

1. Disable Robinhood Chain submission immediately.
2. Preserve the sanitized failure evidence for the owner.
3. Keep Telegram and public profiles read-only.
4. Revert the active frontend and Edge Function release to the last known-good
   commit without rewriting historical data.
5. Revoke or rotate affected provider credentials.
6. Re-run the complete migration verification suite before reopening.

## Batch 1 Closeout

Batch 1 changes documentation and validation only. It authorizes later code
work but does not authorize a wallet prompt, signature, transaction submission,
provider secret creation, Supabase deployment, Netlify deployment, or public
Robinhood Chain marketing claim.
