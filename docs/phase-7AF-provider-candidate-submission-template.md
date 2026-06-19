# Phase 7AF Provider Candidate Submission Template

Date: 2026-06-19

Status: local provider candidate submission template complete.

Current decision: no provider candidate submitted.

No provider is nominated, approved, contacted, or called. No credential is
requested or pasted. No endpoint is probed. No SQL approval is requested. No SQL
is applied. No runtime gate is enabled. No smoke is authorized.

## Purpose

This template defines the only acceptable owner-facing shape for submitting a
real custom `kyra_status_v1` provider candidate into review.

It turns a casual provider lead into redacted, bounded intake material without
requesting secrets, triggering a live probe, or approving provider use.

## Submission Rules

Every submission must be redacted and static:

- Provider or project name.
- Public source or website.
- Endpoint origin only.
- Endpoint owner or accountable team.
- Operational contact.
- Rollback contact.
- Credential type without value.
- Credential rotation policy summary.
- Written support for `kyra_status_v1`.
- Written support for `POST /status-check`.
- Data boundary statement.
- Retention statement.
- Incident path.
- Support window.

Do not include provider credentials, API keys, authorization headers, Telegram
tokens, Supabase secrets, wallet data, user identifiers, raw provider request or
response bodies, transaction material, official MCP OAuth material, or
`agent_wallet:*` grants.

## Required Submission Fields

| Field | Required Content | Current State |
| --- | --- | --- |
| Provider candidate | Public provider or project name | missing |
| Public source | Website, docs, or public repository | missing |
| Endpoint origin | HTTPS origin only, no path/query secrets | missing |
| Endpoint owner | Human or team accountable for endpoint behavior | missing |
| Operational contact | Human or team reachable during review | missing |
| Rollback contact | Human or team reachable during smoke rollback | missing |
| Credential type | Type only, no credential value | missing |
| Protocol support | Exact `kyra_status_v1` statement | missing |
| Path support | Exact `POST /status-check` statement | missing |
| Data boundary | No wallet, Telegram, Supabase, user identity, or transaction data | missing |
| Retention | Provider-side retention summary | missing |
| Incident path | How unsafe behavior gets escalated | missing |

## Hard Rejects

Reject the submission if any of these appear:

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
- Calldata.
- Signatures.
- Transaction hashes.
- Official MCP OAuth client ids or client secrets.
- Any `agent_wallet:*` scope requirement.
- Requirement to probe the endpoint before dossier completion.
- Requirement to initiate from Telegram.
- Requirement to expose credentials in public frontend config.

## Submission Result States

- `no_provider_candidate_submitted`: current state.
- `rejected`: forbidden material, incompatible scope, unsafe data boundary, or
  live-probe requirement is present.
- `ready_for_7AA_intake_review`: all required fields are present and redacted.

`ready_for_7AA_intake_review` only permits copying the redacted fields into the
Phase 7AA intake gate. It does not approve provider use, credentials, endpoint
calls, SQL, runtime gates, smoke, wallet prompts, Telegram execution, or
transactions.

## Redacted Submission Template

```text
Decision: no_provider_candidate_submitted | rejected | ready_for_7AA_intake_review
Provider candidate:
Public source:
Endpoint origin:
Endpoint owner:
Operational contact:
Rollback contact:
Credential type without value:
Credential rotation summary:
Protocol support: kyra_status_v1
Path support: POST /status-check
Data boundary:
Retention:
Incident path:
Support window:
Forbidden material present: no
Notes: redacted summary only
```

## Guardrails

- Do not request credentials.
- Do not paste credentials.
- Do not call the provider.
- Do not probe the endpoint.
- Do not apply SQL.
- Do not run target verifier SQL.
- Do not enable runtime gates.
- Do not authorize smoke.
- Do not run smoke from Telegram.
- Do not expose provider config in public frontend code.

## Done Criteria

- This template defines allowed submission fields, hard rejects, result states,
  and a redacted submission template.
- The current decision remains `no provider candidate submitted`.
- No provider is contacted.
- No credential is requested or stored.
- No SQL is applied.
- No verifier is run on a target project.
- No runtime gate is enabled.
- No smoke, wallet prompt, Telegram execution, public-route execution, or
  transaction submission is enabled.
