# Transaction Expansion Roadmap

Status: T1 is production-active on Robinhood Chain as a protected,
private-dashboard transfer lane. Its database migrations, JWT-protected Edge
Functions, production build, and bounded non-transactional release smoke passed
on 2026-07-31. The complete T2 protected-swap foundation is implemented and verified locally, including exact allowance preparation, calldata verification, explicit wallet review, receipt closeout, and allowance cleanup. Its schema and JWT-protected functions were deployed default-off on 2026-08-02; it remains unreleased pending provider configuration and qualification, while T3-T4 remain planned.

## Starting Point

Kyra v1.0.0 already provides the security foundation required for controlled
onchain work:

- authenticated private workspaces
- selected-agent and Robinhood Chain binding
- user-controlled wallet connection
- immutable backend transaction intents
- NYX-05 deterministic policy review
- explicit wallet approval
- short-lived one-time submission windows
- backend RPC transaction and receipt verification
- sanitized account-only closeout evidence
- emergency disable and rollback controls

Before T1, the transaction lane was limited to one exact `0.0001 ETH`
self-transfer on Robinhood Chain mainnet with no calldata. T1 replaces that
qualification lane with the bounded native ETH and official KYRA transfer policy
documented below. Telegram and public profiles still cannot approve, sign, or
submit.

## Target

Continue from T1 into allowlisted swaps, hardening, and staged public release
without weakening the current privacy and approval boundary. Every transaction
must remain initiated from the authenticated private workspace and signed by
the user's connected wallet.

Original T1-T4 estimate: 8-12 working days. With T1 production-active, the
remaining T2-T4 estimate was 6-9 working days before the local T2 foundation was completed. The remaining schedule is gate-driven and will be revised only after provider configuration, security qualification, and release evidence are fixed.

## T1 - Transfer Lane

Status: production-active since 2026-07-31.

Original estimate: 2-3 working days.

Scope:

- native Robinhood Chain ETH transfers
- the official KYRA ERC-20 only: `0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1`
- checksummed recipient validation and explicit recipient confirmation
- token contract, decimals, amount, balance, gas, and chain validation
- per-action limits: `0.005 ETH` or `10,000 KYRA`
- per-workspace daily limits: `0.02 ETH` or `50,000 KYRA`
- immutable backend intent binding for recipient, asset, amount, and expiry
- wallet simulation or estimation before the confirmation prompt
- backend receipt and ERC-20 transfer-event verification

Release evidence:

- local policy, Edge Function, receipt-verification, privacy, product, and build checks pass
- recipient, asset, amount, chain, agent, or account drift fails closed
- failed, replaced, delayed, and replayed transactions have deterministic tests
- no Telegram, public-profile, or background submission path exists
- production migrations are synchronized and the updated Edge Functions are active with JWT verification
- the production frontend exposes the protected transfer flow while signed-out and public surfaces remain private
- CORS preflight succeeds and unauthenticated function requests fail closed
- the activation smoke was non-transactional; value transfers still require explicit confirmation in the user's connected wallet

## T2 - Swap Lane

Status: the complete protected-swap foundation was implemented and verified locally on 2026-08-01. Its schema and three JWT-protected Edge Functions were deployed default-off on 2026-08-02. Provider credentials are not configured, the frontend gate remains off, and production swap prompts, approvals, and submissions remain disabled.

Original estimate: 2-3 working days.

Implemented locally:

- exact-input requests are limited to native ETH and the official KYRA token on Robinhood Chain mainnet
- 0x AllowanceHolder access is backend-only and constrained by provider, router, allowance-target, liquidity-source, token, amount, slippage, deadline, and response-size policy
- owner, workspace, selected agent, wallet, chain, quote fingerprint, route, taker, amount, allowance target, and calldata are bound into immutable service-only records
- exact allowance preparation is used only when needed; unlimited approvals, arbitrary spenders, and browser-authored approval payloads are rejected
- a fresh backend quote is required after allowance, and decoded swap calldata must match the stored quote before any wallet prompt is prepared
- the private dashboard uses explicit, sequential wallet review for allowance and swap actions; no automatic prompt or background submission exists
- backend receipt verification, replay-safe terminal closeout, failed-swap recovery, and allowance revoke-to-zero routing are implemented
- insufficient balance, incomplete simulation, stale responses, provider drift, request drift, changed wallet scope, and terminal-state replay fail closed
- browser responses and persisted owner records are sanitized; API keys, raw provider payloads, internal router material, secrets, and public execution state stay hidden
- the frontend lane is protected by `VITE_KYRA_PROTECTED_SWAP_ENABLED=false`, while backend execution independently requires `KYRA_PROTECTED_SWAP_EXECUTION_ENABLED=true`

Remaining before T2 release:

- configure production 0x credentials and exact provider, host, router, allowance-target, and liquidity-source allowlists as backend secrets
- confirm the deployed T2 migrations and all three JWT-protected Edge Functions remain healthy and execution-disabled before provider qualification
- qualify RLS, JWT ownership, CORS, rate limits, wallet prompts, quote expiry, receipt verification, replay handling, failure recovery, cleanup, privacy, and browser UX end to end
- record one bounded owner-controlled mainnet canary and verify allowance cleanup plus sanitized closeout evidence
- obtain an explicit release decision before enabling the backend execution flag and frontend feature flag

Release gate:

- arbitrary routers, tokens, recipients, values, calldata, unlimited approvals, Telegram prompts, public-profile prompts, and autonomous execution remain blocked
- stale quotes, changed wallet prompts, changed agent scope, receipt mismatches, replay attempts, and provider disagreement fail closed
- allowance revocation, failed-swap recovery, emergency disable, and rollback are tested and recorded
- no T2 production-live claim is allowed until deployment, canary, and explicit release approval are complete

## T3 - Security And Operations

Estimated time: 2-3 working days.

Scope:

- account, wallet, token, action, and daily rate limits
- nonce, replay, idempotency, and concurrent-request protection
- deterministic NYX-05 policy rules for transfers and swaps
- emergency pause, connector disconnect, and allowance-revocation procedures
- sanitized monitoring, incident states, and account-only support evidence
- privacy checks for public pages, Telegram, logs, analytics, and error responses
- provider outage, RPC disagreement, receipt delay, and reorganization handling

Release gate:

- security and privacy suites pass with no high-severity findings
- emergency controls invalidate every active submission window
- secrets, wallet internals, transaction payloads, and provider responses remain
  outside public surfaces and ordinary logs

## T4 - Audit And Staged Release

Estimated time: 2-3 working days.

Scope:

- unit, integration, browser, RLS, Edge Function, and end-to-end tests
- Robinhood Chain testnet qualification where supported
- bounded mainnet canary using a low configured value limit
- independent review of intent, approval, calldata, receipt, and rollback logic
- user-facing transaction review, error, retry, and recovery UX
- production monitoring, support runbook, release notes, and rollback decision

Release gate:

- GitHub CI, production build, dependency audit, privacy checks, and service
  health checks pass
- transfer and swap evidence is verified and stored only in sanitized
  account-scoped records
- an explicit release decision records supported assets, routers, limits, and
  emergency owners

## Boundaries That Remain

Completing T1-T4 does not enable:

- Telegram-triggered signing or submission
- public-profile transaction access
- autonomous or scheduled fund movement
- arbitrary contract calls or arbitrary calldata
- hidden approvals or hidden signing
- private-key or seed-phrase custody

Those capabilities require separate threat models and release decisions. They
are not part of the planned public transaction expansion.
