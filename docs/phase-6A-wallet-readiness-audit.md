# Phase 6A Wallet Readiness Audit

Audit date: 2026-06-14

Status: Phase 6A audit complete. No wallet signing, Base MCP calls, or
transaction submission are enabled by this audit.

## Security Priority

Primary rule: user privacy and security are number one.

Highest-risk assets:

- user wallet security
- user Telegram bot token security

Audit standard:

- no seed phrase path
- no private key path
- no custody path
- no hidden signing path
- no Telegram-triggered execution path
- no public route exposing wallet, prepared transaction, or Telegram token data

## Audited Areas

- `src/components/WalletApprovalModal.tsx`
- `src/components/ActionConsole.tsx`
- `src/pages/Dashboard.tsx`
- `src/types/backend.ts`
- `src/types/database.ts`
- `src/data/actions.ts`
- `src/data/demoBackend.ts`
- `src/data/demoScenarios.ts`
- `src/services/supabaseDashboardService.ts`
- `src/services/supabaseDeployService.ts`
- `src/services/supabasePublicAgentService.ts`
- `src/config/appConfig.ts`
- `supabase/schema.sql`
- `supabase/seed.sql`
- `supabase/verify_authenticated_demo_write_lockdown.sql`

## Current State

Phase 5 production behavior is still read-only from Telegram.

Dashboard state:

- wallet policy is visible in the owner dashboard
- approval queue shows safe summaries: title, command, route, risk, status, fee
  payer, and wallet requirement
- readiness panel marks execution as `simulated` because `walletExecution` is
  currently `disabled`
- reset copy explicitly says it does not touch real funds, wallet keys, private
  keys, Telegram tokens, or onchain transactions

Wallet modal state:

- `WalletApprovalModal` is a demo-only UI
- it displays command, route, network, risk, and `Execution: Disabled`
- it does not connect to a provider
- it does not sign messages
- it does not submit transactions

Backend state:

- `wallet_policies.wallet_address` exists and is nullable
- `approval_requests.prepared_tx` and `approval_requests.tx_hash` exist for
  future action state
- deploy fallback creates only simulated wallet policy and demo prepared
  transaction metadata
- Telegram sessions store `token_secret_ref`, but public/dashboard summary paths
  avoid returning it

Public profile state:

- `public_agent_profiles` exposes only agent identity, status, network,
  Telegram/Base status, and template summary fields
- public profile service does not fetch wallet policies, approval requests,
  prepared transactions, transaction hashes, or token secret references

## Findings

### F1 - Wallet Execution Is Not Live Yet

The product has the right safety posture for Phase 5 and early Phase 6:
execution remains disabled. The current wallet experience is a readiness/demo
surface, not a real wallet connection or signing flow.

Risk: low, as long as copy keeps saying execution is gated or disabled.

Decision: do not enable wallet provider, signing, or Base MCP in 6A without a
separate implementation review.

### F2 - Public Agent Profile Is Share-Safe

The public Supabase view and public agent service do not expose wallet address,
wallet policy, prepared transaction payload, transaction hash, or Telegram token
secret references.

Risk: low.

Decision: keep public profile output limited to identity, status, network, and
template data.

### F3 - Telegram Token Boundary Is Properly Separated

Telegram token handling is backend-oriented. The summary view excludes
`token_secret_ref`, and the verification SQL checks that sensitive Telegram
session columns are not exposed through the summary view.

Risk: low if future work keeps BotFather tokens backend-only.

Decision: never place BotFather tokens in browser storage, public profiles,
logs, screenshots, or API responses.

### F4 - Dashboard Query Was Too Broad For Future Live Prepared Transactions

`supabaseDashboardService` previously fetched `wallet_policies?select=*` and
`approval_requests?select=*`.

That was acceptable while records were demo-scoped and the mapper did not expose
`prepared_tx` or `tx_hash` to UI types. For Phase 6, once `prepared_tx` can
contain real action payloads, `select=*` would still pull the raw payload into
the browser even if the UI did not display it.

Status: remediated for the current dashboard read path.

Current dashboard reads now request only the wallet policy and approval request
columns needed for the owner UI. Raw `prepared_tx` and `tx_hash` are not fetched
by the dashboard service.

Still required before Phase 6B/6C:

- keep raw prepared payloads behind owner-scoped backend references or a
  dedicated summary view/RPC
- expose only safe transaction summaries to the browser

### F5 - Database RLS Is Owner-Scoped But Column Grants Are Broad

RLS limits `wallet_policies` and `approval_requests` to workspace owners. That
is the correct ownership boundary.

However, authenticated users currently have table-level `select` on these
tables. RLS still protects rows, but before live wallet data exists, we should
prefer narrower columns or summary views for browser reads.

Risk: medium before live wallet/prepared transaction payloads.

Required before live wallet execution:

- review column grants or introduce owner dashboard summary views
- keep raw prepared payloads service-role/backend-only where possible
- add verification that public and anon cannot read wallet or prepared action
  data

### F6 - Product Copy Contains Future Execution Language

Some product copy says Kyra can prepare swaps/transfers for wallet approval.
That is acceptable as roadmap/product positioning only while Phase 5/6A surfaces
clearly state execution is disabled or gated.

Risk: low to medium UX risk.

Decision: keep Phase 6A copy explicit: readiness only, approval required,
execution gated.

## Safe Phase 6A Implementation Slice

Implemented local slice:

1. Added a wallet readiness model for dashboard display only:
   - `not_connected`
   - `connected_wrong_network`
   - `connected_ready_for_approval`
   - `execution_disabled`
2. Narrowed Supabase dashboard selects for wallet policies and approval
   requests.
3. Kept `prepared_tx` and `tx_hash` out of browser dashboard reads until a
   dedicated owner-safe preview contract exists.
4. Improved dashboard wallet panel copy so it distinguishes:
   - connected policy record
   - safe shortened owner-only address
   - network readiness
   - approval gate
   - execution disabled

Completed local verification:

- `npm run check:privacy`
- `npm run check:functions`
- targeted Deno read-only Telegram tests
- `npm run build`
- `git diff --check`
- local desktop/mobile dashboard smoke

Remaining live verification after deploy:

- smoke test Telegram `/policy` against the live bot

## Explicit No-Go Items For 6A

- no wallet provider integration yet
- no wallet signing yet
- no Base MCP call yet
- no transaction submission yet
- no direct Telegram execution
- no raw prepared transaction payload in public routes
- no BotFather token in browser-facing code or logs

## Completion Gate For 6A

Phase 6A can be considered complete when:

- dashboard wallet readiness is explicit
- public profiles remain share-safe
- dashboard reads only minimum wallet/approval columns
- Telegram still refuses wallet/onchain execution
- `npm run check:privacy` passes
- `npm run check:functions` passes
- `npm run build` passes
- `git diff --check` passes
