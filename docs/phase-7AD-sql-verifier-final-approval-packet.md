# Phase 7AD SQL Verifier Final Approval Packet

Date: 2026-06-19

Status: local SQL verifier final approval packet complete.

Current decision: SQL approval not requested.

No target Supabase project is selected or approved. No SQL has been applied. No
target verifier SQL has been run. No provider is approved. No runtime gate is
enabled. No smoke window is approved.

## Purpose

This packet is the final approval wrapper before any later manual discussion
about applying the Base MCP status rate-limit SQL to a selected Supabase target.

It exists to prevent an unsafe shortcut from moving directly from review drafts
to production SQL, provider calls, runtime gate enablement, or smoke testing.

## Approval Prerequisites

Every item below must be present before the result can move beyond `blocked`:

- Phase 7U target-verifier readiness packet remains blocked.
- Phase 7T custom bridge smoke go/no-go remains blocked.
- Phase 7AC candidate dossier fill decision remains blocked or not filled.
- Exact target Supabase project reference.
- Target environment label.
- Target project owner approval.
- SQL operator identity.
- SQL apply window.
- Rollback operator identity.
- Rollback window.
- Gate-off proof before the window.
- Confirmation that provider calls remain disabled.
- Confirmation that Telegram execution remains disabled.
- Confirmation that wallet prompts, signing, approvals, swaps, transfers,
  contract calls, and transaction submission remain disabled.

## Approval Scope

Approval can only cover these reviewed files:

- Forward SQL: `supabase/base_mcp_status_rate_limit_forward_review.sql`.
- Verifier SQL: `supabase/verify_base_mcp_status_rate_limit_contract.sql`.
- Rollback SQL: `supabase/base_mcp_status_rate_limit_rollback_review.sql`.

The approval scope cannot include runtime gate changes, provider credentials,
provider calls, official MCP OAuth, wallet prompts, Telegram execution,
prepared-action production writes, transaction signing, or transaction
submission.

## SQL Files Under Review

The forward and rollback SQL files must remain marked as review drafts until a
separate owner-approved manual apply step exists.

The verifier must remain boolean-only. It must not return row data, user
identifiers, provider payloads, wallet data, Telegram tokens, service-role
material, or raw migration output.

## Forbidden Approval Material

The approval packet must reject and remove any of this material:

- Supabase service-role keys.
- Supabase database passwords.
- Supabase anon JWTs or user JWTs.
- Telegram bot tokens.
- Provider API keys.
- Wallet addresses.
- Private keys or seed phrases.
- Official MCP OAuth client ids.
- Official MCP OAuth client secrets.
- `agent_wallet:*` grants or consent artifacts.
- Raw database rows.
- Raw provider request bodies.
- Raw provider response bodies.
- Raw migration logs containing sensitive values.
- User identifiers.
- Calldata.
- Signatures.
- Transaction hashes.

## Approval Checklist

Record only redacted status and boolean evidence:

| Item | Required Evidence | Current State |
| --- | --- | --- |
| Target project | Redacted project reference and environment label | Not selected |
| Owner approval | Explicit owner approval for the exact target and SQL files | Not requested |
| SQL operator | Redacted operator handle | Not selected |
| Apply window | Date/time window with timezone | Not selected |
| Gate-off proof | `KYRA_BASE_MCP_PREP_ENABLED` remains off before window | Not captured |
| Rollback readiness | Rollback operator and rollback window | Not selected |
| Boolean verifier evidence | Boolean-only verifier output after a future manual apply | Not available |
| Provider status | Provider remains unapproved and uncalled | Blocked |
| Smoke status | Smoke window remains unapproved | Blocked |

## Safe Verifier Output

Only this shape is shareable:

```text
table_exists: true|false
function_exists: true|false
rls_enabled: true|false
anon_table_denied: true|false
authenticated_table_denied: true|false
service_table_granted: true|false
service_delete_denied: true|false
anon_function_denied: true|false
authenticated_function_denied: true|false
service_function_granted: true|false
security_invoker: true|false
exact_column_count: true|false
safety_constraints_present: true|false
```

Any false value is a no-go until reviewed and fixed.

## Approval Result States

- `blocked`: prerequisites are missing, target is absent, evidence is incomplete,
  or local checks fail.
- `rejected`: the packet contains forbidden material, scope creep, SQL drift,
  target mismatch, secret exposure, or unsafe assumptions.
- `ready_to_request_owner_sql_approval`: all redacted prerequisites are ready,
  but the owner has not approved the exact SQL target and window.
- `owner_sql_approved_for_target`: owner approval exists for the exact target,
  operator, apply window, SQL files, verifier, rollback, and gate-off state.

`owner_sql_approved_for_target` does not apply SQL. It only records that the
owner approved the exact target, operator, window, SQL files, verifier,
rollback, and gate-off state for a later manual apply step.

## Redacted Approval Template

```text
Decision: blocked | rejected | ready_to_request_owner_sql_approval | owner_sql_approved_for_target
Target project: redacted project ref
Environment: production | preview | staging | local
SQL operator: redacted handle
Apply window: YYYY-MM-DD HH:mm TZ to YYYY-MM-DD HH:mm TZ
Rollback operator: redacted handle
Rollback window: YYYY-MM-DD HH:mm TZ to YYYY-MM-DD HH:mm TZ
Forward SQL file: supabase/base_mcp_status_rate_limit_forward_review.sql
Verifier SQL file: supabase/verify_base_mcp_status_rate_limit_contract.sql
Rollback SQL file: supabase/base_mcp_status_rate_limit_rollback_review.sql
Gate-off proof: captured | missing
Provider approval: none
Smoke approval: none
Forbidden material present: no
Notes: redacted summary only
```

## Guardrails

- Do not apply SQL.
- Do not run target verifier SQL.
- Do not request or paste service-role keys.
- Do not request or paste Telegram bot tokens.
- Do not request or paste provider API keys.
- Do not include raw database rows.
- Do not include wallet data.
- Do not include user identifiers.
- Do not enable runtime gates.
- Do not contact providers.
- Do not approve smoke.
- Do not move directly from SQL approval to smoke.

## Done Criteria

- This packet documents the exact approval prerequisites, scope, forbidden
  material, result states, and redacted template.
- The Phase 7 master audit references this packet.
- The Phase 7 check suite includes this packet.
- The current decision remains `SQL approval not requested`.
- No SQL is applied.
- No target Supabase project is changed.
- No runtime gate is enabled.
- No provider call is made.
- No Telegram execution, wallet prompt, signing, approval, swap, transfer,
  contract call, or transaction submission is enabled.
