# Kyra Agent Canonical Product Roadmap

Date: 2026-06-20

Status: canonical source of truth for product phases and execution flow.

This document resolves conflicting wording across older phase plans and
closeout notes. If another document disagrees with this roadmap about product
sequence, phase status, or the meaning of "live", this roadmap wins.

## Product Identity

Kyra is a platform for deploying user-owned AI agents.

Each deployed agent is bound to:

- one authenticated Kyra owner
- one workspace
- one agent instance
- one template and module stack
- one Telegram interface when connected
- one owner-controlled Base Account connection when authorized
- one wallet policy and approval boundary
- one private audit trail

Kyra is not one shared trading agent and must never use a platform-owned wallet
as the default wallet for deployed agents.

## Immutable Product Flow

```text
User signs in
-> user deploys an agent from a template
-> agent receives its template-specific module stack
-> user optionally connects a Telegram bot to that agent
-> user connects their own Base Account to that agent
-> Kyra's prepared-action adapter converts bounded intent into an action
-> NYX-05 and deterministic policy produce a risk review
-> owner reviews and approves or rejects in Kyra
-> Base Account SDK presents its own manual approval in the private dashboard
-> the user's Base Account submits the transaction
-> Kyra records a sanitized owner-only result
```

No implementation may skip ownership, policy review, Kyra approval, or Base
Account approval.

## Status Vocabulary

Use these terms consistently:

- `implemented`: code or design exists locally.
- `deployed`: code is installed in production infrastructure.
- `live read-only`: production users can use the feature without write or
  wallet authority.
- `foundation complete`: safety models and UI exist, but the real capability is
  still gated.
- `live execution`: a real user-owned wallet action can complete end to end.
- `phase complete`: every product outcome for that phase is live, unless the
  phase explicitly says it is a foundation-only phase.

Do not call a modeled, simulated, default-off, or smoke-only capability live
execution.

## Phase 1-4 - Product And Deployment Foundation

Outcome:

- Users can sign in.
- Users can deploy agents from templates.
- Deployed agents have private dashboard records and public profiles.
- Templates map to module stacks.
- Workspace ownership and demo persistence exist.

Status: complete for the current backend-connected product demo.

## Phase 5 - Telegram And LLM

Product outcome:

- Each deployed agent can use its own connected Telegram bot.
- Authorized chats receive slash-command and bounded natural-language replies.
- LLM enrichment is backend-only.
- Wallet and onchain requests are refused.

Status: complete and live read-only.

Canonical closeout:

- `docs/phase-5-telegram-closeout.md`

## Phase 6 - Wallet And Approval Foundation

Original product objective:

- prepare a Base action
- show the owner the transaction and risk context
- require explicit user-controlled wallet approval
- record the result safely

Delivered outcome:

- wallet readiness model and private dashboard surface
- Base Account-first Wagmi/Viem provider decision
- approval policy model
- prepared-action contracts and review UI
- NYX-05 risk classification
- unsigned handoff model
- signing and result state models
- Telegram execution refusal
- privacy, ownership, and log hardening

Status: foundation complete, not live execution.

Phase 6 did not enable:

- a real Base Account connection prompt
- production prepared-action writes
- official Base MCP authorization or tools
- wallet signing
- transaction submission

Canonical documents:

- `docs/phase-6-wallet-base-checklist.md`
- `docs/phase-6-closeout-audit.md`
- `docs/phase-6C-wallet-provider-decision.md`

## Phase 7 - Base Account Live Execution

Product outcome:

One deployed agent can prepare and complete one narrow, manually approved Base
action through the owner's Base Account. The primary path uses Kyra's bounded
prepared-action adapter and Base Account SDK. Official hosted Base MCP is an
optional provider adapter and is not a dependency for this outcome.

Phase 7 is not complete until the complete user flow works:

```text
selected deployed agent
-> connect owner's Base Account
-> create one bounded prepared action through the Kyra adapter
-> run risk and permission review
-> receive explicit Kyra owner approval
-> receive explicit Base Account SDK approval in the browser
-> submit from the user's Base Account
-> record confirmed or failed result
```

Canonical provider separation:

- `docs/phase-7-provider-separation-decision.md`

### 7A - Security And Ownership Audit

Status: complete.

Includes ownership, RLS, public/private boundaries, Telegram isolation,
observability, rollback, and fail-closed gates.

### 7B - Read-Only Infrastructure Proof

Status: complete.

The custom `kyra_status_v1` bridge proved:

- owner-dashboard-only invocation
- backend provider isolation
- persistent rate limiting
- gate-on/gate-off closeout
- no wallet, signing, storage, Telegram, or transaction side effects

This bridge is not a transaction adapter and does not satisfy the Phase 7
product outcome.

### 7C - Official Base MCP Provider Contract

Status: blocked by currently verified provider metadata and scope ambiguity.

Current audit:

- `docs/phase-7C-official-base-mcp-provider-contract-audit.md`
- decision: no-go for live wallet authority until official provider metadata,
  non-escalating scope semantics, and exact scope-to-tool mapping are verified.
- `docs/phase-7C-go-criteria-hard-gate.md`
- `npm run check:phase-7c-hard-gate`

Required:

- verify current official endpoint and discovery contract
- verify exact OAuth resource and issuer
- verify exact scope semantics
- verify exact scope-to-tool mapping
- reject undocumented escalation or implicit fallback scopes

Boundary:

- this NO-GO applies only to the official hosted `mcp.base.org` adapter
- it does not block the Base Account SDK primary transaction path
- official MCP OAuth, tokens, sessions, tools, and provider approval links
  remain disabled

### 7D - Base Account Connection Per Deployed Agent

Status: foundation clear; primary Base Account runtime may proceed through its
own reviewed gates. It does not depend on Phase 7C changing to GO.

Required binding:

```text
owner + workspace + agent instance + Base Account + exact consent
```

Current implementation note:

- local owner-auth and ownership helpers now exist for future route layers
- helper tests cover bearer parsing, canonical owner IDs, exact
  owner/workspace/agent binding, fixed 404 anti-enumeration, and sanitized 500
- helpers remain pure dependency-injected modules with no environment reads,
  Supabase client construction, provider contact, token handling, wallet
  prompts, signing, transaction submission, route imports, frontend wiring, or
  Telegram wiring
- Base Account connection remains not implemented
- official MCP OAuth runtime, token storage, and sessions remain separately
  blocked and not implemented
- foundation closeout is recorded in
  `docs/phase-7D-foundation-closeout.md`

Only the authenticated owner may initiate connection from the private
dashboard. Telegram, public profiles, LLM output, page load, and background
jobs cannot initiate it.

### 7E - Wallet Prompt And Signing Security

Status: architecture modeled; runtime not implemented.

Required:

- user-initiated Base Account SDK prompt from the private dashboard only
- exact chain and selected deployed-agent binding
- reviewed prepared action before signing
- rejection, network mismatch, expiry, cancellation, and replay-safe behavior
- no Telegram, public page, page-load, background, or LLM-triggered prompt

Official MCP OAuth and token security remain a separate optional-provider gate
under Phase 7C and its dedicated security packets.

### 7F - Prepared-Action Adapter Allowlist

Status: not implemented.

Required:

- allowlist exact Kyra action kinds and canonical input schemas
- validate chain, asset, recipient, amount, value, and calldata policy
- treat LLM, plugin, provider, and external API output as untrusted data
- fail closed on action or schema drift

Any future official MCP adapter must translate into this same contract and
pass its separate Phase 7C qualification.

### 7G - Prepared Action And Policy Enforcement

Status: contracts modeled; production path not active.

Required:

- owner-scoped prepared-action persistence
- exact agent, chain, action, asset, recipient, value, and expiry policy
- NYX-05 risk review
- idempotency and replay protection
- owner-visible transaction context

### 7H - Dual Approval Execution

Status: not implemented.

Required order:

1. Kyra owner approval.
2. Kyra freezes the reviewed prepared action.
3. Base Account SDK shows the signable transaction in the browser.
4. User manually approves in Base Account.
5. Base Account submits only after confirmation.

Kyra approval and Base Account approval are separate decisions. Future
official MCP OAuth consent would be a third, separate decision.

### 7I - Result Monitoring And Closeout

Status: model exists; live official MCP result path not implemented.

Required:

- poll official request status
- store a transaction hash only after provider submission
- record confirmed, failed, expired, rejected, or cancelled
- sanitize provider errors
- keep results owner-only
- support disconnect and emergency disablement

### 7J - Controlled Live Transaction

Status: not started.

Required:

- one owner
- one workspace
- one deployed agent
- one Base Account
- one allowlisted action
- Base or Base Sepolia according to reviewed provider support
- low-risk amount
- explicit Kyra and Base Account approvals
- gate off and rollback ready before and after the window

Phase 7 closes only after this controlled transaction succeeds safely and the
post-transaction audit passes.

## Telegram Boundary After Phase 7

Telegram remains unable to sign or submit.

A later approved Telegram flow may create an owner review draft, but execution
still requires:

- private Kyra dashboard review
- Kyra owner approval
- Base Account manual approval

Telegram bot tokens and Base MCP credentials must remain completely separate.

## Optional Infrastructure

Coinbase CDP Node or another RPC provider may later support independent chain
verification, monitoring, analytics, or fallback reads.

It is not required for the primary Base Account product flow or the optional
official Base MCP adapter and must not be numbered as a primary product phase.

## Current Next Step

Current position:

- Phase 7D foundation is clear.
- Phase 7D primary Base Account runtime may proceed through its own gates.
- Phase 7E Base Account wallet-prompt and signing work may follow only after
  the Phase 7D connection boundary is implemented and reviewed.
- Phase 7C official Base MCP evidence remains blocked, but blocks only the
  optional official hosted adapter.

Before implementation resumes, keep the pre-Base MCP cleanup gate green:

- `docs/phase-7-pre-base-mcp-cleanup-audit.md`
- `npm run check:pre-base-mcp`

The next primary work item is Phase 7D:

1. Implement one owner-initiated Base Account SDK connection from the private
   dashboard.
2. Bind the connection to the authenticated owner, workspace, and selected
   deployed agent.
3. Keep prepared-action writes, signing, and submission disabled until their
   own reviewed gates are complete.
4. Keep official MCP OAuth, token storage, sessions, tools, and provider
   approval links disabled while Phase 7C is NO-GO.

Do not enable wallet signing or transaction submission merely because the
connection path exists. Each later gate remains separate.

While Phase 7C remains NO-GO, official hosted MCP work is limited to:

- official Base MCP evidence monitoring
- documentation cleanup
- local checks and static guards
- threat-model refinement
- test-only official-MCP helper hardening that does not integrate routes

This restriction does not freeze the independent Base Account SDK primary
lane. Do not let either lane bypass the shared ownership, prepared-action,
policy, approval, signing, rollback, or audit boundaries.

Transition lock:

- `docs/phase-7AK-official-base-mcp-transition-gate.md`
- `npm run check:phase-7ak`
- `docs/phase-7AL-official-base-mcp-unblock-readiness.md`
- `npm run check:phase-7al`
- `docs/phase-7AM-official-base-mcp-operator-status.md`
- `npm run status:base-mcp`
- `npm run check:phase-7am`
- `docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md`
- `npm run check:phase-7an`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `npm run check:phase-7ao`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `npm run check:phase-7ap`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `npm run check:phase-7aq`
- `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`
- `npm run check:phase-7ar`
- `docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md`
- `npm run check:phase-7as`
- `docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md`
- `npm run check:phase-7at`
- `docs/phase-7AU-official-oauth-route-implementation-plan.md`
- `npm run check:phase-7au`
- `docs/phase-7AV-disabled-route-test-harness-plan.md`
- `npm run check:phase-7av`
- `docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md`
- `npm run check:phase-7aw`
- `docs/phase-7AX-disabled-only-route-skeleton.md`
- `npm run check:phase-7ax`
- `docs/phase-7AY-owner-authentication-boundary-packet.md`
- `npm run check:phase-7ay`
- `docs/phase-7AZ-owner-auth-helper-approval-packet.md`
- `npm run check:phase-7az`

This gate keeps official MCP OAuth, token storage, authenticated sessions,
tool discovery, tool invocation, and provider approval links blocked while
Phase 7C remains no-go. It does not block the independent Base Account SDK
connection lane.

The unblock readiness matrix states the exact evidence required before the
transition can be reconsidered.

The operator status command summarizes the current blocked state and safe next
work without network, OAuth, token, wallet, MCP session, tool, or transaction
side effects.

The production UI and evidence refresh checkpoint confirms the deployed site is
reachable, the dashboard still shows the Base MCP blocked boundary, and the
latest official Base MCP public evidence still matches the blocked baseline.

The go/no-go decision packet freezes the current result as NO-GO for the
official hosted MCP adapter until the missing provider evidence is reviewed
and the owner explicitly approves that adapter.

The NO-GO runtime freeze guard verifies the current code cannot open official
OAuth, official MCP sessions, tools, or provider approval links while the
decision remains NO-GO. Wallet signing and transactions remain disabled by
their independent Base Account execution gates.

The owner wallet-authority blueprint defines the future owner/workspace/agent/
Base Account/resource/scope/consent binding and approval order without enabling
runtime wallet authority.

The token lifecycle and revocation blueprint defines the future authorization
code, PKCE, state, access-token, refresh-token, credential-reference, refresh,
disconnect, audit, and incident boundaries without enabling official OAuth or
token storage.

The official MCP token schema and RLS blueprint defines future private tables,
owner-summary views, forbidden secret columns, grant lockdown, boolean-only
verifiers, and public/Telegram/LLM exclusions without approving executable SQL.

The owner consent and disconnect UX blueprint defines future consent fields,
required copy, forbidden generic authority copy, approval separation,
disconnect, emergency disablement, failure states, Telegram refusal, and public
route boundaries without enabling any interactive wallet authority control.

The official OAuth route implementation plan defines future start, callback,
token broker, revoke, status, gate, test, rollback, and incident contracts
without creating official OAuth routes or enabling runtime authority.

The disabled route test harness plan defines the future static absence,
disabled-route, gate parsing, request shape, redaction, no-wiring, and
pass/fail test contracts that must exist before route skeletons can be added.

The disabled-only route skeleton approval packet defines the exact future
code-bearing scope, allowed file boundary, fixed disabled responses,
independent gates, test-first order, privacy rules, rollback rules, and
separate owner approval required before any route skeleton file can exist.
Its current state is `owner_approved_disabled_skeleton`, limited to the exact
local Phase 7AX file boundary. It does not approve provider contact, OAuth,
tokens, wallet authority, deploy, or push.

The Phase 7AX disabled-only route skeleton implements independent exact-`true`
gates, fixed sanitized 403 disabled responses, fixed sanitized 503
not-implemented responses, redaction helpers, route tests, and a static
no-wiring checker. Its result is `disabled_safe`; the routes have no provider,
OAuth, token, MCP, frontend, Telegram, wallet, signing, transaction, deploy, or
production configuration path.

The Phase 7AY owner-authentication boundary packet defines trusted owner
identity, owner/workspace/agent ownership, separate caller classes for start,
status, revoke, callback, and token broker, gateway versus function-level auth,
request ordering, replay, CORS, enumeration, logging, and privacy rules. It
does not add auth helpers or allow the disabled skeletons to process identity,
body, query, OAuth, token, wallet, or provider data.

The Phase 7AZ owner-auth helper approval packet defines the future five-file
helper boundary, dependency-injected APIs, canonical UUID rules, fixed 404
anti-enumeration policy, sanitized error model, test-first order, rollback
rules, and strict no-route-integration condition. It does not approve helper
implementation, route imports, configuration, provider, OAuth, token, wallet,
deploy, or push work.

After owner approval, the local owner-auth and ownership helper milestone added
the pure dependency-injected helper files and tests plus the static
`check-official-mcp-owner-auth-boundary` guard. This advances the 7D owner and
agent-binding foundation only. It still does not add route integration,
official MCP OAuth, token storage, provider contact, Base Account connection,
wallet prompts, signing, transactions, deploy, or push work.
