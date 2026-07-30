# Transaction Expansion Roadmap

Status: T1 is implemented and verified locally as a release candidate. It is not
public until its database migrations, Edge Functions, production build, and bounded
mainnet smoke pass an explicit release decision. T2-T4 remain planned.

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

The live transaction lane is intentionally narrow: one exact `0.0001 ETH`
self-transfer on Robinhood Chain mainnet with no calldata. Telegram and public
profiles cannot approve, sign, or submit.

## Target

Open user-controlled native transfers, allowlisted ERC-20 transfers, and
allowlisted swaps without weakening the current privacy and approval boundary.
Every transaction must remain initiated from the authenticated private
workspace and signed by the user's connected wallet.

Estimated engineering time: 8-12 working days after integration targets,
supported assets, and release limits are fixed.

## T1 - Transfer Lane

Status: implementation complete locally; production activation pending.

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

Release gate:

- local policy, Edge Function, receipt-verification, privacy, product, and build checks pass
- recipient, asset, amount, chain, agent, or account drift fails closed
- failed, replaced, delayed, and replayed transactions have deterministic tests
- no Telegram, public-profile, or background submission path exists
- production migrations, Edge Function deployment, bounded mainnet smoke, and release approval remain pending

## T2 - Swap Lane

Estimated time: 2-3 working days.

Scope:

- approved Robinhood Chain router and token allowlists
- reviewed quote binding with input, minimum output, route, slippage, and deadline
- exact allowance policy with no unlimited default approval
- decoded calldata verification against the backend-stored quote
- balance, gas, liquidity, price-impact, and stale-quote checks
- explicit approval for both allowance and swap when two wallet actions are needed
- verified receipt and swap-result closeout

Release gate:

- arbitrary routers, tokens, recipients, values, and calldata remain blocked
- stale quotes and changed wallet prompts fail closed
- approval revocation and failed-swap recovery are tested

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
