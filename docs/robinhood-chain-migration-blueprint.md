# Robinhood Chain Migration

## Decision

Robinhood Chain replaces the previous product-chain implementation across public copy, frontend runtime, wallet discovery, Edge Functions, database contracts, deployment defaults, and operational documentation.

## Canonical Networks

| Environment | Chain ID | Use |
| --- | ---: | --- |
| Robinhood Chain | 4663 | production target |
| Robinhood Chain Testnet | 46630 | controlled validation |

## Completed Cutover

- frontend registry contains Robinhood mainnet and testnet only
- default public build targets Robinhood mainnet
- wallet runtime uses chain-aware EVM connectors
- deployed agents persist a Robinhood chain key and ID
- chain status and prepared-action functions use Robinhood-only backend contracts
- existing persisted records are migrated forward to Robinhood mainnet
- public profiles expose chain-action status instead of legacy provider status
- obsolete provider functions, configuration, scripts, and public docs are retired

## Safety Boundary

Migration does not automatically enable transaction submission. Chain selection, RPC readiness, wallet connection, prepared-action review, owner approval, runtime submission, receipt verification, and release approval remain independent gates.

## Rollback

If mainnet evidence fails, disable controlled submission and low-value submission flags, keep agent deployment and Telegram online, revoke the owner live window, and investigate only through sanitized owner evidence. Do not restore an obsolete chain runtime.
