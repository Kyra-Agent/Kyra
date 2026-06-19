# Phase 7U Target Supabase Rate-Limit Verifier Readiness

Date: 2026-06-19

Status: local target-verifier readiness packet complete. No SQL has been
applied, no Supabase target project has been changed, no runtime gate has been
enabled, and the custom bridge smoke remains blocked.

## Objective

Define the exact readiness workflow for verifying the read-only Base MCP status
rate-limit SQL in a target Supabase project before any custom bridge smoke.

This phase does not apply SQL. It defines what must be true before an operator
can ask for approval to apply the review packet and run the boolean-only
verifier.

## Required Target Inputs

Before touching a target Supabase project, the operator must record:

- target project reference
- target environment label
- operator identity
- owner approval for the exact target
- planned apply window
- rollback operator
- rollback window
- confirmation that `KYRA_BASE_MCP_PREP_ENABLED=false`
- confirmation that no compatible provider smoke is active

Do not record Supabase service-role keys, access tokens, database passwords,
session tokens, Telegram bot tokens, provider API keys, wallet addresses, or raw
database rows in this packet.

## Review Packet

The only reviewed SQL files for this readiness step are:

- `supabase/base_mcp_status_rate_limit_forward_review.sql`
- `supabase/verify_base_mcp_status_rate_limit_contract.sql`
- `supabase/base_mcp_status_rate_limit_rollback_review.sql`

The forward and rollback files are review drafts. The verifier is read-only and
returns booleans only. None of these files may be applied automatically by app
code, CI, browser UI, Telegram, an LLM tool, or a public route.

## Pre-Apply Checklist

All items must be true before asking for approval to apply the forward SQL:

- owner approved the target Supabase project
- rollback SQL was reviewed against the same target
- verifier SQL was reviewed and ready
- `KYRA_BASE_MCP_PREP_ENABLED=false`
- no provider endpoint is approved for a smoke
- no provider secret is being rotated or tested
- no public dashboard or Telegram route can trigger the rate-limit function
- local `npm run check:phase-7u` passes
- local `npm run check:phase-7` passes
- current branch changes are reviewed

If any item is false, do not apply SQL.

## Safe Verifier Evidence

The only shareable verifier evidence is a boolean-only summary with these
fields:

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

Do not share row data, relation OIDs, table contents, JWTs, database URLs,
service-role keys, migration logs containing secrets, provider responses,
wallet addresses, Telegram token refs, or user identifiers.

## Pass Criteria

The verifier is ready for a future smoke only if every boolean in the safe
summary is `true`.

Any `false`, missing field, extra sensitive output, SQL execution error,
permission error, target mismatch, or uncertainty keeps the smoke blocked.

## Rollback Readiness

Rollback must be ready before forward SQL is applied:

- runtime gate is confirmed off first
- rollback SQL is reviewed for the same target
- rollback operator is identified
- rollback window is defined
- post-rollback verifier behavior is understood
- no provider smoke is active during rollback

Rollback output must follow the same safe evidence rule: booleans or bounded
operator summary only, no row data and no secrets.

## Hard Stops

Stop immediately if:

- the target project is unclear
- owner approval is absent
- a service-role key appears in chat, docs, commits, or screenshots
- `KYRA_BASE_MCP_PREP_ENABLED=true`
- SQL output includes user rows or identifiers
- the verifier returns any non-boolean data
- the forward SQL differs from the reviewed file
- the rollback SQL differs from the reviewed file
- an operator suggests applying SQL from browser, Telegram, public route, or LLM
- any local Phase 7 check fails

## Current Decision

Current decision: blocked.

Reason: the target Supabase project has not been selected for SQL application,
the owner has not approved a target apply window, and the verifier has not been
run in a target project.

## Files

- This packet:
  `docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md`
- Forward SQL:
  `supabase/base_mcp_status_rate_limit_forward_review.sql`
- Verifier SQL:
  `supabase/verify_base_mcp_status_rate_limit_contract.sql`
- Rollback SQL:
  `supabase/base_mcp_status_rate_limit_rollback_review.sql`
- Phase 7T go/no-go:
  `docs/phase-7T-custom-bridge-smoke-go-no-go.md`
- Guard:
  `scripts/check-phase-7u-target-supabase-rate-limit-verifier.mjs`

## Verification

- `npm run check:phase-7u`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Target input requirements are documented.
- Pre-apply checklist requires owner approval and gate-off state.
- Safe verifier evidence is boolean-only.
- Pass criteria require every verifier boolean to be true.
- Rollback readiness is required before forward SQL.
- Hard stops protect service-role keys, Telegram tokens, wallet data, row data,
  runtime gates, and public execution surfaces.
- Automated checker is included in `npm run check:phase-7`.
- No SQL application, schema change, secret write, runtime gate enablement,
  provider call, deploy, push, wallet prompt, signature, transaction, Telegram
  execution, or public-route execution occurred.
