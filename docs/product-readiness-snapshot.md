# Product Readiness Snapshot

## Ready

- Robinhood Chain is the only active product chain family.
- Mainnet 4663 and testnet 46630 are the only accepted chain identities.
- React production UI, Supabase Auth, RLS, Edge Functions, agent deployment, public profiles, Telegram, and LLM replies are implemented.
- EVM wallet discovery supports compatible injected wallets with provider identity shown after connection.
- Prepared actions are allowlisted, rate-limited, owner-scoped, agent-bound, chain-bound, and sanitized.
- Wallet signing is user-controlled and Telegram execution is blocked.
- Privacy checks scan public surfaces, Edge Functions, environment examples, and database views.

## Controlled

- Wallet submission flags remain independent from chain release flags.
- Mainnet RPC credentials remain backend-only.
- A live window is short-lived and invalidated by disconnect, scope drift, or emergency disable.
- Transaction result data is owner-only and sanitized.

## Final Release Evidence

Public transaction submission requires:

- one bounded owner-approved mainnet transaction
- verified receipt and confirmation
- no sensitive payload in browser logs, public views, or support evidence
- tested emergency disable and rollback
- recorded release decision

Until those checks pass, Kyra remains fully usable for agent deployment, Telegram intelligence, wallet connection, prepared-action review, and risk analysis while transaction submission fails closed.
