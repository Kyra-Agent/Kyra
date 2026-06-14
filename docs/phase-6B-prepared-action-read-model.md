# Phase 6B Prepared Action Read Model

Status: design and type contract only. No schema migration, wallet prompt,
signing, transaction submission, or public prepared-action read is enabled by
this document.

Storage draft: `supabase/prepared_action_storage_schema_draft.sql`

The storage draft is comment-only and marked `DRAFT ONLY - DO NOT APPLY`.

Review SQL packet:

- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

These files are review artifacts only. They must not be applied without a
separate target-project approval.

Runtime storage hook:

- `supabase/functions/base-mcp-prepare/core.ts`
- `BaseMcpPreparedActionStorageInput`

The hook is optional and contract-tested only. Runtime dependencies do not wire
it yet, so there is still no prepared-action database write in production.

## Security Rule

User privacy, user wallet security, and user Telegram bot token security are the
priority.

Prepared actions must be split into two layers:

- private backend storage for owner-scoped workflow state
- bounded owner summary for dashboard display

Public profiles and Telegram must not receive private prepared-action payloads.

## Current Decision

Phase 6B does not use `approval_requests.prepared_tx` as a browser read model.

Current dashboard reads intentionally fetch only:

- approval request identity
- title and command summary
- route summary
- risk
- status
- fee payer
- wallet requirement
- created timestamp

Dashboard reads must not fetch:

- `prepared_tx`
- `tx_hash`
- wallet addresses as prepared-action context
- provider payloads
- raw calldata
- endpoint URLs
- API keys
- Telegram token refs

## Owner Summary Contract

The dashboard-safe owner summary is represented by:

- `src/types/preparedAction.ts`
- `PreparedActionOwnerSummary`

Allowed first action kind:

- `base_mcp_status_check`

Owner summary fields:

- `id`
- `workspaceId`
- `agentId`
- `actionKind`
- `chain`
- `status`
- `risk`
- `routeSummary`
- `valueSummary`
- `approvalRequirement`
- `expiresAt`
- `createdAt`
- `safetyNote`

These fields are still owner-only. They are not public-profile fields.

## Private Storage Draft

Private backend storage may include:

- `requestId`
- `ownerUserId`
- `provider`
- `providerPayloadRef`

Private backend storage must not include browser-readable:

- raw provider payloads
- raw calldata
- private keys
- seed phrases
- Telegram bot tokens
- Telegram token refs
- API keys

If a future provider requires a payload reference, it must be opaque,
owner-scoped, expiring, and only resolvable from backend code after the signed-in
owner passes authorization.

## Public Boundary

Public profiles may only show high-level product status like:

- Base MCP status
- agent capability labels
- template modules

Public profiles must not expose prepared-action records or owner summaries.

## Telegram Boundary

Telegram remains read-only.

Telegram may not:

- create prepared actions
- read private prepared-action state
- approve prepared actions
- sign prepared actions
- submit transactions
- receive provider payload refs

Telegram may only refuse execution or tell the owner to continue from the
dashboard after the dashboard path is reviewed.

## Storage Order

Before any schema migration:

1. Keep `approval_requests.prepared_tx` out of browser reads.
2. Keep public profiles on `public_agent_profiles`.
3. Keep `base-mcp-prepare` default-off.
4. Add local checks for forbidden frontend/public/Telegram references.
5. Keep `supabase/prepared_action_storage_schema_draft.sql` comment-only until
   a forward/rollback packet is explicitly approved.
6. Keep the prepared-action forward/rollback/verifier review packet unapplied
   until a separate Supabase apply approval.

Future storage must satisfy:

- owner-scoped by `workspaceId` and `agentId`
- expiring by `expiresAt`
- idempotent by `requestId`
- fresh by `requestedAt`
- maximum request age: 5 minutes
- maximum future clock skew: 60 seconds
- maximum preview TTL: 10 minutes
- unsupported `actionKind` fails closed
- raw payloads never appear in public or Telegram responses
- wallet signing remains Phase 6C

Prepared-action storage inputs must be built from sanitized preview summaries
only. They may carry owner/workspace/agent/request scope for backend
authorization, but must not carry provider payload refs, endpoint URLs, API
keys, raw calldata, wallet addresses, or Telegram token refs.

Drafted storage boundaries:

- unique `(workspace_id, agent_id, request_id)` idempotency
- owner summary view excludes provider payload refs
- public profiles must not join prepared actions
- Telegram webhook must not read or write prepared actions
- no raw calldata, wallet address, Telegram token ref, or API key columns
- forward review enables RLS and creates an owner-only summary view
- rollback review stops if rows exist and does not use `DROP ... CASCADE`
- verifier checks forbidden column absence and role privileges
