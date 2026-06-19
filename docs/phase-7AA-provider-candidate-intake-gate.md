# Phase 7AA Provider Candidate Intake Gate

Date: 2026-06-19

Status: local provider candidate intake gate complete.

Current decision: no candidate intake accepted.

No provider is nominated, selected, approved, contacted, or called. No endpoint
has been probed. No credential has been requested, pasted, stored, or rotated.
No target Supabase rate-limit SQL has been applied. No smoke packet is filled.
No runtime gate is enabled. Wallet prompts, signing, Telegram execution, swaps,
transfers, contract calls, prepared-action production writes, provider calls,
and transaction submission remain disabled.

## Purpose

Phase 7AA defines the exact intake gate before one real provider candidate can
enter the Phase 7Z sandbox and Phase 7V dossier flow.

This phase does not choose a provider. It prevents accidental provider
selection from incomplete names, chat screenshots, credentials, endpoint probes,
or broad marketing claims.

## Intake Source Rules

Only these sources are allowed for the first candidate intake:

- Owner-provided provider or project name.
- Public website or public documentation URL.
- Redacted operator notes from the provider owner.
- Endpoint origin only, without secrets, credentials, signed URLs, or query
  parameters.
- Named endpoint owner, operational contact, and rollback contact.
- Credential type without credential value.
- Written statement that the provider can support exact `kyra_status_v1`.
- Written statement that the provider can support `POST /status-check`.
- Written statement that the provider will not receive wallet, Telegram,
  Supabase, user identity, calldata, signature, transaction hash, or token amount
  data.

## Forbidden Intake Material

Reject the intake if it contains:

- Provider API keys, bearer headers, cookies, passwords, session tokens, signed
  URLs, or private headers.
- Telegram bot tokens, Telegram token refs, chat ids, or webhook secrets.
- Supabase service-role keys, anon keys, JWTs, sessions, database passwords, row
  dumps, or project credentials.
- Wallet addresses, private keys, seed phrases, signatures, calldata,
  recipients, token amounts, transaction hashes, or approval payloads.
- Owner ids, workspace ids, agent ids, user ids, emails, or private contact
  details.
- Official MCP OAuth client ids, client secrets, authorization codes, refresh
  tokens, access tokens, or `agent_wallet:*` grants.
- Raw provider request bodies, raw provider response bodies, logs, screenshots,
  or captures that include sensitive values.

## Intake Acceptance Checklist

All rows must pass before the candidate can be copied into the Phase 7Z sandbox.

| Area | Required Evidence | Result |
| --- | --- | --- |
| Owner nomination | Owner names one provider or project | pending |
| Public source | Public website or docs URL is available | pending |
| Endpoint origin | HTTPS origin only, not `mcp.base.org`, no path secrets | pending |
| Accountable owners | Endpoint owner, operational contact, and rollback contact are named | pending |
| Protocol fit | Candidate states exact `kyra_status_v1` support | pending |
| Path fit | Candidate states exact `POST /status-check` support | pending |
| Credential type | Credential type is named without value | pending |
| Credential lifecycle | Rotation owner and revocation path are known | pending |
| Data boundary | Candidate needs no wallet, Telegram, Supabase, user, or transaction data | pending |
| Evidence boundary | Candidate can provide summarized positive and negative evidence later | pending |
| Surface boundary | Candidate does not require browser config, public frontend config, or Telegram initiation | pending |
| Authority boundary | Candidate does not require official MCP OAuth or `agent_wallet:*` scopes | pending |

## Rejection Rules

Reject or pause the intake immediately if any of these are true:

- Candidate is not explicitly owner-nominated.
- Candidate requires official MCP OAuth.
- Candidate requires any `agent_wallet:*` scope.
- Candidate endpoint is not HTTPS or is `mcp.base.org`.
- Candidate asks for credentials before the dossier is approved.
- Candidate asks for wallet data, Telegram data, Supabase data, user identity,
  calldata, signatures, transaction hashes, or token amounts.
- Candidate requires a live probe before the dossier is complete.
- Candidate requires public frontend configuration.
- Candidate requires Telegram initiation.
- Candidate cannot name endpoint, operational, and rollback owners.
- Candidate cannot explain credential rotation and revocation.
- Candidate cannot support exact `kyra_status_v1` and `POST /status-check`.

## Intake Result States

- `rejected`: one or more rejection rules are true.
- `needs_owner_input`: no rejection rule is true, but owner nomination or public
  source is missing.
- `incomplete`: owner nomination exists, no rejection rule is true, but one or
  more checklist rows are missing.
- `ready_for_7z_sandbox`: all intake checklist rows are complete and no
  rejection rules are true.

`ready_for_7z_sandbox` does not approve provider use. It only allows copying the
redacted candidate metadata into the Phase 7Z sandbox review.

## Redacted Intake Template

```text
Phase 7AA Provider Candidate Intake

Provider/project:
Owner nomination:
Public source:
Endpoint origin:
Endpoint owner:
Operational contact:
Rollback contact:
Expected protocol: kyra_status_v1
Expected path: POST /status-check
Credential type:
Credential rotation owner:
Credential revocation path:
Data boundary statement:
Evidence boundary statement:
Surface boundary statement:
Authority boundary statement:

Decision: rejected | needs_owner_input | incomplete | ready_for_7z_sandbox
Notes:
```

## Guardrails

- Do not call the provider.
- Do not request credentials.
- Do not paste secrets.
- Do not store candidate credentials.
- Do not set runtime gates.
- Do not apply SQL.
- Do not run smoke tests.
- Do not use Telegram to test the candidate.
- Do not move directly from intake to dossier approval.

## Done Criteria

- Provider candidate intake gate exists.
- Intake requires explicit owner nomination.
- Intake allows only redacted candidate metadata.
- Intake forbids provider credentials, Telegram secrets, Supabase secrets,
  wallet data, user identifiers, raw provider bodies, official OAuth tokens, and
  transaction material.
- Intake defines acceptance checklist, rejection rules, result states, and
  redacted template.
- `ready_for_7z_sandbox` only permits copying redacted candidate metadata into
  the Phase 7Z sandbox.
- Current decision remains no candidate intake accepted.
- Runtime gate, SQL, provider calls, wallet prompts, signing, Telegram
  execution, swaps, transfers, contract calls, prepared-action production
  writes, and transaction submission remain disabled.
