# Phase 7AH Target SQL Approval Prep

Date: 2026-06-19

Status: local target SQL approval prep complete.

Current decision: target SQL approval not ready.

No target Supabase project is selected. No SQL approval is requested. No SQL is
applied. No target verifier is run. No runtime gate is enabled. No provider is
called. No smoke is authorized.

## Purpose

This packet prepares the exact target-project approval material required before
the review-only Base MCP status rate-limit SQL can ever be considered for a
manual apply.

It does not approve SQL. It forces the target, operator, window, rollback, gate
state, and verifier evidence contract to be explicit before any future owner
approval request.

## Required Upstream State

Every prerequisite must be current:

- Phase 7U target verifier readiness remains blocked until target is selected.
- Phase 7AD SQL approval packet remains `SQL approval not requested`.
- Phase 7AE smoke remains not authorized.
- Phase 7AG provider evidence does not approve provider calls.
- Runtime gate remains off.
- Provider calls remain disabled.
- Telegram execution remains disabled.

## Target Approval Prep Fields

| Field | Required Content | Current State |
| --- | --- | --- |
| Target project | Redacted Supabase project reference | missing |
| Environment | production, preview, staging, or local | missing |
| SQL operator | Redacted operator handle | missing |
| Apply window | Exact start and end time with timezone | missing |
| Rollback operator | Redacted operator handle | missing |
| Rollback window | Exact start and end time with timezone | missing |
| Gate-off proof | `KYRA_BASE_MCP_PREP_ENABLED` confirmed off | missing |
| Forward SQL | `supabase/base_mcp_status_rate_limit_forward_review.sql` | review-only |
| Verifier SQL | `supabase/verify_base_mcp_status_rate_limit_contract.sql` | review-only |
| Rollback SQL | `supabase/base_mcp_status_rate_limit_rollback_review.sql` | review-only |
| Evidence policy | Boolean-only verifier evidence | missing |
| Owner approval | Explicit owner approval for target and window | not requested |

## Boolean Evidence Contract

Only these verifier fields can be shared after a future approved manual apply:

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

Any false value keeps the target approval blocked.

## Hard Rejects

Reject target approval prep if it includes:

- Supabase service-role keys.
- Supabase database passwords.
- Supabase anon keys, JWTs, or user sessions.
- Telegram bot tokens.
- Provider API keys.
- Wallet addresses.
- Private keys or seed phrases.
- User ids, workspace ids, agent ids, emails, or raw rows.
- Raw migration output containing sensitive values.
- Authorization headers.
- Cookies.
- Signed URLs.
- Raw provider request or response bodies.
- Calldata, signatures, or transaction hashes.
- Open-ended apply or rollback windows.
- Runtime gate already enabled before approval.

## Prep Result States

- `target_sql_approval_not_ready`: current state.
- `rejected`: target mismatch, forbidden material, open-ended window, SQL drift,
  missing rollback, or gate-on state is present.
- `ready_to_request_target_sql_approval`: target, operator, apply window,
  rollback, SQL files, verifier contract, and gate-off proof are complete and
  redacted.

`ready_to_request_target_sql_approval` does not approve or apply SQL. It only
permits asking the owner for a separate explicit target SQL approval.

## Redacted Prep Template

```text
Decision: target_sql_approval_not_ready | rejected | ready_to_request_target_sql_approval
Target project:
Environment:
SQL operator:
Apply window:
Rollback operator:
Rollback window:
Forward SQL file: supabase/base_mcp_status_rate_limit_forward_review.sql
Verifier SQL file: supabase/verify_base_mcp_status_rate_limit_contract.sql
Rollback SQL file: supabase/base_mcp_status_rate_limit_rollback_review.sql
Gate-off proof:
Boolean verifier evidence policy: booleans only
Owner approval requested: no
Forbidden material present: no
Notes: redacted summary only
```

## Guardrails

- Do not request service-role keys.
- Do not paste service-role keys.
- Do not apply SQL.
- Do not run target verifier SQL.
- Do not enable runtime gates.
- Do not contact providers.
- Do not authorize smoke.
- Do not use Telegram for SQL approval.
- Do not store target evidence with secrets or raw rows.

## Done Criteria

- This packet defines target approval prep fields, boolean evidence contract,
  hard rejects, result states, and a redacted template.
- The current decision remains `target SQL approval not ready`.
- No SQL is applied.
- No target verifier is run.
- No runtime gate is enabled.
- No provider is contacted.
- No smoke, wallet prompt, Telegram execution, public-route execution, or
  transaction submission is enabled.
