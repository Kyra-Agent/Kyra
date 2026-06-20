# Phase 7AN Production UI And Base MCP Evidence Refresh

Date: 2026-06-20

Status: production audit complete. Current official Base MCP decision: blocked.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7R-provider-evidence-monitor.md`
- `docs/phase-7AL-official-base-mcp-unblock-readiness.md`
- `docs/phase-7AM-official-base-mcp-operator-status.md`

## Objective

Verify the current production deployment after the Phase 7 checkpoint push and
refresh the official Base MCP evidence without opening any wallet, OAuth, MCP
session, tool, signing, or transaction path.

This phase is an audit checkpoint only. It does not implement Base Account
connection, official MCP OAuth, token storage, MCP tool discovery, MCP tool
invocation, wallet prompts, signing, transaction submission, SQL deployment, or
Netlify deployment.

## Production UI Audit

Production URL:

```text
https://kyraagent.xyz
```

Browser audit routes:

| Route | Desktop result | Mobile result | Notes |
| --- | --- | --- | --- |
| `/` | pass | pass | Home page renders product shell and safety copy. |
| `/dashboard` | pass | pass | Dashboard renders account session, Base MCP prep, and official Base MCP boundary copy. |
| `/agents/operator-demo` | pass | pass | Public agent page renders summary, Telegram connection, and safety policy. |

Viewport checks:

| Viewport | Width | Height | Result |
| --- | ---: | ---: | --- |
| Desktop | 1280 | 720 | no horizontal overflow; console errors: none |
| Mobile | 390 | 844 | no horizontal overflow; console errors: none |

Observed production signals:

- `HTTP 200 OK` from `https://kyraagent.xyz`.
- Production security headers were present, including CSP,
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and
  `Permissions-Policy`.
- The deployed dashboard bundle includes:
  `Official Base MCP wallet authority`.
- The deployed dashboard still presents Base MCP as blocked/read-only and does
  not claim live wallet authority.

## Official Base MCP Evidence Refresh

Command run:

```text
npm run observe:base-mcp-provider
```

Observation timestamp:

```text
2026-06-20T10:04:36.669Z
```

Current output:

- `decision`: `blocked`
- `baselineMatch`: `true`
- `changes`: `[]`

Current blockers:

- `protected_resource_metadata_unavailable`
- `wallet_authority_scopes_advertised`
- `scope_to_tool_mapping_unverified`
- `escalation_semantics_unverified`
- `mcp_challenge_resource_metadata_missing`
- `mcp_challenge_scope_missing`

Observed public metadata:

- issuer: `https://mcp.base.org`
- authorization endpoint known: yes
- token endpoint known: yes
- registration endpoint known: yes
- PKCE method advertised: `S256`
- advertised scopes: `agent_wallet:escalate`, `agent_wallet:transact`
- protected resource metadata root: unavailable
- protected resource metadata `/mcp`: unavailable
- unauthenticated `/mcp` challenge: bearer realm `mcp`, no
  `resource_metadata`, no scope guidance

## Decision

Keep Phase 7C blocked.

Known OAuth endpoints are not enough to begin wallet authority. The current
provider evidence still lacks stable protected resource metadata, exact
resource/audience, a verified least-privilege non-escalating scope, exact
scope-to-tool mapping, approval-link behavior, token lifecycle behavior,
revocation behavior, and owner consent copy.

## Safety Boundary

Allowed work after this checkpoint:

- monitor the same fixed public official Base MCP sources
- keep production UI and documentation aligned with the blocked state
- keep Telegram live read-only
- keep dashboard Base MCP copy honest and fail-closed
- prepare go/no-go criteria for a future provider-contract change

Forbidden until a go decision:

- official Base MCP OAuth start or callback
- dynamic client registration
- access token or refresh token storage
- authenticated official MCP session initialization
- official MCP tool discovery or invocation
- provider approval link creation
- Base Account prompt
- wallet signing
- transaction submission

## Verification

- `npm run observe:base-mcp-provider`
- `npm run status:base-mcp`
- `npm run check:phase-7an`
- `npm run check:phase-7`

## Done Criteria

- Production UI audit is recorded.
- Official Base MCP evidence is refreshed.
- Refreshed evidence matches the reviewed baseline.
- Current decision remains blocked.
- No OAuth, token, session, MCP tool, wallet, signing, transaction, SQL deploy,
  Netlify deploy, or push occurred during this checkpoint.
