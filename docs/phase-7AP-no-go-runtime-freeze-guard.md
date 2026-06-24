# Phase 7AP NO-GO Runtime Freeze Guard

Date: 2026-06-20

Status: local runtime freeze guard complete. Current decision: NO-GO.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AL-official-base-mcp-unblock-readiness.md`
- `docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md`

## Objective

Lock the current runtime so a NO-GO official Base MCP decision cannot
accidentally become official provider authority through frontend flags,
dashboard actions, Edge Function configuration, custom provider wiring, or
hidden OAuth routes. Independent Base Account execution remains separately
disabled until its own gates pass.

This phase does not implement official MCP OAuth,
dynamic client registration, token exchange, token storage, MCP session
initialization, MCP tool discovery, MCP tool invocation, provider approval
links, wallet prompts, signing, transaction submission, SQL deployment, Netlify
deployment, or push.

Phase 7D may mount the Base Account-only provider after an explicit authenticated
owner click. That connection is session-memory-only and cannot sign or submit a
transaction.

## Runtime Freeze Invariants

| Layer | Required Freeze |
| --- | --- |
| Frontend config | `walletExecution` remains hardcoded `disabled` and is not environment-controlled. |
| Wallet provider boundary | Runtime mounts only for the hardcoded owner-click connection mode while wallet execution remains disabled; Wagmi persistence and reconnect remain off. |
| Wallet connectors | Only the Base Account connector on Base may mount; generic Coinbase fallback is excluded. |
| Dashboard action | Dashboard may only request `base_mcp_status_check` with `mode: read_only`. |
| Dashboard copy | Production and local dashboard must say official Base MCP wallet authority is blocked. |
| Edge Function runtime | `base-mcp-prepare` remains default-off unless the explicit backend gate is exactly `true`. |
| Official endpoint safety | Custom bridge config must reject `https://mcp.base.org` as a provider endpoint. |
| Action allowlist | The only accepted action kind remains `base_mcp_status_check`. |
| Request mode | The only accepted mode remains `read_only`. |
| Adapter contract | The custom bridge may call only `/status-check`, not official OAuth or MCP wallet endpoints. |
| Prepared summary | Result summary must stay read-only with no token spend, gas request, calldata, or opaque payload ref. |
| Official routes | Only reviewed disabled-only skeletons may exist; they must return fixed 403 disabled or 503 not-implemented responses and contain no provider, OAuth, token, MCP, wallet, signing, or transaction logic. |

## What This Allows

- owner-dashboard-only read-only status checks when the custom bridge is
  explicitly enabled
- local audits and check scripts
- provider evidence monitoring
- documentation updates
- production UI honesty around blocked wallet authority

## What This Blocks

- environment-controlled wallet execution
- automatic wallet prompts or reconnect on page load
- Base Account prompt from page load, Telegram, public routes, or background jobs
- functional official Base MCP OAuth start/callback
- dynamic client registration
- access token or refresh token request/storage
- official MCP session initialization
- official MCP tool discovery/invocation
- provider approval-link creation
- wallet signing
- transaction submission

## Current Decision

The official MCP freeze stays active while Phase 7AO is NO-GO. The current
wallet execution freeze stays active until the independent Base Account SDK
connection, signing, rollback, and smoke gates pass.

Primary-lane Base Account work may proceed only if it keeps official MCP
invariants intact and cannot execute until its own approvals are complete.

## Verification

- `npm run check:phase-7ap`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Runtime freeze document exists.
- Automated freeze guard exists.
- Frontend wallet execution remains disabled.
- Base MCP prepare remains default-off and read-only only.
- Official Base MCP route code is limited to reviewed disabled-only skeletons
  with no provider or authority path.
- Official Base MCP wallet endpoint is not accepted as the custom bridge
  endpoint.
- Package Phase 7 checks include this guard.
- No OAuth, token, session, MCP tool, wallet, signing, transaction, SQL deploy,
  Netlify deploy, or push occurred during this phase.
