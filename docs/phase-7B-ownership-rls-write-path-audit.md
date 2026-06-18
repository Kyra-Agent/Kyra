# Phase 7B Ownership, RLS, And Write Path Audit

Date: 2026-06-18

Status: audit packet started. No production prepared-action write, Base MCP
runtime write, wallet prompt, signature, or transaction submission is enabled.

## Objective

Phase 7B audits every execution-adjacent ownership and write boundary before
Kyra can enable any live execution candidate.

The goal is to prove that a signed-in owner can only see and mutate records
through reviewed owner-scoped paths, and that browser/public/Telegram surfaces
cannot create execution state directly.

Primary protected assets:

- User wallet security.
- User Telegram bot token security.
- Owner workspace boundaries.
- Prepared-action write integrity.
- Transaction state integrity.

## Current Finding

Current state is acceptable for Phase 7B entry:

- RLS is enabled on core workspace, agent, wallet policy, approval, activity
  log, Telegram session, Telegram secret, Telegram authorization, update claim,
  and owner-link tables.
- Browser `authenticated` grants for core dashboard tables are read-only.
- `anon` can read only public-safe profile/template surfaces.
- Demo record writes are intended to happen through Edge Functions with
  `service_role`.
- `deploy-agent` validates the signed-in user through the anon client, then
  performs backend writes through the service client.
- `reset-demo-workspace` requires an admin Supabase session before deleting a
  signed-in demo workspace through the service client.
- Prepared-action storage remains review-only SQL and is not part of the
  baseline schema.
- The frontend direct REST deploy path exists only as a local development
  fallback guarded by `import.meta.env.DEV`.

## Sensitive Write Paths

These tables are execution-adjacent and must not be directly writable by public
or browser clients:

- `workspaces`
- `agent_instances`
- `wallet_policies`
- `approval_requests`
- `activity_logs`
- `telegram_sessions`
- `telegram_bot_token_secrets`
- `telegram_webhook_secrets`
- `telegram_chat_authorizations`
- `telegram_processed_updates`
- `telegram_owner_link_challenges`
- `telegram_owner_link_consume_rate_limits`
- future `prepared_actions`
- future execution result storage

Current expected write mediation:

| Path | Writer | Current Status |
| --- | --- | --- |
| Demo deploy records | `deploy-agent` Edge Function | service-role backend write after user auth |
| Demo reset | `reset-demo-workspace` Edge Function | admin-only backend delete |
| Telegram token storage | `telegram-connect` Edge Function/RPC | backend-only secret refs |
| Telegram update claim | webhook RPC | service-role only |
| Owner link challenge | connect/webhook RPC | service-role only |
| Prepared action storage | none | review SQL only |
| Base MCP preparation | none | runtime disabled |
| Wallet signing/submission | none | disabled |

## Browser Boundary

Browser clients may read owner-scoped dashboard records, but they must not own
production write paths for execution-adjacent state.

Allowed browser behavior:

- read selected owner dashboard records through RLS
- read public profile data through share-safe views
- call Edge Functions with a Supabase bearer token
- show non-executing wallet/Base review state

Blocked browser behavior:

- insert/update/delete execution-adjacent records in production
- create prepared actions directly
- write approval records directly
- submit transaction hashes directly
- open wallet prompts without explicit owner click
- call Base MCP runtime functions from public or Telegram surfaces
- store or display Telegram bot tokens, wallet secrets, raw calldata, raw
  provider payloads, private keys, seed phrases, or API keys

## RLS And Grant Rules

Phase 7B requires:

- RLS enabled on every sensitive table.
- Owner reads use `public.owns_workspace(workspace_id)` or an equivalent
  owner join.
- Public reads use views that exclude private wallet, approval, Telegram token,
  prepared-action, and transaction fields.
- `authenticated` has no `insert`, `update`, or `delete` grants on
  execution-adjacent tables in production schema/lockdown SQL.
- `service_role` can write only through reviewed Edge Function or RPC paths.
- Secret tables revoke all public, anon, and authenticated privileges.
- Verifier SQL returns booleans only and no row data.

## Frontend REST Fallback Decision

`src/services/supabaseDeployService.ts` still contains a direct REST deploy
fallback, but it is guarded by:

- `canUseRestDeployFallback()`
- `import.meta.env.DEV`

Decision: keep it only as a local development fallback for isolated dev
databases. It is not a production execution path, and it must not be expanded
to prepared actions, approval writes, Base MCP writes, wallet signing, or
transaction submission.

Before live execution, production should rely on the Edge Function/service-role
path only.

## Prepared Action Storage Decision

The prepared-action SQL packet is still review-only:

- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

Decision: do not apply forward SQL until:

- baseline project state is reviewed
- forward SQL is approved
- rollback SQL is approved
- verifier SQL is approved
- RLS behavior is tested
- owner-summary view is confirmed column-safe
- idempotency/replay behavior is confirmed
- runtime storage adapter is explicitly approved

## Phase 7B Current Gaps

These are not blockers for the current non-executing product, but they are
required before any live execution gate:

- No production prepared-action table is applied yet.
- No live prepared-action write verifier has been run against production.
- No low-risk live execution test account is selected yet.
- No first signable action packet exists yet.
- No runtime Base MCP storage adapter is wired yet.

## Phase 7B Done Criteria

- Ownership/RLS/write-path audit packet exists.
- Automated Phase 7B check exists.
- `authenticated` remains read-only for execution-adjacent production tables.
- `anon` remains public-profile/template only.
- Direct frontend write fallback remains dev-only.
- Prepared-action storage remains review-only.
- Phase 7 entry and Phase 7B checks pass together.

## Next Step

Proceed to Phase 7C only after this audit stays green:

- Base MCP runtime adapter audit
- provider endpoint and timeout review
- request signing or auth model review
- no owner/workspace/agent/wallet scope sent to provider
- no raw provider payload or calldata returned to the browser
