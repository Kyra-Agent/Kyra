# Product Readiness Snapshot

## Ready

- Robinhood Chain is the only active product chain family.
- Mainnet 4663 and testnet 46630 are the only accepted chain identities.
- React production UI, Supabase Auth, RLS, Edge Functions, agent deployment, public profiles, Telegram, and LLM replies are implemented.
- EVM wallet discovery supports compatible injected wallets with provider identity shown after connection.
- Prepared actions are immutable, allowlisted, rate-limited, owner-scoped, workspace-bound, agent-bound, chain-bound, and sanitized.
- Wallet signing is user-controlled and Telegram execution is blocked.
- Transaction closeout verifies the stored intent and Robinhood Chain receipt from the backend RPC before persisting sanitized owner-only evidence.
- Telegram delivery uses a bounded retry lease and records metadata only; message content and tokens are never copied into delivery state.
- Browser auth and observability state are session-scoped, with legacy persistent auth storage removed.
- Privacy and product checks scan public surfaces, Edge Functions, environment examples, database views, active chain identity, and auth storage.

## Controlled

- Wallet submission flags remain independent from chain release flags.
- Mainnet RPC credentials remain backend-only.
- A live window is short-lived and invalidated by disconnect, scope drift, or emergency disable.
- Transaction result data is owner-only and sanitized.
- Receipt closeout is implemented through an authenticated Edge Function and an RLS-protected table. The browser submits only scoped IDs and a transaction hash; the backend derives identity and status from stored intent plus RPC evidence.
- Raw provider payloads, Telegram content, private keys, seed phrases, and secret values are never persisted in closeout or retry metadata.
- Runtime submitter enablement fails closed when the closeout backend is unavailable.

## Recorded Release Evidence

Sanitized production evidence recorded for the owner-controlled mainnet lane:

- one bounded owner-approved mainnet transaction - completed with zero value
- verified receipt and confirmation - completed on Robinhood Chain mainnet
- authenticated backend persistence - one owner-only result record observed
- owner dashboard backend closeout recorded as `saved` - completed
- no sensitive payload in browser logs, public views, or support evidence
- tested emergency disable and rollback - completed
- explicit owner-controlled release decision - recorded

This release does not enable Telegram execution, public-profile execution, autonomous fund movement, token approvals, arbitrary calldata, or hidden signing. Each transaction still requires a signed-in user, selected deployed agent, matching Robinhood Chain wallet, reviewed immutable action, NYX-05 policy approval, and a fresh one-time wallet prompt.

## Production Hardening Closeout

The July 27 hardening batch is deployed and verified in production. The four intent-verification and Telegram-delivery migrations are synchronized with the linked database, the updated Edge Functions are active, and the Robinhood mainnet build, browser smoke checks, dependency audit, CI, privacy checks, and live health checks pass. Verification was reconfirmed on 2026-07-28.
