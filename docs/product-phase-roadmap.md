# Kyra Product Roadmap

Kyra uses one ten-phase product roadmap. Historical sub-batches are implementation evidence, not additional product phases.

| Phase | Outcome | Status |
| --- | --- | --- |
| 1 | Product foundation and visual system | Complete |
| 2 | Agent templates and five-module stack | Complete |
| 3 | Supabase persistence, Auth, and owner-scoped RLS | Complete |
| 4 | Agent deployment and public profiles | Complete |
| 5 | Telegram webhook and LLM replies | Complete |
| 6 | Wallet policy, prepared actions, and risk controls | Complete |
| 7 | Owner wallet connection and chain-bound approvals | Complete |
| 8 | Controlled execution workflow and receipt model | Complete, submitter fail-closed |
| 9 | Abuse controls, incidents, monitoring, and privacy | Complete |
| 10 | Robinhood Chain public cutover and release closeout | In final mainnet receipt gate |

## Current Product State

Live now:

- account creation and sign-in
- private workspaces and up to three deployed agents
- share-safe public agent profiles
- Telegram linking, read-only commands, and LLM-generated planning
- Robinhood Chain mainnet/testnet wallet connection
- selected-agent chain binding
- prepared-action allowlist and NYX-05 risk review
- explicit owner approval and transaction preflight
- private monitoring, removal, disconnect, and emergency controls

Final gated item:

- enable public transaction submission only after a bounded mainnet receipt, sanitized result persistence, rollback verification, and explicit release approval

## Non-Negotiable Rules

User wallet authority and Telegram token privacy are priority one. Kyra never stores private keys or seed phrases. Telegram never signs. Public pages never expose operational internals. Every write is owner-scoped, every chain action is agent-bound, and every missing prerequisite fails closed.
