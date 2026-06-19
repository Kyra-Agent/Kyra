# Phase 7W Redacted Smoke Approval Packet

Date: 2026-06-19

Status: local redacted smoke approval packet template complete.

Current decision: blocked.

No owner approval has been captured for a production smoke. No SQL has been
applied. No provider has been called. `KYRA_BASE_MCP_PREP_ENABLED` remains
off. Wallet prompts, signing, Telegram execution, swaps, transfers, contract
calls, and transaction submission remain disabled.

## Purpose

Phase 7W turns a reviewed provider candidate dossier into a final owner approval
packet for one narrow read-only smoke window.

This packet is not an execution gate. It is an approval artifact that must be
complete before any future operator can discuss enabling the runtime gate for a
short controlled smoke.

## Source Inputs

The packet must be built only from already reviewed sources:

- Phase 7V provider candidate dossier.
- Phase 7M provider contract evidence.
- Phase 7T custom bridge smoke go/no-go rows.
- Phase 7U target Supabase verifier readiness.
- Local `npm run check:phase-7` result.
- Local `deno test --quiet supabase/functions` result.
- Local `npm run build` result.

If any source is missing, stale, or contradicted by current code, the packet is
invalid.

## Required Owner-Facing Fields

The approval packet must show all of these fields without secrets:

| Field | Required Content |
| --- | --- |
| Provider candidate | Project or provider name from the approved dossier |
| Endpoint origin | Origin only, no path secrets, no query secrets, no credentials |
| Endpoint owner | Named owner or team accountable for endpoint behavior |
| Operational contact | Human or team reachable during the smoke window |
| Rollback operator | Human or team authorized to turn the gate off and confirm recovery |
| Smoke window | Exact start and end time with timezone |
| Runtime gate state | Confirmed off before the window |
| Action kind | Exactly `base_mcp_status_check` |
| Chain | Exactly `base` |
| Protocol | Exactly `kyra_status_v1` |
| Surface | Owner dashboard only |
| Approval expiry | Exact time after which this approval is void |

## Redacted Evidence Bundle

The owner packet may include only safe evidence:

- Provider dossier decision: approved for approval review or blocked.
- Contract positive case summary with request id binding confirmed.
- Contract negative case summary for wrong request id, wrong protocol, wrong
  action, wrong chain, wrong mode, malformed JSON, non-JSON, oversized response,
  timeout, abort, and non-2xx.
- Phase 7U boolean-only verifier summary.
- Phase 7T go/no-go row summary.
- Runtime gate-off confirmation.
- Rollback command owner and rollback verification method.
- Sanitized local check summary.

The bundle must not include raw provider bodies, request payload captures,
response captures, logs, headers, authorization strings, cookies, service-role
keys, Telegram token refs, wallet addresses, user ids, workspace ids, agent ids,
amounts, recipients, calldata, signatures, transaction hashes, private keys, or
seed phrases.

## Approval Statement

The owner approval must be explicit and must include this exact scope:

> I approve one read-only `base_mcp_status_check` smoke for the named provider
> candidate, exact endpoint origin, exact smoke window, exact rollback operator,
> and owner-dashboard-only surface. I do not approve wallet prompts, signatures,
> swaps, transfers, contract calls, prepared-action production writes, Telegram
> execution, official MCP OAuth, or transaction submission.

Any approval that omits the provider, endpoint origin, window, rollback
operator, or explicit exclusions is invalid.

## Pre-Smoke Checklist

Every item must be true before a future smoke can be discussed:

- Provider dossier is approved for this exact provider.
- Endpoint origin matches the dossier.
- Provider contract evidence matches Phase 7M.
- Phase 7U target verifier booleans are all true for the intended project.
- Phase 7T go/no-go rows are all ready.
- `KYRA_BASE_MCP_PREP_ENABLED=false` is confirmed immediately before the window.
- Rollback operator is present during the window.
- Owner dashboard session is fresh.
- Test agent and workspace are known low-risk demo resources.
- No Telegram path can trigger the smoke.
- No public route can trigger the smoke.
- No wallet prompt can open during the smoke.
- No prepared-action production write is enabled.

## Hard Stops

Treat any of these as a no-go:

- Approval includes credentials or secret material.
- Approval is open-ended or lacks expiry.
- Endpoint origin changed after dossier approval.
- Runtime gate is already on before the smoke window.
- Rollback operator is unavailable.
- Phase 7U verifier evidence is missing or false.
- Phase 7T row summary is incomplete.
- Provider requires official MCP OAuth or `agent_wallet:*` scopes.
- Provider requires wallet data, Telegram data, Supabase data, or user identity
  data.
- Any local check fails.
- Any unredacted user, wallet, Telegram, Supabase, provider credential, or
  transaction material appears in the packet.

## Operator Notes

- Do not turn on any gate from this document.
- Do not apply SQL from this document.
- Do not contact a provider from this document.
- Do not paste credentials into this document.
- Do not run smoke tests from Telegram.
- Do not run smoke tests from public profiles.
- Do not expand the action kind beyond `base_mcp_status_check`.

## Redacted Packet Template

```text
Phase 7W Smoke Approval Packet

Provider candidate:
Endpoint origin:
Endpoint owner:
Operational contact:
Rollback operator:
Smoke window:
Approval expiry:

Scope:
- action: base_mcp_status_check
- chain: base
- protocol: kyra_status_v1
- surface: owner dashboard only

Safe evidence:
- Phase 7V dossier:
- Phase 7M contract:
- Phase 7U verifier booleans:
- Phase 7T go/no-go rows:
- Runtime gate before window: KYRA_BASE_MCP_PREP_ENABLED=false
- Rollback verification:
- Local checks:

Explicit exclusions:
- no wallet prompt
- no signing
- no swap
- no transfer
- no contract call
- no prepared-action production write
- no Telegram execution
- no official MCP OAuth
- no transaction submission

Owner approval:
```

## Done Criteria

- Redacted approval packet template exists.
- Packet requires exact provider, endpoint origin, smoke window, rollback
  operator, expiry, action kind, chain, protocol, and surface.
- Packet references Phase 7V, Phase 7M, Phase 7T, and Phase 7U evidence.
- Packet forbids credentials, user identifiers, wallet data, Telegram tokens,
  Supabase secrets, provider secrets, raw provider bodies, calldata, signatures,
  and transaction hashes.
- Packet states that approval does not enable SQL, provider calls, runtime gate,
  wallet prompts, Telegram execution, signing, or transaction submission.
- Current decision remains blocked.
