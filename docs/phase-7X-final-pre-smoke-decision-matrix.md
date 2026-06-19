# Phase 7X Final Pre-Smoke Decision Matrix

Date: 2026-06-19

Status: local final pre-smoke decision matrix complete.

Current decision: blocked.

No provider is approved. No target Supabase rate-limit SQL has been applied. No
redacted owner approval packet has been filled. No smoke window is approved.
`KYRA_BASE_MCP_PREP_ENABLED` remains off. Wallet prompts, signing, Telegram
execution, swaps, transfers, contract calls, prepared-action production writes,
provider calls, and transaction submission remain disabled.

## Purpose

Phase 7X is the final local decision index before any real provider or smoke
window can be considered.

It does not approve execution. It prevents fragmented approval by requiring all
Phase 7 evidence to agree before any future operator can move from local audit
work into a controlled provider smoke discussion.

## Required Evidence Index

Every row must be present, current, and internally consistent:

| Phase | Evidence | Required Decision |
| --- | --- | --- |
| 7A | Entry lock and source audit | complete |
| 7B | Ownership, RLS, write-path audit | complete, no sensitive row exposure |
| 7C | Base MCP runtime audit | complete, gate default-off |
| 7D | Prepared-action storage audit | review-only SQL, no production write |
| 7E | Wallet prompt/signing audit | wallet prompt disabled |
| 7F | Telegram execution boundary audit | Telegram execution disabled |
| 7G | Logs, errors, observability audit | sanitized, bounded, no secrets |
| 7H | Release and rollback audit | rollback required before any gate |
| 7I | First live candidate decision | `base_mcp_status_check` only |
| 7J | Provider adapter wiring | custom bridge only, default-off |
| 7K | Owner dashboard caller | owner-dashboard-only trigger |
| 7L | Controlled live smoke preparation | compatible provider still required |
| 7M | Provider contract qualification | exact `kyra_status_v1` contract |
| 7N | Official Base MCP decision | official OAuth path disabled |
| 7O | OAuth threat model | wallet-authority risks blocked |
| 7P | OAuth client architecture | implementation blocked |
| 7Q | Scope and consent qualification | advertised scopes rejected |
| 7R | Provider evidence monitor | public GET monitor only |
| 7S | Provider drift response | manual review only |
| 7T | Custom bridge go/no-go | smoke decision blocked |
| 7U | Target Supabase verifier readiness | SQL review-only, booleans only |
| 7V | Provider candidate dossier | no provider approved |
| 7W | Redacted smoke approval packet | no owner packet filled |

## Current No-Go Reasons

The current decision must remain blocked because:

- No compatible `kyra_status_v1` provider has been approved.
- No endpoint origin has been selected for smoke.
- No endpoint owner, operational contact, or rollback contact is approved.
- No target Supabase project has been approved for rate-limit SQL.
- No target Supabase verifier evidence has been produced from a target project.
- No redacted owner approval packet has been filled.
- No smoke window or approval expiry exists.
- No rollback operator is assigned for a live window.
- Runtime gate remains intentionally off.

These are expected blockers, not failures.

## Go-Forward Preconditions

The decision can move from blocked to "ready for smoke approval review" only
when all of these are true:

- Phase 7 checks pass locally.
- Deno Edge Function tests pass locally.
- Production build passes locally.
- Secret scan passes for the changed decision files.
- Provider dossier is complete and approved for the exact provider.
- Endpoint origin is HTTPS, custom-bridge compatible, and not `mcp.base.org`.
- Provider contract evidence satisfies Phase 7M positive and negative cases.
- Provider requires no official MCP OAuth, no `agent_wallet:*` scopes, no wallet
  data, no Telegram data, no Supabase data, and no user identity data.
- Target Supabase rate-limit SQL has explicit owner approval for one target
  project and one apply window.
- Target verifier returns boolean-only passing evidence after any approved SQL
  application.
- Phase 7T go/no-go rows are all ready.
- Phase 7W redacted owner approval packet is filled with exact scope, smoke
  window, expiry, endpoint origin, and rollback operator.
- `KYRA_BASE_MCP_PREP_ENABLED=false` is confirmed before the smoke window.

## Non-Shareable Evidence

Do not include or request any of these in decision evidence:

- Telegram bot tokens or token refs.
- Supabase service-role keys, anon keys, JWTs, database passwords, or sessions.
- Provider API keys, authorization headers, cookies, or signed URLs.
- Wallet addresses, private keys, seed phrases, signatures, calldata,
  recipients, token amounts, or transaction hashes.
- Owner ids, workspace ids, agent ids, user ids, emails, or raw row data.
- Raw provider request or response bodies.
- Browser local storage, session storage, cookies, or auth headers.

## Final Decision Rules

- If any required evidence is missing, the result is blocked.
- If any local check fails, the result is blocked.
- If any secret or user identifier appears in evidence, the result is blocked.
- If provider scope expands beyond `base_mcp_status_check`, the result is
  blocked.
- If Telegram, public routes, wallet prompts, signing, or prepared-action writes
  become part of the smoke, the result is blocked.
- If rollback is unavailable, the result is blocked.
- If runtime gate is already on before the approved window, the result is
  blocked.

## Operator Sequence

When the project eventually has a real candidate, use this sequence:

1. Review Phase 7V provider candidate dossier.
2. Review Phase 7M contract evidence.
3. Review Phase 7U target Supabase verifier readiness.
4. Review Phase 7T go/no-go rows.
5. Fill Phase 7W redacted owner approval packet.
6. Re-run Phase 7X decision matrix.
7. Ask for explicit owner approval before any push, deploy, SQL application, or
   smoke.

Do not skip directly from provider selection to runtime gate enablement.

## Done Criteria

- Final pre-smoke matrix exists.
- Matrix references Phase 7A through Phase 7W.
- Matrix preserves the current blocked decision.
- Matrix lists concrete no-go reasons.
- Matrix defines exact go-forward preconditions.
- Matrix forbids secrets, user identifiers, wallet data, Telegram data,
  Supabase secrets, provider credentials, raw provider bodies, and transaction
  material.
- Matrix keeps SQL application, provider calls, runtime gate enablement, wallet
  prompts, signing, Telegram execution, swaps, transfers, contract calls,
  prepared-action production writes, and transaction submission disabled.
