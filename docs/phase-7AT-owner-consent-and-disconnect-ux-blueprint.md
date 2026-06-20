# Phase 7AT Owner Consent And Disconnect UX Blueprint

Date: 2026-06-20

Status: blueprint complete. Runtime remains NO-GO and disabled.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`
- `docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md`

## Objective

Define the future private-dashboard UX contract for Base Account connection,
official Base MCP consent, disconnect, revoke, emergency disablement, and
failure states before any wallet authority runtime exists.

This phase is a blueprint only. It does not add UI controls, OAuth routes,
token exchange, token storage, MCP sessions, wallet prompts, signing,
transactions, SQL migrations, deploys, or pushes.

## Current Decision

Phase 7D remains NO-GO. The product must not show a live Base Account connect,
official Base MCP authorize, wallet prompt, approval, signing, or transaction
control while official Base MCP provider evidence remains insufficient.

Current UI may only show blocked/read-only status and owner education.

## UX Authority Principle

The owner must be able to answer these questions before any future consent:

- Which Kyra account am I using?
- Which workspace is this for?
- Which deployed agent receives authority?
- Which Base Account or provider account is involved?
- Which official provider, issuer, and resource is being authorized?
- Which exact scope and tool class is requested?
- What asset, chain, value ceiling, and expiry apply?
- Where are tokens stored?
- How do I disconnect or revoke?
- What can Telegram not do?
- Which approval happens in Kyra and which approval happens in Base Account?

If the UI cannot answer those questions, the flow must stay disabled.

## Future Consent Screen Requirements

Future consent UI must show all of these fields before redirecting to official
Base MCP authorization:

| Field | Requirement |
| --- | --- |
| Owner | authenticated Kyra owner identity |
| Workspace | exact workspace name and ID label |
| Agent | deployed agent name, ID, template, and module stack |
| Provider | official provider display name |
| Issuer | exact issuer label |
| Resource | exact official Base MCP resource/audience |
| Base Account | safe display label or opaque provider account reference |
| Scope | exact granted scope set in plain language |
| Capability | read, prepare, transact, or escalate class |
| Tools | exact allowlisted tool names if known |
| Chain | Base only unless separately approved |
| Assets | exact assets or "none" for read-only |
| Value ceiling | exact limit or "no spend authority" |
| Expiry | exact expiry or session lifetime |
| Token boundary | backend-only encrypted credential reference |
| Revocation | dashboard disconnect and emergency disable path |
| Telegram boundary | Telegram cannot approve, sign, submit, or revoke |

The primary action must not be enabled unless all required fields are present,
verified, and current.

## Required Consent Copy

Future copy must say, in equivalent plain language:

```text
You are authorizing this deployed Kyra agent only.
This does not authorize every Kyra agent.
This does not give Telegram permission to approve, sign, or submit.
Kyra approval and Base Account approval are separate decisions.
Tokens are stored backend-only as encrypted references.
You can disconnect this binding from the private dashboard.
```

For any future spend-capable scope, copy must additionally show:

```text
This may prepare an onchain action, but it cannot submit without your
separate Kyra approval and separate Base Account approval.
```

## Forbidden UX Copy

Future UI must not hide wallet authority behind generic labels such as:

- Connect
- Enable
- Continue
- Sync
- Start
- Activate
- Trust Kyra
- One-click approve
- Auto execute
- Trading enabled
- Telegram trading live
- Agent can transact for you

Generic button text may be used only if paired with visible adjacent authority
details. The final button must name the action, for example:
`Authorize this agent for read-only official Base MCP` or
`Disconnect this agent's Base Account binding`.

## Approval Separation

Future UX must present these as separate states:

1. Kyra owner session authenticated.
2. Owner selects one deployed agent.
3. Owner reviews Kyra consent screen.
4. Owner starts official provider authorization.
5. Provider/OAuth authorization succeeds or fails.
6. Credential reference is stored backend-only.
7. Agent prepares one bounded action.
8. Kyra risk review is shown.
9. Owner approves or rejects in Kyra.
10. Base Account approval prompt is shown.
11. Owner approves or rejects in Base Account.
12. Provider submits only after Base Account approval.
13. Kyra shows sanitized result.

No state may skip the next state. OAuth consent cannot imply Kyra approval.
Kyra approval cannot imply Base Account approval.

## Disconnect UX Requirements

Future disconnect UI must:

- require authenticated owner session
- be reachable only from the private dashboard
- target one owner/workspace/agent/provider/resource/scope binding
- show the agent and provider being disconnected
- show which future actions will stop
- show whether provider revocation will be attempted
- show that Telegram access remains separate
- invalidate pending OAuth transactions
- invalidate pending prepared actions
- stop token refresh and MCP sessions
- record only sanitized audit events
- return a clear disconnected result state

Disconnect must not be possible from Telegram, public pages, LLM output,
external links, page load, route changes, background jobs, or unauthenticated
sessions.

## Emergency Disable UX

Future emergency disablement must be separate from ordinary disconnect.

It must clearly state:

- all official MCP OAuth starts are paused
- callbacks are rejected
- token refresh is stopped
- MCP sessions are stopped
- tool invocation is stopped
- prepared-action creation is stopped
- wallet execution is stopped
- existing owner audit history remains visible in sanitized form

Emergency disablement must be an operator/security control, not a user-facing
shortcut to delete evidence.

## Failure State Copy

Future UI must use deterministic failure copy:

| Failure | Owner-facing copy |
| --- | --- |
| Provider metadata missing | Official Base MCP provider evidence is incomplete. Wallet authority is blocked. |
| Scope drift | The provider scope changed. Reconnect is required after review. |
| Token expired | Your connection expired. Reconnect from the dashboard. |
| Token revoked | This agent's Base Account binding is disconnected. |
| Refresh reuse detected | Credential safety check failed. The binding was revoked. |
| Wrong owner/workspace/agent | This connection does not belong to the selected agent. |
| Telegram request | Telegram cannot approve, sign, submit, disconnect, or revoke wallet authority. |
| Kill switch active | Official Base MCP execution is paused for safety. |

Errors must not include raw provider bodies, token refs, auth codes, state,
PKCE values, wallet payloads, calldata, signatures, Telegram tokens, or user
identifiers beyond safe display labels.

## Telegram Boundary Copy

Telegram may only say equivalent safe copy:

```text
I cannot approve, sign, submit, disconnect, or revoke wallet authority from
Telegram. Open the private Kyra dashboard to review this agent's Base Account
binding.
```

Telegram must not provide provider approval links, OAuth authorization URLs,
disconnect links, token status, credential references, wallet payloads,
calldata, signatures, or transaction raw data.

## Public Route Boundary

Public agent pages may show only high-level capability status such as:

- read-only
- wallet authority blocked
- Base MCP not connected
- execution disabled

Public pages must not show owner identity, Base Account labels, provider
credential state, scope grants, consent packets, disconnect controls, approval
links, prepared actions, wallet payloads, signatures, or transaction raw data.

## Implementation Preconditions

No consent or disconnect UI may become interactive until:

1. Phase 7C changes from NO-GO to GO.
2. Owner explicitly approves Phase 7D transition.
3. Phase 7AQ authority binding is current.
4. Phase 7AR token lifecycle is current.
5. Phase 7AS schema/RLS boundary is current.
6. Provider resource, issuer, scope, tool authority, and approval semantics are
   verified.
7. Copy and UI states receive separate review.
8. Runtime gates remain default-off until tests are green.

## Current Repository Boundary

The repository must remain in this state after Phase 7AT:

- no live Base Account connect control
- no official Base MCP authorize button
- no official OAuth authorization URL generator
- no disconnect/revoke runtime
- no token status API
- no approval link renderer
- no wallet prompt
- no signing
- no transaction submission
- `walletExecution` remains `disabled`
- Telegram and public routes remain non-authoritative

## Verification

- `npm run check:phase-7at`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Future consent screen fields are explicit.
- Required and forbidden consent copy are explicit.
- Kyra approval and Base Account approval separation is explicit.
- Disconnect, revoke, emergency disablement, failure, Telegram, and public route
  boundaries are explicit.
- Runtime remains NO-GO and disabled.
- No UI control, OAuth route, token storage, MCP session, wallet prompt,
  signing, transaction, SQL migration, deploy, or push occurred.
