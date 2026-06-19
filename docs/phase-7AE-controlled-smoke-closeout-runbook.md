# Phase 7AE Controlled Smoke Closeout Runbook

Date: 2026-06-19

Status: local controlled smoke closeout runbook complete.

Current decision: smoke not authorized.

No provider is approved. No SQL approval has been requested. No SQL has been
applied. No target verifier has been run. No smoke window is approved. No
runtime gate is enabled. No provider has been called.

## Purpose

This runbook defines the only acceptable sequence for a future controlled
read-only `base_mcp_status_check` smoke and its closeout.

It does not authorize a smoke. It prevents an approved packet from being treated
as permission to improvise during the smoke window or skip post-window cleanup.

## Required Upstream Decisions

The smoke cannot be authorized unless every upstream decision is present and
current:

| Source | Required Decision | Current State |
| --- | --- | --- |
| Phase 7V provider dossier | Approved for the exact provider | Missing |
| Phase 7M provider contract | Exact `kyra_status_v1` positive and negative evidence | Local only |
| Phase 7U target verifier readiness | Target selected and owner-approved | Blocked |
| Phase 7AD SQL approval packet | `owner_sql_approved_for_target` | Not requested |
| Phase 7T go/no-go | Every evidence row ready | Blocked |
| Phase 7W smoke approval packet | Owner approved exact window and rollback operator | Blocked |
| Phase 7X decision matrix | Ready for smoke approval review | Blocked |

If any row is missing, stale, or contradicted, the smoke is not authorized.

## Authorization Boundary

Even if every upstream row becomes ready, authorization is limited to:

- one selected owner workspace
- one selected persisted demo agent
- one action kind: `base_mcp_status_check`
- one chain: `base`
- one protocol: `kyra_status_v1`
- one provider endpoint origin
- one short smoke window
- owner dashboard only

Authorization never includes wallet prompts, signing, approvals, swaps,
transfers, contract calls, prepared-action production writes, Telegram
execution, public-route execution, official MCP OAuth, `agent_wallet:*` scopes,
or transaction submission.

## Pre-Window Checklist

All items must be true immediately before the smoke window:

- `KYRA_BASE_MCP_PREP_ENABLED` is confirmed off.
- Target Supabase rate-limit SQL was applied only after exact owner approval.
- Boolean-only target verifier output passed.
- Rollback operator is present and reachable.
- Rollback window is active and shorter than the smoke approval expiry.
- Provider endpoint origin still matches the approved dossier.
- Provider credential, if any, remains backend-only.
- Local `npm run check:phase-7` passed after the latest relevant change.
- Local `deno test --quiet supabase/functions` passed after the latest relevant
  change.
- Local `npm run build` passed after the latest relevant change.
- Changed-file secret scan passed.
- Owner dashboard session is fresh.
- Telegram and public profiles have no caller path.

## Smoke Window Sequence

The operator sequence must stay this narrow:

1. Confirm the approved smoke window is open.
2. Confirm `KYRA_BASE_MCP_PREP_ENABLED` is off before any change.
3. Enable only the reviewed Base MCP status runtime gate.
4. From the owner dashboard, trigger exactly one `base_mcp_status_check`.
5. Capture only the bounded dashboard result, request id, timestamp, provider
   outcome class, and sanitized local pass/fail summary.
6. Disable the runtime gate immediately.
7. Confirm `KYRA_BASE_MCP_PREP_ENABLED` is off after the window.
8. Run post-window checks before declaring closeout complete.

Do not run the smoke from Telegram, public pages, scripts, browser console,
database console, or a different workspace.

## Abort Rules

Abort immediately and turn the gate off if any of these happen:

- Runtime gate is on before the approved window.
- Provider endpoint origin differs from the approved dossier.
- Provider asks for wallet, Telegram, Supabase, user identity, calldata,
  signature, transaction, or official OAuth material.
- Provider response includes extra fields outside the reviewed contract.
- Owner dashboard session is stale.
- Any unexpected wallet prompt opens.
- Any prepared-action production write appears.
- Telegram or public route can trigger the status check.
- Any secret, token, key, user identifier, wallet data, raw provider body, or
  transaction material appears in logs or evidence.
- Rollback operator is unavailable.

## Closeout Checklist

Closeout is incomplete until every item is true:

| Item | Required Evidence |
| --- | --- |
| Runtime gate off | `KYRA_BASE_MCP_PREP_ENABLED` confirmed off after the window |
| Provider call count | Exactly one approved owner-dashboard status check or zero if aborted before call |
| Wallet safety | No wallet prompt, signature, approval, swap, transfer, contract call, or transaction |
| Telegram safety | No Telegram-created draft, provider call, approval, or execution |
| Public route safety | No public route trigger |
| Storage safety | No prepared-action production write outside reviewed scope |
| Evidence safety | Only redacted safe evidence retained |
| Local checks | Phase 7 suite, Deno functions tests, build, whitespace, and secret scan pass |
| Decision update | Result recorded as aborted, failed-safe, or closed |

## Safe Closeout Evidence

Only these fields can be retained or shared:

- smoke result state: aborted | failed-safe | closed
- request id
- timestamp
- selected non-sensitive agent label
- provider outcome class
- bounded dashboard summary
- local check pass/fail summary
- gate-off confirmation
- rollback confirmation

Do not retain or share provider API keys, Telegram tokens, Supabase secrets,
authorization headers, cookies, wallet addresses, private keys, seed phrases,
calldata, signatures, transaction hashes, user ids, workspace ids, agent ids,
raw provider bodies, raw database rows, browser storage, or session material.

## Result States

- `smoke_not_authorized`: current state; required approvals are missing.
- `aborted_before_call`: gate stayed off or was turned off before provider call.
- `failed_safe`: smoke attempted but failed without wallet, Telegram, storage,
  provider-secret, or transaction exposure.
- `closed`: one approved read-only smoke completed, gate is off, local checks
  pass, and redacted evidence is recorded.

Any result other than `smoke_not_authorized` requires an already-approved smoke
window and post-window evidence.

## Redacted Closeout Template

```text
Decision: smoke_not_authorized | aborted_before_call | failed_safe | closed
Provider candidate:
Endpoint origin:
Smoke window:
Rollback operator:
Action: base_mcp_status_check
Chain: base
Surface: owner dashboard only
Gate before window: off
Gate after window: off
Provider call count: 0 | 1
Wallet prompt observed: no
Telegram trigger observed: no
Public trigger observed: no
Prepared-action production write observed: no
Safe evidence retained: yes | no
Local checks after window: pass | fail | not run
Notes: redacted summary only
```

## Guardrails

- Do not authorize smoke from this runbook.
- Do not apply SQL from this runbook.
- Do not run target verifier SQL from this runbook.
- Do not enable runtime gates from this runbook.
- Do not contact providers from this runbook.
- Do not request or paste service-role keys.
- Do not request or paste Telegram bot tokens.
- Do not request or paste provider API keys.
- Do not run smoke from Telegram.
- Do not run smoke from public pages.
- Do not keep the runtime gate on after the window.

## Done Criteria

- This runbook defines required upstream decisions, authorization boundary,
  pre-window checklist, smoke sequence, abort rules, closeout checklist, safe
  evidence, result states, and redacted template.
- The current decision remains `smoke not authorized`.
- No SQL is applied.
- No verifier is run on a target project.
- No runtime gate is enabled.
- No provider is contacted.
- No smoke is run.
- No wallet prompt, signing, approval, swap, transfer, contract call, Telegram
  execution, public-route execution, or transaction submission is enabled.
