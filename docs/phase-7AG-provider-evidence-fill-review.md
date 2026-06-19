# Phase 7AG Provider Evidence Fill Review

Date: 2026-06-19

Status: local provider evidence fill review complete.

Current decision: no provider evidence filled.

No provider evidence is accepted. No provider is approved. No provider is
contacted or called. No credentials are requested or pasted. No endpoint is
probed. No SQL approval is requested. No runtime gate is enabled. No smoke is
authorized.

## Purpose

This packet defines how a redacted Phase 7AF provider submission can be filled
with review evidence before it is allowed to move toward dossier review.

It separates evidence collection from provider calls. Evidence can be public
docs, signed statements, or redacted operator summaries, but it cannot include
secrets, raw bodies, user identifiers, or live probe results gathered before
dossier completion.

## Required Upstream State

Every item below must be present before evidence can be filled:

- Phase 7AF result is `ready_for_7AA_intake_review`.
- Phase 7AA intake gate remains redacted.
- Phase 7AB scoring hard-fail rules are understood.
- Phase 7Z sandbox still has no selected provider.
- Runtime gate remains off.
- Telegram and public routes still cannot trigger Base MCP.

## Evidence Categories

| Category | Required Evidence | Current State |
| --- | --- | --- |
| Identity | Provider/project name and public source align | missing |
| Endpoint ownership | Endpoint owner is accountable and reachable | missing |
| Protocol | Exact `kyra_status_v1` support is stated | missing |
| Path | Exact `POST /status-check` support is stated | missing |
| Positive contract | Redacted summary of expected success shape | missing |
| Negative contract | Redacted summary of rejection behavior | missing |
| Data boundary | No wallet, Telegram, Supabase, user identity, or transaction data | missing |
| Credential lifecycle | Type, rotation, storage, and revocation summary without value | missing |
| Retention | Provider-side retention summary | missing |
| Incident path | Escalation path for unsafe behavior | missing |
| Rollback | Rollback contact and expected rollback action | missing |
| Support window | Time window for operator availability | missing |

## Evidence Fill Rules

Allowed evidence:

- Public documentation links.
- Public repository links.
- Redacted provider statement.
- Redacted operator summary.
- Redacted contract-shape summary.
- Redacted incident and rollback summary.

Forbidden evidence:

- Provider API keys.
- Telegram bot tokens.
- Supabase service-role keys.
- Supabase database passwords.
- Wallet addresses.
- Private keys or seed phrases.
- User ids, workspace ids, agent ids, emails, or raw rows.
- Authorization headers.
- Cookies.
- Signed URLs.
- Raw provider request bodies.
- Raw provider response bodies.
- Calldata, signatures, or transaction hashes.
- Official MCP OAuth client ids or client secrets.
- Any `agent_wallet:*` grant or consent artifact.
- Browser storage, local storage, or session material.
- Live probe output gathered before dossier completion.

## Review Result States

- `no_provider_evidence_filled`: current state.
- `rejected`: evidence contains forbidden material, live probe output,
  incompatible scope, incomplete ownership, or unsafe data boundary.
- `incomplete`: evidence is redacted but missing required categories.
- `ready_for_candidate_scoring`: evidence is redacted, complete, and ready to
  be scored through Phase 7AB.

`ready_for_candidate_scoring` does not approve provider use. It only permits
using redacted evidence in the Phase 7AB scoring worksheet and later dossier
review if the score passes.

## Redacted Evidence Template

```text
Decision: no_provider_evidence_filled | rejected | incomplete | ready_for_candidate_scoring
Provider candidate:
Public source:
Endpoint origin:
Endpoint owner:
Protocol evidence:
Path evidence:
Positive contract summary:
Negative contract summary:
Data boundary summary:
Credential lifecycle summary:
Retention summary:
Incident path:
Rollback contact:
Support window:
Forbidden material present: no
Live probe performed: no
Notes: redacted summary only
```

## Guardrails

- Do not request credentials.
- Do not paste credentials.
- Do not call the provider.
- Do not probe the endpoint.
- Do not store raw provider bodies.
- Do not apply SQL.
- Do not run target verifier SQL.
- Do not enable runtime gates.
- Do not authorize smoke.
- Do not run smoke from Telegram or public pages.

## Done Criteria

- This packet defines required evidence categories, allowed evidence, forbidden
  evidence, result states, and a redacted template.
- The current decision remains `no provider evidence filled`.
- No provider call is made.
- No credential is requested or stored.
- No SQL is applied.
- No runtime gate is enabled.
- No smoke, wallet prompt, Telegram execution, public-route execution, or
  transaction submission is enabled.
