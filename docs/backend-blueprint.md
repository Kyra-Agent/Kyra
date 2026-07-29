# Kyra Backend Blueprint

Production status: live and verified on 2026-07-28.

## Product Contract

Kyra deploys account-scoped AI agents with private Supabase records, Telegram-native read-only interaction, public agent profiles, and approval-first Robinhood Chain workflows.

## Runtime Architecture

1. React and TypeScript render the public product and private workspace.
2. Supabase Auth owns account sessions.
3. Row Level Security scopes workspace data to its owner.
4. Edge Functions validate ownership before deployment, Telegram linking, agent removal, or transaction-intent preparation.
5. OpenRouter is called only from the Telegram Edge Function. Its API key never reaches the browser.
6. Robinhood Chain status checks run through backend-only RPC configuration.
7. The connected EVM wallet remains the only signing authority.

All product Edge Functions are active in the linked Supabase project, and the linked migration history is synchronized with the repository. Runtime gates remain independent and fail closed even when a function is deployed.

## Telegram Brain Boundary

The Telegram webhook authenticates the bot and owner chat before resolving the
persisted agent. Eligible natural-language requests receive an exact template
context containing the agent identity, role, allowed actions, and module stack.
Provider output must preserve that identity in any supported language.

Foreign-template identity claims and capabilities are rejected. The backend
permits one bounded repair request, then uses a deterministic template-safe
response only when the provider remains unavailable or invalid. Cross-template
comparison is allowed as context, but the active agent never switches identity.
Execution-like messages are rejected before the LLM path. Provider credentials,
prompts, raw responses, and validation reasons remain backend-only.

## Chain Contract

Supported networks:

- Robinhood Chain mainnet, chain ID 4663
- Robinhood Chain testnet, chain ID 46630

Every agent, wallet policy, approval request, prepared action, and rate-limit record carries the same chain identity. Database triggers reject cross-agent and cross-chain writes.

## Data Privacy

Public profiles expose only share-safe identity, template, action, module, Telegram status, and chain-action status fields. Wallet addresses, provider payloads, token references, approval internals, transaction payloads, and secrets remain private.

Telegram bot tokens are stored only through backend secret storage. Wallet private keys and seed phrases are never requested or stored. Browser authentication and observability state are session-scoped, and legacy persistent auth state is removed on load.

## Execution Boundary

Telegram and public profiles cannot prompt wallets, sign, or submit
transactions. The private workspace requires a signed-in owner, selected
deployed agent, matching Robinhood network, backend-persisted immutable intent,
reviewed prepared action, explicit owner approval, and a fresh live window.
Backend closeout verifies the transaction and receipt against that intent
before sanitized owner-only persistence.

The current public lane permits only one exact `0.0001 ETH` self-transfer to
the connected owner wallet with no calldata. General transfers, ERC-20
transfers, swaps, token approvals, arbitrary recipients, arbitrary values, and
arbitrary calldata remain disabled until the separate transaction-expansion
release gates pass. Submission fails closed when any prerequisite is absent.
