# Phase 7AI Final Smoke Authorization Packet

Date: 2026-06-19

Status: local final smoke authorization packet complete.

Current decision: final smoke not authorized.

No provider is approved. No provider evidence is accepted. No target SQL
approval is ready. No SQL is applied. No target verifier is run. No smoke window
is approved. No runtime gate is enabled. No provider is called.

## Purpose

This packet is the final redacted authorization gate before a future
one-call, read-only `base_mcp_status_check` smoke can be considered.

It does not authorize smoke today. It defines the complete evidence bundle that
must exist before the owner can approve a short, reversible, owner-dashboard-only
smoke window.

## Required Upstream Decisions

Every decision must be present and current:

| Source | Required Decision | Current State |
| --- | --- | --- |
| Phase 7AF provider submission | `ready_for_7AA_intake_review` | missing |
| Phase 7AG provider evidence | `ready_for_candidate_scoring` | missing |
| Phase 7AA intake gate | `ready_for_7z_sandbox` | not accepted |
| Phase 7AB scoring worksheet | `scored_ready_for_7z_sandbox` | not scored |
| Phase 7Z sandbox | `candidate_for_dossier` | not selected |
| Phase 7AC dossier fill | `ready_for_owner_dossier_review` | not filled |
| Phase 7V provider dossier | approved for exact provider | blocked |
| Phase 7AH target SQL prep | `ready_to_request_target_sql_approval` | not ready |
| Phase 7AD SQL approval | `owner_sql_approved_for_target` | not requested |
| Phase 7U target verifier | boolean-only verifier passes | blocked |
| Phase 7W smoke approval | owner approval for exact window | blocked |
| Phase 7X decision matrix | ready for smoke approval review | blocked |
| Phase 7AE closeout runbook | closeout operator and abort rules ready | smoke not authorized |

If any row is missing, the final smoke decision is blocked.

## Authorization Scope

The only scope that can ever be authorized by this packet is:

- action kind: `base_mcp_status_check`
- chain: `base`
- protocol: `kyra_status_v1`
- surface: owner dashboard only
- call count: one provider call
- workspace: one selected owner workspace
- agent: one selected persisted demo agent
- window: one short time-boxed window
- gate state: off before and after window

Everything else remains out of scope.

## Explicit Exclusions

The owner approval must explicitly exclude:

- wallet prompts
- signatures
- token approvals
- swaps
- transfers
- contract calls
- prepared-action production writes outside reviewed scope
- Telegram execution
- public-route execution
- official MCP OAuth
- `agent_wallet:*` scopes
- arbitrary calldata
- transaction submission
- long-running runtime gates

## Authorization Evidence Bundle

Only redacted evidence can be included:

| Evidence | Required Shape |
| --- | --- |
| Provider identity | Redacted provider name and public source |
| Endpoint origin | HTTPS origin only, no path/query secrets |
| Provider ownership | Endpoint owner, operational contact, rollback contact |
| Protocol evidence | Exact `kyra_status_v1` and `POST /status-check` support |
| Contract evidence | Positive and negative summary only |
| Data boundary | No wallet, Telegram, Supabase, user identity, or transaction data |
| Credential lifecycle | Type, rotation, revocation without value |
| SQL target | Redacted project ref and apply window |
| Verifier evidence | Boolean-only pass summary |
| Gate proof | Off before window and off-after plan |
| Closeout plan | Abort operator, safe evidence, post-window checks |
| Local checks | Phase 7 suite, Deno tests, build, whitespace, secret scan |

## Hard Stops

Any hard stop keeps the decision blocked:

- Missing upstream decision.
- Secret, token, key, credential, cookie, or signed URL appears.
- Wallet data, user identifier, raw row, raw provider body, calldata,
  signature, or transaction material appears.
- Provider requires official MCP OAuth or `agent_wallet:*` scopes.
- Provider requires Telegram initiation.
- Provider requires wallet, Supabase, user identity, or transaction data.
- Target SQL approval is not exact.
- Target verifier evidence is missing or false.
- Runtime gate is already on.
- Smoke window is open-ended.
- Rollback operator is unavailable.
- Any local check fails.

## Final Result States

- `final_smoke_not_authorized`: current state.
- `rejected`: hard stop, forbidden material, scope creep, failed local check, or
  unsafe upstream mismatch is present.
- `ready_to_request_final_owner_smoke_authorization`: all redacted evidence is
  complete, but owner approval has not been given.
- `owner_authorized_one_read_only_smoke`: owner explicitly approved one exact
  provider, endpoint origin, target project, smoke window, rollback operator,
  owner-dashboard-only trigger, and exclusions.

`owner_authorized_one_read_only_smoke` still does not run the smoke. It only
allows a later manual operator step that follows the Phase 7AE closeout runbook.

## Redacted Authorization Template

```text
Decision: final_smoke_not_authorized | rejected | ready_to_request_final_owner_smoke_authorization | owner_authorized_one_read_only_smoke
Provider candidate:
Endpoint origin:
Endpoint owner:
Operational contact:
Rollback operator:
Target project:
Smoke window:
Approval expiry:
Action: base_mcp_status_check
Chain: base
Protocol: kyra_status_v1
Surface: owner dashboard only
Provider call count: 1
Gate before window: off
Gate after window plan: off immediately
Verifier evidence: boolean-only pass summary
Local checks: pass | fail | not run
Explicit exclusions confirmed: yes | no
Forbidden material present: no
Notes: redacted summary only
```

## Guardrails

- Do not run smoke from this packet.
- Do not enable runtime gates from this packet.
- Do not apply SQL from this packet.
- Do not run target verifier SQL from this packet.
- Do not contact providers from this packet.
- Do not request credentials.
- Do not paste credentials.
- Do not use Telegram for smoke authorization.
- Do not use public pages for smoke authorization.
- Do not approve wallet prompts, signing, swaps, transfers, contract calls, or
  transaction submission.

## Done Criteria

- This packet defines upstream decisions, authorization scope, exclusions,
  evidence bundle, hard stops, result states, and a redacted authorization
  template.
- The current decision remains `final smoke not authorized`.
- No provider is approved or contacted.
- No SQL is applied.
- No target verifier is run.
- No runtime gate is enabled.
- No smoke, wallet prompt, Telegram execution, public-route execution, or
  transaction submission is enabled.
