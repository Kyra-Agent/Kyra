# Kyra Backend Blueprint

## Product Contract

Kyra deploys account-scoped AI agents with private Supabase records, Telegram-native read-only interaction, public agent profiles, and approval-first Robinhood Chain workflows.

## Runtime Architecture

1. React and TypeScript render the public product and private workspace.
2. Supabase Auth owns account sessions.
3. Row Level Security scopes workspace data to its owner.
4. Edge Functions validate ownership before deployment, Telegram linking, agent removal, or prepared-action creation.
5. OpenRouter is called only from the Telegram Edge Function. Its API key never reaches the browser.
6. Robinhood Chain status checks run through backend-only RPC configuration.
7. The connected EVM wallet remains the only signing authority.

## Chain Contract

Supported networks:

- Robinhood Chain mainnet, chain ID 4663
- Robinhood Chain testnet, chain ID 46630

Every agent, wallet policy, approval request, prepared action, and rate-limit record carries the same chain identity. Database triggers reject cross-agent and cross-chain writes.

## Data Privacy

Public profiles expose only share-safe identity, template, action, module, Telegram status, and chain-action status fields. Wallet addresses, provider payloads, token references, approval internals, transaction payloads, and secrets remain private.

Telegram bot tokens are stored only through backend secret storage. Wallet private keys and seed phrases are never requested or stored.

## Execution Boundary

Telegram and public profiles cannot prompt wallets, sign, or submit transactions. The private workspace requires a signed-in owner, selected deployed agent, matching Robinhood network, reviewed prepared action, explicit owner approval, and a fresh live window. Submission stays fail-closed when any prerequisite is absent.
