# Phase 7AC Candidate Dossier Fill Gate

Date: 2026-06-19

Status: local candidate dossier fill gate complete.

Current decision: no candidate dossier filled.

No provider is nominated, scored, selected, approved, contacted, or called. No
endpoint has been probed. No credential has been requested, pasted, stored, or
rotated. No target Supabase rate-limit SQL has been applied. No smoke packet is
filled. No runtime gate is enabled. Wallet prompts, signing, Telegram execution,
swaps, transfers, contract calls, prepared-action production writes, provider
calls, and transaction submission remain disabled.

## Purpose

Phase 7AC defines the exact fill gate for turning one redacted, owner-nominated,
scored candidate into a Phase 7V provider dossier.

This phase does not fill a real provider dossier because no provider candidate
has been accepted. It defines the blocker rules and required fields so the first
real dossier cannot skip intake, scoring, sandbox review, privacy boundaries, or
owner approval.

## Prerequisites

All prerequisites must be complete before any real dossier can be filled:

- Phase 7AA intake decision is `ready_for_7z_sandbox`.
- Phase 7AB scoring decision is `scored_ready_for_7z_sandbox`.
- Phase 7Z sandbox decision is `candidate_for_dossier`.
- Phase 7V dossier template remains the controlling dossier format.
- Candidate has no hard-fail rule from 7AA, 7AB, 7Z, or 7V.
- Owner confirms the candidate should move from sandbox review to dossier fill.

If any prerequisite is missing, the dossier fill decision remains `blocked`.

## Dossier Fill Inputs

Only redacted dossier inputs are allowed:

- Provider legal or project name.
- Public source URL.
- Endpoint origin only, without secrets, credentials, signed URLs, or query
  parameters.
- Endpoint owner, operational contact, and rollback contact names or roles.
- Expected protocol: `kyra_status_v1`.
- Expected path: `POST /status-check`.
- Credential type without value.
- Credential storage boundary.
- Credential creation owner, rotation owner, and revocation path.
- Supported timeout window.
- Data retention and deletion statement.
- Incident contact path and escalation path.
- Support window.
- Summarized positive contract evidence readiness.
- Summarized negative contract evidence readiness.
- Redacted owner summary.

## Forbidden Dossier Material

Reject the dossier fill if it includes:

- Provider API keys, bearer headers, Basic auth strings, cookies, passwords,
  session tokens, signed URLs, or private headers.
- Telegram bot tokens, Telegram token refs, chat ids, webhook secrets, or raw
  Telegram updates.
- Supabase service-role keys, anon keys, JWTs, sessions, database passwords, row
  dumps, or project credentials.
- Wallet addresses, private keys, seed phrases, signatures, calldata,
  recipients, token amounts, transaction hashes, or approval payloads.
- Owner ids, workspace ids, agent ids, user ids, emails, or private contact
  details.
- Official MCP OAuth client ids, client secrets, authorization codes, refresh
  tokens, access tokens, or `agent_wallet:*` grants.
- Raw provider request bodies, raw provider response bodies, logs, captures, or
  screenshots that include sensitive values.

## Fill Checklist

Every row must be complete before a dossier can move to owner review.

| Area | Required Evidence | Result |
| --- | --- | --- |
| Intake gate | 7AA result is `ready_for_7z_sandbox` | pending |
| Scoring gate | 7AB result is `scored_ready_for_7z_sandbox` | pending |
| Sandbox gate | 7Z result is `candidate_for_dossier` | pending |
| Candidate summary | Provider name, public source, origin, owners, contacts, protocol, path, credential type | pending |
| Credential lifecycle | Creation, storage boundary, rotation, revocation, leak handling, and authority scope | pending |
| Data boundary | No wallet, Telegram, Supabase, user identity, calldata, signature, transaction, or token amount data | pending |
| Positive contract evidence | Candidate can later demonstrate exact `kyra_status_v1` success shape | pending |
| Negative contract evidence | Candidate can later summarize rejection of malformed, wrong-id, wrong-protocol, oversized, timeout, and non-2xx cases | pending |
| Retention and deletion | Retention window and deletion path are known | pending |
| Incident and support | Incident contact, escalation path, and support window are known | pending |
| Redacted owner summary | Owner-facing summary excludes secrets, raw bodies, user identifiers, wallet data, Telegram data, and Supabase data | pending |

## Dossier Result States

- `blocked`: one or more prerequisites are missing.
- `rejected`: a hard-fail rule is true or forbidden material is present.
- `incomplete`: prerequisites pass, no hard-fail rule is true, but one or more
  fill checklist rows are missing.
- `ready_for_owner_dossier_review`: all fill checklist rows are complete, no
  hard-fail rule is true, and the dossier remains redacted.

`ready_for_owner_dossier_review` does not approve provider use. It only allows
the owner to review the completed redacted dossier. Smoke approval, SQL
approval, runtime gates, provider credentials, and endpoint calls remain
separate later decisions.

## Redacted Dossier Fill Template

```text
Phase 7AC Candidate Dossier Fill

Prerequisites:
- 7AA intake decision:
- 7AB scoring decision:
- 7Z sandbox decision:
- owner confirms dossier fill:

Candidate summary:
- provider/project:
- public source:
- endpoint origin:
- endpoint owner:
- operational contact:
- rollback contact:
- expected protocol: kyra_status_v1
- expected path: POST /status-check
- credential type:

Credential lifecycle:
- creation owner:
- storage boundary:
- rotation owner:
- revocation path:
- leak detection:
- authority scope:

Boundary review:
- data boundary:
- surface boundary:
- authority boundary:
- retention and deletion:
- incident and support:

Evidence readiness:
- positive contract evidence:
- negative contract evidence:
- rate-limit verifier readiness:
- smoke go/no-go readiness:

Decision: blocked | rejected | incomplete | ready_for_owner_dossier_review
Notes:
```

## Guardrails

- Do not call the provider.
- Do not request credentials.
- Do not paste secrets.
- Do not store candidate credentials.
- Do not include raw provider request or response bodies.
- Do not include user identifiers.
- Do not set runtime gates.
- Do not apply SQL.
- Do not run smoke tests.
- Do not move directly from dossier fill to smoke approval.

## Done Criteria

- Candidate dossier fill gate exists.
- Dossier fill requires 7AA, 7AB, 7Z, 7V, no hard-fail rules, and owner
  confirmation.
- Dossier fill allows only redacted candidate metadata and summarized evidence.
- Dossier fill forbids provider credentials, Telegram secrets, Supabase secrets,
  wallet data, user identifiers, raw provider bodies, official OAuth tokens, and
  transaction material.
- Fill checklist and result states are explicit.
- `ready_for_owner_dossier_review` only permits owner review of a redacted
  dossier.
- Current decision remains no candidate dossier filled.
- Runtime gate, SQL, provider calls, wallet prompts, signing, Telegram
  execution, swaps, transfers, contract calls, prepared-action production
  writes, and transaction submission remain disabled.
