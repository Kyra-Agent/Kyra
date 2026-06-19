# Phase 7Z Provider Selection Sandbox

Date: 2026-06-19

Status: local provider selection sandbox complete.

Current decision: no provider selected.

No provider is approved. No provider has been contacted. No endpoint has been
called. No credential has been requested or pasted. No target Supabase
rate-limit SQL has been applied. No redacted owner approval packet has been
filled. No smoke window is approved. The Base MCP runtime gate remains off.
Wallet prompts, signing, Telegram execution, swaps, transfers, contract calls,
prepared-action production writes, provider calls, and transaction submission
remain disabled.

## Purpose

Phase 7Z creates an offline sandbox for evaluating provider candidates after
the Phase 7Y pre-provider audit.

This packet does not select or approve a provider. It only defines the minimum
information needed to decide whether one candidate may enter a Phase 7V dossier
draft later.

## Allowed Sandbox Inputs

Only these redacted inputs are allowed:

- Provider or project name.
- Public website or public documentation URL.
- Endpoint origin only, without path secrets, query secrets, credentials, or
  signed URLs.
- Named endpoint owner or accountable team.
- Named operational contact.
- Named rollback contact.
- Expected protocol: `kyra_status_v1`.
- Expected path: `POST /status-check`.
- Credential type without credential value.
- Credential rotation owner and revocation path.
- Data retention statement.
- Incident response path.
- Availability or support window.

## Forbidden Sandbox Inputs

Do not collect or paste:

- Provider API keys, authorization headers, cookies, session tokens, signed
  URLs, or credentials.
- Telegram bot tokens or token refs.
- Supabase service-role keys, anon keys, JWTs, sessions, database passwords, or
  row data.
- Wallet addresses, private keys, seed phrases, signatures, calldata,
  recipients, token amounts, transaction hashes, or approval payloads.
- Owner ids, workspace ids, agent ids, user ids, emails, or raw user data.
- Raw provider request bodies, raw provider response bodies, logs, or captures.
- Official MCP OAuth client ids, secrets, authorization codes, refresh tokens,
  access tokens, or `agent_wallet:*` grants.

## Candidate Scorecard

Each row must be answered from public or redacted operator information only.

| Area | Pass Criteria | Result |
| --- | --- | --- |
| Identity | Provider name and public source are clear | pending |
| Endpoint ownership | Endpoint owner and operational contact are named | pending |
| Protocol | Candidate supports exact `kyra_status_v1` custom bridge | pending |
| Method and path | Candidate accepts only `POST /status-check` for this check | pending |
| Endpoint origin | HTTPS origin only, not `mcp.base.org`, no credentials | pending |
| Credential lifecycle | Type, creation owner, rotation owner, and revocation path are known | pending |
| Data boundary | Candidate needs no wallet, Telegram, Supabase, user, calldata, or transaction data | pending |
| Contract evidence | Candidate can later provide Phase 7M positive and negative evidence | pending |
| Rate-limit readiness | Candidate accepts Kyra-side service-role rate limiting before provider call | pending |
| Rollback | Rollback contact and gate-off recovery path are known | pending |
| Retention | Retention window and deletion path are known | pending |
| Incident response | Incident contact and escalation path are known | pending |
| OAuth boundary | Candidate does not require official MCP OAuth or `agent_wallet:*` scopes | pending |
| Surface boundary | Candidate does not require Telegram initiation or public frontend config | pending |

## Rejection Rules

Reject the candidate immediately if any of these are true:

- Candidate requires official MCP OAuth for the custom bridge.
- Candidate requires any `agent_wallet:*` scope.
- Candidate asks for wallet data, Telegram data, Supabase data, user identity
  data, calldata, signatures, transaction hashes, or token amounts.
- Candidate requires credentials in browser or public frontend config.
- Candidate cannot name an endpoint owner and rollback contact.
- Candidate cannot explain credential rotation and revocation.
- Candidate cannot support exact `kyra_status_v1`.
- Candidate requires raw provider payload sharing in GitHub, Telegram, public
  docs, screenshots, or issue trackers.
- Candidate requires running a live probe before the dossier is complete.

## Sandbox Result States

- `rejected`: one or more rejection rules are true.
- `incomplete`: no rejection rule is true, but one or more scorecard rows are
  missing.
- `candidate_for_dossier`: all scorecard rows are complete and no rejection
  rules are true.

The only allowed successful output is `candidate_for_dossier`. That state does not approve provider use. It only allows drafting the Phase 7V provider dossier.

## Offline Review Template

```text
Phase 7Z Provider Selection Sandbox

Provider/project:
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
Retention:
Incident path:
Support window:

Scorecard result:
- identity:
- endpoint ownership:
- protocol:
- method and path:
- endpoint origin:
- credential lifecycle:
- data boundary:
- contract evidence readiness:
- rate-limit readiness:
- rollback:
- retention:
- incident response:
- OAuth boundary:
- surface boundary:

Decision: rejected | incomplete | candidate_for_dossier
Notes:
```

## Guardrails

- Do not call the provider.
- Do not set runtime gates.
- Do not apply SQL.
- Do not paste credentials.
- Do not request wallet data.
- Do not request Telegram token data.
- Do not request Supabase secrets or row data.
- Do not use public routes or Telegram to test the candidate.
- Do not move directly from sandbox to smoke approval.

## Done Criteria

- Provider selection sandbox exists.
- Sandbox is offline-only.
- Sandbox allows only redacted candidate metadata.
- Sandbox forbids provider credentials, Telegram secrets, Supabase secrets,
  wallet data, user identifiers, raw provider bodies, official OAuth tokens,
  and transaction material.
- Sandbox defines a scorecard, rejection rules, result states, and review
  template.
- Sandbox states that `candidate_for_dossier` only permits a Phase 7V dossier
  draft.
- Current decision remains no provider selected.
- Runtime gate, SQL, provider calls, wallet prompts, signing, Telegram
  execution, swaps, transfers, contract calls, prepared-action production
  writes, and transaction submission remain disabled.
