# Phase 7G Prepared-Action Policy Enforcement

Date: 2026-06-24

Status: complete as a policy enforcement boundary.

## Purpose

Phase 7G binds the Phase 7F prepared-action allowlist to owner/session/agent
policy and NYX-05 risk review before any prepared action can move toward owner
approval.

Production prepared-action storage remains disabled. This phase does not apply
SQL, wire `storePreparedActionSummary`, open wallet prompts, sign messages,
submit transactions, call official hosted Base MCP tools, or persist
transaction hashes.

Wallet signing and transaction submission remain disabled.

## Enforcement Order

The policy boundary is implemented in `src/types/preparedActionPolicy.ts`.

The order is deterministic:

1. Require signed-in owner session.
2. Require selected deployed agent.
3. Run the Phase 7F prepared-action allowlist.
4. Run NYX-05 risk review.
5. Require owner-scoped prepared-action storage before value-moving actions can
   be stored.
6. Require owner approval before wallet prompt or signing handoff.

Only owner-dashboard intent can enter policy review. Telegram, LLM output,
provider output, plugins, and public pages stay untrusted and cannot create
prepared actions.

## Policy Results

Possible statuses:

- `read_only_ready`: read-only status check is safe to show without wallet
  authority or storage.
- `owner_review_required`: allowlist and risk review passed, storage gate is
  enabled, and the action is ready for owner review.
- `blocked`: at least one required boundary failed.

Block reasons:

- `owner_session_required`
- `agent_binding_required`
- `allowlist_rejected`
- `prepared_action_storage_disabled`
- `risk_review_blocked`
- `owner_approval_required`

## Risk Boundary

NYX-05 risk review is required before any owner approval or wallet prompt.

Owner approval remains required.

Read-only status checks resolve to `read-only`.

Reviewed transaction schemas must pass the allowlist first. Token spend,
calldata, non-Base chain, invalid recipient, invalid value, untrusted source,
or unknown action kind fails before any wallet prompt can open.

## Dashboard Evidence

The private dashboard now shows a Phase 7G policy enforcement panel under the
Base MCP prep section:

- storage: disabled unless the owner-scoped storage gate is enabled
- risk: NYX-05 level
- owner approval: required
- replay: request-id scoped
- blocked reasons: visible and bounded

The panel is informational. It does not create a prepared action, approval,
wallet prompt, signature, transaction submission, or transaction hash.

## Storage Boundary

Prepared-action production storage is still blocked by default:

- SQL is not applied by this phase.
- `public.prepared_actions` remains absent from `supabase/schema.sql`.
- `storePreparedActionSummary` remains unwired in runtime dependencies.
- Existing forward/rollback/verifier SQL remains review-only.

Future storage enablement requires a separate owner-approved SQL/apply window,
verifier evidence, rollback criteria, and exact runtime gate.

## Validation

Required checks:

- `npm run test:prepared-action-policy`
- `npm run check:phase-7g`
- `npm run check:phase-7`

The Phase 7G check keeps the older logs/errors/observability audit active and
adds the prepared-action policy enforcement guard.

## Remaining Locked Paths

Still disabled after Phase 7G:

- prepared-action production writes
- Kyra approval writes
- wallet prompt eligibility success
- Base Account signing
- transaction submission
- transaction hash persistence
- official hosted Base MCP OAuth/tool authority

Proceed to Phase 7H only after this policy boundary stays green.
