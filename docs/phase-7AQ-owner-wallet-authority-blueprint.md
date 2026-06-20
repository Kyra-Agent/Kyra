# Phase 7AQ Owner Wallet Authority Blueprint

Date: 2026-06-20

Status: blueprint complete. Runtime remains NO-GO and disabled.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7P-official-mcp-oauth-client-architecture.md`
- `docs/phase-6C-wallet-provider-decision.md`

## Objective

Define the future owner wallet-authority contract for Phase 7D without opening
wallet, official Base MCP OAuth, token, MCP session, tool, signing, or
transaction runtime.

This blueprint exists so a future GO decision has an exact implementation path
instead of improvising around user wallet security. It does not authorize Phase
7D by itself.

## Required Binding

Every future wallet-authority record must bind exactly one:

```text
owner user
-> workspace
-> deployed agent instance
-> Base Account
-> official Base MCP resource
-> exact scope
-> exact consent packet
```

No global wallet, platform-owned wallet, shared provider credential, shared
Telegram credential, or cross-agent authorization is allowed.

## Allowed Initiation Surface

Future Base Account connection may be initiated only from the private Kyra
dashboard by the authenticated owner.

The initiating UI must show:

- owner account identity
- workspace
- deployed agent display name and ID
- provider name
- exact resource/audience
- exact scope
- exact capability class
- chain
- spending/value limit, if any
- expiry or revocation path
- statement that Telegram cannot approve, sign, or submit
- statement that Kyra approval and Base Account approval are separate

## Forbidden Initiation Surfaces

These must never initiate wallet authority, OAuth, consent, wallet prompt,
signing, or transaction submission:

- Telegram commands
- Telegram natural-language messages
- public agent pages
- public profile links
- LLM output
- tool descriptions
- page load
- route changes
- background jobs
- external links with untrusted query parameters
- unauthenticated browser sessions

## Consent Copy Requirements

Future owner consent copy must name:

- owner
- workspace
- deployed agent
- provider
- resource/audience
- exact scope
- exact allowed tools or capability class
- chains
- assets
- value ceilings
- expiry
- token storage boundary
- revocation path
- emergency disablement path
- Telegram prohibition

Consent copy must not hide wallet authority behind generic wording such as
`connect`, `sync`, `enable`, or `continue`.

## Approval Order

Future execution must preserve this order:

1. Owner authenticates in Kyra.
2. Owner selects one deployed agent.
3. Owner initiates Base Account / official Base MCP authorization from the
   private dashboard.
4. Kyra backend validates provider metadata, resource, issuer, scope, and state.
5. Official Base MCP authorization completes through backend-owned OAuth.
6. Kyra stores backend-only encrypted credential references.
7. Agent requests one allowlisted capability.
8. Kyra creates a bounded prepared action.
9. NYX-05 and deterministic policy produce the risk review.
10. Owner explicitly approves in Kyra.
11. Base Account presents separate manual approval.
12. User approves or rejects in Base Account.
13. Provider submits only after Base Account approval.
14. Kyra records sanitized owner-only result.

OAuth consent, Kyra action approval, and Base Account approval are separate
decisions. One cannot imply another.

## Token Boundary

Future official Base MCP tokens must be:

- backend-only
- encrypted at rest
- resolved by opaque reference
- bound to owner, workspace, agent, provider, resource, and exact scope
- excluded from browser responses
- excluded from Telegram
- excluded from LLM context
- excluded from public pages
- excluded from activity messages and logs
- revocable on disconnect, owner removal, workspace reset, incident, or scope
  drift

Raw authorization codes, PKCE verifiers, state, access tokens, refresh tokens,
provider bodies, wallet payloads, and signatures must never appear in frontend
state, public docs, logs, analytics, Telegram messages, or public profiles.

## Disconnect And Revocation

Future disconnect must:

- require authenticated owner action from the private dashboard
- target one owner/workspace/agent/provider binding
- revoke provider credentials when the provider supports revocation
- delete or tombstone local credential references
- invalidate pending OAuth transactions and prepared actions
- prevent refresh-token reuse
- record only sanitized owner-only audit events
- keep Telegram sessions separate

Emergency disablement must be global and independent from ordinary owner
disconnect.

## Replay And Expiry Protection

Future wallet-authority operations must include:

- one-time OAuth state
- PKCE S256
- browser-binding nonce
- short OAuth transaction TTL
- exact redirect URI
- exact issuer and resource checks
- one-time prepared-action IDs
- bounded prepared-action expiry
- owner/workspace/agent revalidation at every boundary
- idempotent result recording
- replay rejection for consumed state, expired approval, duplicate provider
  request, duplicate wallet submission, or mismatched owner

## Data Classes

Future implementation may propose these data classes, each with separate SQL
and RLS review:

| Class | Purpose | Public? |
| --- | --- | --- |
| Wallet authority binding | owner/workspace/agent/Base Account/provider metadata | no |
| OAuth transaction | one-time state, PKCE reference, browser binding, expiry | no |
| OAuth credential | encrypted token references and lifecycle metadata | no |
| Consent packet | exact reviewed scope/resource/tool copy | owner-only |
| Prepared action | bounded proposed action and risk review | owner-only |
| Execution result | sanitized confirmation/failure/rejection state | owner-only |
| Audit event | bounded non-secret event trail | owner-only |

No public table may expose wallet address details beyond explicitly approved
display labels. No table may expose tokens, codes, verifiers, states, secrets,
provider raw bodies, or transaction payloads to browser clients.

## Current Implementation Boundary

Current code remains limited to:

- disabled wallet provider boundary
- Base Account and Coinbase Wallet dependencies behind that disabled boundary
- owner-dashboard-only read-only `base_mcp_status_check`
- default-off custom status bridge
- no official Base MCP OAuth routes
- no official token storage
- no official MCP tool discovery or invocation
- no wallet prompt
- no signing
- no transaction submission

## Required Before Phase 7D Starts

Phase 7D may start only after:

1. Phase 7C changes from NO-GO to GO through reviewed provider evidence.
2. The owner explicitly approves the transition.
3. This blueprint is rechecked against the latest provider contract.
4. A concrete implementation plan maps every runtime route to a freeze guard.
5. SQL/RLS and token lifecycle plans are approved before any token persistence.

## Verification

- `npm run check:phase-7aq`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Owner wallet-authority binding is defined.
- Allowed and forbidden initiation surfaces are explicit.
- Consent copy requirements are explicit.
- Approval order is explicit.
- Token, disconnect, revocation, replay, and expiry boundaries are explicit.
- Future data classes are named without approving schema.
- Current runtime remains NO-GO and disabled.
- Package Phase 7 checks include this blueprint.
- No OAuth, token, session, MCP tool, wallet, signing, transaction, SQL deploy,
  Netlify deploy, or push occurred during this phase.
