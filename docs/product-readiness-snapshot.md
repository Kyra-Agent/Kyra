# Product Readiness Snapshot

Snapshot date: 2026-07-30.

## User-Available Product

Signed-in users can create a private workspace, deploy up to three agents,
publish sanitized agent profiles, connect and authorize a Telegram bot, use
multilingual LLM-assisted read-only planning, connect a compatible EVM wallet
on Robinhood Chain, and complete the bounded self-transfer review flow.

The transaction surface is not general-purpose. Only the exact `0.0001 ETH`
self-transfer policy described below is released.

## Ready

- Robinhood Chain is the only active product chain family.
- Mainnet 4663 and testnet 46630 are the only accepted chain identities.
- React production UI, Supabase Auth, RLS, Edge Functions, agent deployment, public profiles, Telegram, and LLM replies are implemented.
- Exact template context is enforced across all six templates, with multilingual
  identity preservation, foreign-template rejection, one bounded repair
  attempt, and a template-safe fallback when provider output remains invalid.
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

- historical zero-value owner-controlled proof - completed on Robinhood Chain mainnet
- bounded value-bearing policy - fixed `0.0001 ETH` self-transfer to the connected owner wallet, no calldata
- verified receipt and confirmation - completed on Robinhood Chain mainnet
- authenticated backend persistence - one owner-only result record observed
- owner dashboard backend closeout recorded as `saved` - completed
- no sensitive payload in browser logs, public views, or support evidence
- tested emergency disable and rollback - completed
- explicit owner-controlled release decision - recorded

This release does not enable Telegram execution, public-profile execution, autonomous fund movement, token approvals, swaps, arbitrary recipients, arbitrary values, arbitrary calldata, or hidden signing. Each bounded self-transfer still requires a signed-in user, selected deployed agent, matching Robinhood Chain wallet, reviewed immutable action, NYX-05 policy approval, a backend-prepared one-time intent, and a fresh wallet prompt.

## Production Hardening Closeout

The July 27 hardening batch is deployed and verified in production. The four intent-verification and Telegram-delivery migrations are synchronized with the linked database, the updated Edge Functions are active, and the Robinhood mainnet build, browser smoke checks, dependency audit, CI, privacy checks, and live health checks pass. Verification was reconfirmed on 2026-07-28.

## v1.0.0 Qualification

Release qualification was completed on 2026-07-29. Product checks, all 44 selected test scripts, the Robinhood mainnet build, and the production dependency audit passed. Public production routes remained healthy, the linked Supabase project retained migration parity, and every deployed Edge Function remained active.

## Post-Release Verification

The 2026-07-30 Telegram hardening batch passed the current 45-script automated
suite, targeted agent-brain and webhook tests, product checks, the Robinhood
Chain mainnet build, and GitHub CI. The active production webhook was confirmed
to fail closed with a sanitized `401` when its secret header was absent, and
the public site remained healthy. This verification did not widen wallet,
transaction, Telegram, or public-profile permissions.

## T1 Production Active

The native ETH and official KYRA transfer lane was activated in production on
2026-07-31. The fixed allowlist contains only native Robinhood Chain ETH and
KYRA contract `0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1`.
Per-action limits are `0.005 ETH` and `10,000 KYRA`; per-workspace UTC-day
limits are `0.02 ETH` and `50,000 KYRA`. Self-transfers, arbitrary ERC-20
contracts, token approvals, swaps, arbitrary calldata, Telegram submission, and
public-profile submission remain blocked.

Production evidence includes synchronized transfer-policy migrations, active
JWT-protected intent and closeout Edge Functions, the live Netlify dashboard
bundle, successful CORS preflight checks, denied unauthenticated requests, and
a clean signed-out privacy smoke. The release smoke did not submit a value
transfer; every real transfer still requires the user's connected wallet and
explicit wallet confirmation.

## Planned Transaction Expansion

The remaining release track contains three grouped phases: allowlisted swaps
with exact approvals, security and operations hardening, then an audited
mainnet canary and staged release. T2-T4 remain planned and locked until their
respective release gates pass.

See [Transaction Expansion Roadmap](transaction-expansion-roadmap.md).
