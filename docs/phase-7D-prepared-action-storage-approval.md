# Phase 7D Prepared Action Storage Approval

Date: 2026-06-19

Status: approval packet started. Prepared-action SQL remains review-only and is
not applied to production.

## Objective

Phase 7D reviews the prepared-action storage packet before Kyra can create any
owner-scoped prepared-action records.

This phase does not enable storage, Base MCP provider calls, wallet prompts,
signing, Telegram execution, or transaction submission. The goal is to prove
that the storage packet is narrow enough to approve later without exposing user
wallet data, Telegram token data, raw provider payloads, or transaction payloads.

## Current Decision

Prepared-action storage is not live.

The current SQL packet is acceptable as a review candidate only:

- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

The forward packet must not be run until the owner approves the target project,
baseline state, rollback plan, verifier result expectations, runtime gate plan,
and smoke checklist together.

## Approved Storage Scope

The first storage candidate may store only bounded owner-summary state:

- `id`
- `workspace_id`
- `agent_id`
- `action_kind`
- `chain`
- `status`
- `risk`
- `route_summary`
- `value_summary`
- `approval_requirement`
- `expires_at`
- `created_at`
- `safety_note`

Private backend-only fields may exist only when they are not browser-readable:

- `request_id`
- `provider`
- `provider_payload_ref`
- `updated_at`
- `resolved_at`

## Forbidden Storage Scope

Prepared-action storage must not include:

- raw provider payloads
- raw calldata
- wallet addresses
- private keys
- seed phrases
- Telegram token refs
- Telegram bot tokens
- API keys
- transaction hashes
- arbitrary recipient addresses
- arbitrary token amounts
- arbitrary contract call data

## Forward SQL Approval Rules

The forward SQL must keep these properties:

- marked `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL`
- creates `public.prepared_actions` only after baseline object checks
- creates `public.prepared_action_owner_summaries`
- enables RLS on `public.prepared_actions`
- gives owners select access through `public.owns_workspace(workspace_id)`
- gives `authenticated` only column-level select on summary-safe columns
- does not grant full-table select to `authenticated`
- gives `service_role` only select, insert, and update on prepared actions
- does not grant delete on prepared actions
- uses `unique (workspace_id, agent_id, request_id)` for idempotency
- limits the first action kind to `base_mcp_status_check`
- limits the first chain to `base`
- keeps `provider_payload_ref` nullable and format-constrained

## Rollback Approval Rules

The rollback SQL must keep these properties:

- marked `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL`
- refuses rollback when `public.prepared_actions` contains rows
- revokes table and view privileges before dropping objects
- drops the owner summary view before the table
- does not use `CASCADE`
- does not delete or expose prepared-action row data

## Verifier Approval Rules

The verifier must remain a read-only review query:

- marked `REVIEW VERIFIER - DO NOT APPLY AS A MIGRATION`
- returns booleans only
- verifies the table exists
- verifies the owner summary view exists
- verifies RLS is enabled
- verifies the owner select policy exists
- verifies summary view columns
- verifies forbidden columns are absent
- verifies request idempotency constraint
- verifies allowed action-kind constraint
- verifies anon has no privileges
- verifies `authenticated` column-level privileges
- verifies `service_role` has no delete privilege

## Runtime Storage Rules

The Base MCP storage adapter may stay as a tested draft, but runtime dependency
wiring remains blocked until this packet is explicitly approved and the forward
SQL has been applied and verified.

Runtime storage cannot go live until:

- `supabase/schema.sql` includes the reviewed storage baseline or the target
  project verifier has passed
- `storePreparedActionSummary` is explicitly wired in a separate commit
- Base MCP provider preparation is enabled through a separate reviewed gate
- duplicate request behavior is reviewed against the live table
- public profile and Telegram paths are rechecked for no prepared-action access
- rollback decision is documented for the exact target project

## Phase 7D Current Gaps

These remain blockers before live storage:

- Forward SQL is not applied.
- Verifier has not been run against the intended production project.
- Runtime dependencies do not wire `storePreparedActionSummary`.
- No live duplicate-request smoke has been run.
- No live owner-summary dashboard read has been approved.
- No rollback decision exists for a table with existing rows.

## Phase 7D Done Criteria

- Prepared-action storage approval packet exists.
- Automated Phase 7D check exists.
- Forward SQL remains review-only and narrow.
- Rollback SQL remains review-only and non-cascading.
- Verifier SQL returns boolean review signals only.
- Runtime storage remains unwired.
- Public routes and Telegram routes remain isolated from prepared-action state.
- Phase 7 checks pass with 7D included.

## Next Step

Proceed to Phase 7E only after this audit stays green:

- wallet prompt audit
- signing boundary audit
- first signable action decision
- user rejection behavior
- network mismatch behavior
- no Telegram-created wallet prompt
