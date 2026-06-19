# Phase 7AB Provider Candidate Scoring Worksheet

Date: 2026-06-19

Status: local provider candidate scoring worksheet complete.

Current decision: no candidate scored.

No provider is nominated, selected, approved, contacted, or called. No endpoint
has been probed. No credential has been requested, pasted, stored, or rotated.
No target Supabase rate-limit SQL has been applied. No smoke packet is filled.
No runtime gate is enabled. Wallet prompts, signing, Telegram execution, swaps,
transfers, contract calls, prepared-action production writes, provider calls,
and transaction submission remain disabled.

## Purpose

Phase 7AB defines the scoring worksheet for one owner-nominated provider
candidate after Phase 7AA intake and before any Phase 7Z sandbox decision is
treated as ready for dossier work.

This worksheet is offline-only. It scores redacted candidate metadata, not live
provider behavior. It cannot approve a provider, request credentials, call an
endpoint, apply SQL, enable a runtime gate, or approve a smoke.

## Scoring Inputs

Only these redacted inputs may be scored:

- Provider/project name from owner nomination.
- Public source URL.
- Endpoint origin only.
- Endpoint owner, operational contact, and rollback contact names or roles.
- Expected protocol: `kyra_status_v1`.
- Expected path: `POST /status-check`.
- Credential type without value.
- Credential rotation owner and revocation path.
- Data boundary statement.
- Evidence boundary statement.
- Surface boundary statement.
- Authority boundary statement.
- Retention, incident, and support statements.

## Hard-Fail Rules

Any hard fail forces `rejected`, regardless of numeric score:

- Candidate is not owner-nominated.
- Candidate requires official MCP OAuth.
- Candidate requires any `agent_wallet:*` scope.
- Candidate endpoint is not HTTPS or is `mcp.base.org`.
- Candidate asks for provider credentials before dossier approval.
- Candidate asks for wallet data, Telegram data, Supabase data, user identity,
  calldata, signatures, transaction hashes, token amounts, or approval payloads.
- Candidate requires credentials in browser or public frontend config.
- Candidate requires Telegram initiation.
- Candidate requires a live probe before the dossier is complete.
- Candidate cannot support exact `kyra_status_v1`.
- Candidate cannot support exact `POST /status-check`.
- Candidate cannot explain credential rotation and revocation.
- Candidate cannot provide summarized positive and negative evidence later.

## Weighted Scorecard

Use only `0`, half score, or full score for each row. Do not invent missing
evidence.

| Area | Weight | Full Score Criteria | Score |
| --- | ---: | --- | ---: |
| Owner nomination and public source | 10 | Owner nomination exists and public source is clear | 0 |
| Endpoint accountability | 10 | Endpoint owner, operational contact, and rollback contact are known | 0 |
| Protocol and path fit | 15 | Exact `kyra_status_v1` and `POST /status-check` are supported | 0 |
| Endpoint safety | 10 | HTTPS origin only, not `mcp.base.org`, no path or query secrets | 0 |
| Credential lifecycle | 15 | Credential type, storage boundary, rotation owner, and revocation path are known | 0 |
| Data boundary | 20 | No wallet, Telegram, Supabase, user identity, calldata, signature, transaction, or token amount data is needed | 0 |
| Evidence readiness | 10 | Positive and negative contract evidence can be summarized later without raw bodies | 0 |
| Rate-limit and rollback readiness | 5 | Kyra-side rate limit and gate-off rollback are accepted | 0 |
| Retention, incident, and support path | 5 | Retention, deletion, incident, escalation, and support window are known | 0 |
| Total | 100 | Sum of all rows after hard-fail review | 0 |

## Minimum Scoring Floors

All floors must pass before the result can be `scored_ready_for_7z_sandbox`:

- Total score is at least 90.
- Data boundary score is 20.
- Credential lifecycle score is at least 10.
- Protocol and path fit score is 15.
- Endpoint safety score is 10.
- Evidence readiness score is at least 5.
- No hard-fail rule is true.

## Result States

- `rejected`: one or more hard-fail rules are true.
- `needs_owner_input`: owner nomination, public source, or accountable owner
  data is missing.
- `incomplete`: no hard fail is true, but required scoring evidence is missing.
- `score_below_floor`: no hard fail is true, but one or more scoring floors fail.
- `scored_ready_for_7z_sandbox`: all scoring floors pass and no hard fail is
  true.

`scored_ready_for_7z_sandbox` does not approve provider use. It only allows the
redacted candidate metadata and score summary to be copied into the Phase 7Z
sandbox review.

## Redacted Scoring Template

```text
Phase 7AB Provider Candidate Scoring

Provider/project:
Public source:
Endpoint origin:

Hard-fail review:
- owner-nominated:
- official MCP OAuth required:
- agent_wallet scope required:
- HTTPS and not mcp.base.org:
- credential requested before dossier:
- wallet/Telegram/Supabase/user/transaction data requested:
- browser or public frontend credential required:
- Telegram initiation required:
- live probe required before dossier:
- kyra_status_v1 support:
- POST /status-check support:
- credential rotation and revocation known:
- positive and negative evidence can be summarized:

Weighted score:
- owner nomination and public source: /10
- endpoint accountability: /10
- protocol and path fit: /15
- endpoint safety: /10
- credential lifecycle: /15
- data boundary: /20
- evidence readiness: /10
- rate-limit and rollback readiness: /5
- retention, incident, and support path: /5
- total: /100

Floor review:
- total >= 90:
- data boundary = 20:
- credential lifecycle >= 10:
- protocol and path fit = 15:
- endpoint safety = 10:
- evidence readiness >= 5:

Decision: rejected | needs_owner_input | incomplete | score_below_floor | scored_ready_for_7z_sandbox
Notes:
```

## Guardrails

- Do not call the provider.
- Do not request credentials.
- Do not paste secrets.
- Do not store candidate credentials.
- Do not score raw provider request or response bodies.
- Do not set runtime gates.
- Do not apply SQL.
- Do not run smoke tests.
- Do not use Telegram to test the candidate.
- Do not move directly from scoring to dossier approval.

## Done Criteria

- Provider candidate scoring worksheet exists.
- Scoring is offline-only and redacted.
- Hard-fail rules override numeric score.
- Weighted scorecard totals 100 points.
- Minimum scoring floors are explicit.
- Result states are explicit.
- `scored_ready_for_7z_sandbox` only permits copying redacted candidate metadata
  and score summary into the Phase 7Z sandbox review.
- Current decision remains no candidate scored.
- Runtime gate, SQL, provider calls, wallet prompts, signing, Telegram
  execution, swaps, transfers, contract calls, prepared-action production
  writes, and transaction submission remain disabled.
