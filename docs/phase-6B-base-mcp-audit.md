# Phase 6B Base MCP Preparation Audit

Audit date: 2026-06-14

Status: Phase 6B audit, first safe prepared-preview contract, and a
default-off backend function skeleton are in progress. No live Base MCP call,
wallet prompt, signing, or transaction submission is enabled.

## Security Priority

Primary rule: user privacy, user wallet security, and user Telegram bot token
security are number one.

6B must preserve:

- no seed phrase path
- no private key path
- no wallet custody
- no direct Telegram execution
- no live Base MCP transaction call
- no raw prepared transaction payload in public profiles
- no raw provider/MCP errors in UI

## Audited Areas

- `src/config/appConfig.ts`
- `src/components/ActionConsole.tsx`
- `src/components/WalletApprovalModal.tsx`
- `src/data/actions.ts`
- `src/data/demoScenarios.ts`
- `src/types/agent.ts`
- `src/types/backend.ts`
- `src/types/database.ts`
- `src/services/supabaseDashboardService.ts`
- `src/services/supabaseDeployService.ts`
- `supabase/schema.sql`
- `supabase/functions/deploy-agent/index.ts`
- `supabase/config.toml`
- `docs/backend-blueprint.md`
- `docs/phase-6-wallet-base-checklist.md`

## Current State

Base MCP is currently represented as product/status copy and database status
fields only.

Current facts:

- `appConfig.integrations.baseMcp` is `simulated`.
- `appConfig.integrations.walletExecution` is `disabled`.
- `supabase/functions/base-mcp-prepare/` exists as a default-off skeleton.
- `base-mcp-prepare` returns `base_mcp_disabled` before body, env, session,
  ownership, service-role, or adapter access while the runtime gate is off.
- `agent_instances.base_mcp_status` exists as a status field.
- `approval_requests.prepared_tx` and `approval_requests.tx_hash` exist for
  future phases.
- Dashboard reads do not fetch `prepared_tx` or `tx_hash`.
- Public agent profiles do not expose wallet, approval request, prepared
  transaction, transaction hash, or Telegram token fields.
- Telegram live behavior refuses wallet, swap, approval, Base MCP, and onchain
  execution requests.

## Findings

### F1 - No Callable Base MCP Adapter Exists Yet

There is no Base MCP endpoint URL, env config, service adapter, or Edge Function
that calls Base MCP today.

Risk: low. Execution is not accidentally live.

Decision: Phase 6B should start with a safe contract and preview, not a live
adapter.

### F2 - Existing `prepared_tx` Is Demo Metadata Only

Deploy code writes demo metadata into `approval_requests.prepared_tx`, but the
owner dashboard intentionally does not fetch it. This keeps raw prepared payload
handling out of the browser.

Risk: low while execution remains disabled.

Decision: future live prepared payloads should be behind a dedicated
owner-scoped summary view/RPC or opaque backend reference, not generic dashboard
reads.

### F3 - Swap/Send Are Not Safe First Candidates

`swap` and `send` are product actions, but they imply token movement and wallet
approval. They should not be first 6B candidates.

Risk: high if treated as the first live preparation target.

Decision: keep arbitrary swaps, transfers, contract calls, and Telegram-triggered
execution out of 6B.

### F4 - Safest First Candidate Is Read-Only Base MCP Status Check

The safest initial candidate is a read-only Base MCP status/capability check.
It can prove the boundary without calldata, token spend, gas request, wallet
prompt, or transaction submission.

Decision: first candidate is `base_mcp_status_check`.

### F5 - Base MCP Function Is Present But Not Live-Wired

The `base-mcp-prepare` Edge Function skeleton is now present for backend-only
review and local tests. It is intentionally not wired to a live Base MCP
provider by default.

Current behavior:

- disabled gate returns a fixed `base_mcp_disabled` response
- enabled path requires bearer session validation
- runtime gate enables only on exact `true`
- timeout defaults safely and caps at 5000 ms
- request freshness rejects stale requests older than 5 minutes
- request freshness rejects future timestamps beyond 60 seconds of clock skew
- preview expiry rejects expired previews or previews more than 10 minutes out
- enabled path accepts only `base_mcp_status_check`
- unsupported actions fail closed before ownership lookup
- ownership is checked before adapter access
- missing endpoint or missing adapter returns `base_mcp_not_configured`
- injected adapter failures return sanitized `base_mcp_unavailable`
- provider adapter draft maps a fake-transport status check to a fixed
  read-only summary and ignores raw provider payload fields
- optional prepared-action storage hook accepts only sanitized preview summaries
- prepared-action storage adapter draft maps sanitized summaries to the reviewed
  `prepared_actions` shape
- runtime dependencies do not wire the provider adapter yet
- runtime dependencies do not wire prepared-action storage yet
- static checks fail if frontend references Base MCP backend secrets or the
  prepare endpoint
- static checks fail if Telegram webhook calls or configures Base MCP
  preparation

Risk: low while the runtime gate remains off and no live provider adapter is
injected.

Decision: keep live provider calls behind a separate review and explicit
enablement approval.

### F6 - Prepared Action Needs A Bounded Read Model Before Storage

`approval_requests.prepared_tx` exists, but it is not the right browser read
model for Phase 6B. The dashboard should consume a bounded owner summary while
raw provider payloads stay backend-only or absent.

Decision: define `PreparedActionOwnerSummary` in `src/types/preparedAction.ts`
and keep public profiles plus Telegram away from prepared-action state.

Current guard:

- `npm run check:prepared-actions`
- `supabase/prepared_action_storage_schema_draft.sql` must stay comment-only
- `supabase/schema.sql` must not contain `public.prepared_actions` before an
  explicit apply phase
- dashboard approval query must not fetch `prepared_tx`, `tx_hash`, provider
  payloads, calldata, or Telegram token fields
- public profile files must not reference prepared-action owner summaries
- Telegram webhook files must not reference prepared-action owner summaries,
  provider payload refs, `prepared_tx`, or `tx_hash`

## First Prepared Preview Contract

Detailed adapter contract:
`docs/phase-6B-base-mcp-adapter-contract.md`

Prepared-action read model:
`docs/phase-6B-prepared-action-read-model.md`

Prepared-action storage draft:
`supabase/prepared_action_storage_schema_draft.sql`

Prepared-action SQL review packet:

- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

Owner-facing preview fields:

- `id`
- `status`
- `actionKind`
- `title`
- `chain`
- `routeSummary`
- `valueSummary`
- `risk`
- `expiresLabel`
- `approvalRequirement`
- `ownerScope`
- `safetyNote`

Current first candidate:

- `actionKind`: `base_mcp_status_check`
- `chain`: `Base`
- `risk`: `read-only`
- `valueSummary`: `No token spend, no gas request, no calldata.`
- `safetyNote`: `No wallet prompt, no signing, no transaction submission.`

## Explicit No-Go Items For 6B

- no wallet signing
- no transaction submission
- no live Base MCP call before adapter review
- no prepared-action public read model
- no browser read of `approval_requests.prepared_tx`
- no stale or future preparation request accepted
- no prepared action storage SQL apply during 6B local design
- no prepared action forward/rollback review packet apply without separate
  Supabase approval
- no arbitrary swap preparation
- no arbitrary send preparation
- no contract call preparation
- no Telegram-triggered execution
- no raw calldata as primary UI
- no raw provider/MCP errors shown to users

## Required Before Any Live Base MCP Adapter

- exact endpoint/config source documented
- timeout and retry behavior documented
- sanitized error contract documented
- allowed action allowlist documented
- default-off backend function skeleton tested
- no frontend `VITE_` secret path added
- static frontend and Telegram call-path guards added
- prepared-action read model documented and checked
- live expiry/replay enforcement started in the default-off function skeleton
- provider adapter draft tested with a fake transport only
- prepared-action storage hook contract tested without runtime DB wiring
- prepared-action storage adapter draft tested with a fake client only
- owner-scoped storage migration remains unapplied until explicit approval
- confirm public profiles remain share-safe
- run `npm run check:phase-6b`
- run `npm run check:base-mcp`
- run `npm run check:prepared-actions`
- run `npm run check:privacy`
- run `npm run check:functions`
- run `npm run build`

## Completed Local Verification

- `npm run check:phase-6b`
- `npm run check:privacy`
- `npm run check:base-mcp`
- `npm run check:prepared-actions`
- `npm run check:functions`
- `deno test supabase/functions/base-mcp-prepare/index_test.ts supabase/functions/base-mcp-prepare/runtime-config_test.ts supabase/functions/base-mcp-prepare/storage-adapter_test.ts supabase/functions/base-mcp-prepare/provider-adapter_test.ts`
  - expected current count: 28 passed
- targeted Deno read-only Telegram tests
- `npm run build`
- `git diff --check`
- local desktop/mobile dashboard smoke

## Remaining Before Push/Deploy

- review local diff
- commit locally
- push only after approval
- live smoke dashboard and Telegram refusal after deploy
