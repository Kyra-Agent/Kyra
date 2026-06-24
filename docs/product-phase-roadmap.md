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

Status: complete and live for owner-initiated Base Account connection. This
does not enable signing or transaction execution.

Required binding:

```text
owner + workspace + agent instance + Base Account + exact consent
```

Current implementation note:

- local owner-auth and ownership helpers exist for route-layer binding
- owner-click Base Account connection is implemented in the private dashboard
- Base Account is the only enabled connector
- connection is browser-session-only with `storage: null` and no auto reconnect
- connection binds owner, workspace, selected deployed agent, connector, Base
  chain, and address in React memory
- target drift and wallet drift disconnect and fail closed
- the owner smoke verified Base Account consent and disconnect without
  transaction signing
- official MCP OAuth runtime, token storage, and sessions remain separately
  blocked and not implemented
- foundation closeout is recorded in
  `docs/phase-7D-foundation-closeout.md`
- connection closeout is recorded in
  `docs/phase-7D-base-account-connection-runtime.md`

Only the authenticated owner may initiate connection from the private
dashboard. Telegram, public profiles, LLM output, page load, and background
jobs cannot initiate it.

### 7E - Wallet Prompt And Signing Security

Status: complete as a signing security boundary. Runtime signing and
transaction submission remain disabled.

Required:

- user-initiated Base Account SDK prompt from the private dashboard only
- exact chain and selected deployed-agent binding
- reviewed prepared action before signing
- rejection, network mismatch, expiry, cancellation, and replay-safe behavior
- no Telegram, public page, page-load, background, or LLM-triggered prompt
- deterministic prompt eligibility guard
- dashboard evidence for why signing is locked

Official MCP OAuth and token security remain a separate optional-provider gate
under Phase 7C and its dedicated security packets.

Phase 7E closeout:

- `src/types/walletPromptEligibility.ts`
- `docs/phase-7E-wallet-prompt-signing-audit.md`
- `npm run check:phase-7e`

### 7F - Prepared-Action Adapter Allowlist

Status: complete as a deterministic allowlist boundary.

Delivered:

- allowlist exact Kyra action kinds and canonical input schemas
- validate chain, asset, recipient, amount, value, and calldata policy
- treat LLM, plugin, provider, and external API output as untrusted data
- fail closed on action or schema drift
- keep token spend, calldata, signing, submission, and provider tool authority
  disabled

Any future official MCP adapter must translate into this same contract and
pass its separate Phase 7C qualification.

Current implementation:

- `src/types/preparedAction.ts`
- `scripts/test-prepared-action-allowlist.mjs`
- `docs/phase-7F-prepared-action-allowlist.md`
- `npm run check:phase-7f`

### 7G - Prepared Action And Policy Enforcement

Status: complete as a policy enforcement boundary. Production storage and
approval writes remain disabled.

Delivered:

- owner-scoped prepared-action persistence gate
- exact agent, chain, action, asset, recipient, value, and expiry policy
- NYX-05 risk review
- idempotency and replay protection
- owner-visible transaction context

Current implementation:

- `src/types/preparedActionPolicy.ts`
- `scripts/test-prepared-action-policy.mjs`
- `docs/phase-7G-prepared-action-policy-enforcement.md`
- `npm run check:phase-7g`

Boundary:

- owner/session/agent binding is required
- prepared-action storage remains disabled until the explicit storage gate
- owner approval remains required
- wallet prompt, signing, submission, and transaction hash persistence remain
  disabled

### 7H - Dual Approval Execution

Status: complete as a local dual-approval and freeze boundary. Runtime wallet
prompt, signing, and transaction submission remain disabled.

Required order:

1. Kyra owner approval.
2. Kyra freezes the reviewed prepared action.
3. Base Account SDK shows the signable transaction in the browser.
4. User manually approves in Base Account.
5. Base Account submits only after confirmation.

Kyra approval and Base Account approval are separate decisions. Future
official MCP OAuth consent would be a third, separate decision.

Current implementation:

- `src/types/dualApprovalExecution.ts`
- `scripts/test-dual-approval-execution.mjs`
- `scripts/check-phase-7h-dual-approval.mjs`
- `docs/phase-7H-dual-approval-execution.md`
- `npm run check:phase-7h`

Boundary:

- owner approval must include approval id, owner id, and timestamp
- Kyra freezes the exact reviewed prepared action after owner approval
- mutation after approval fails closed as `reviewed_action_changed`
- Base Account connection and unsigned handoff are separate gates
- wallet prompt, signing, submission, transaction hash persistence, and
  official hosted Base MCP authority remain disabled

### 7I - Result Monitoring And Closeout

Status: complete as a local result monitoring and closeout boundary. Live
provider polling, transaction submission, and transaction hash persistence
remain disabled.

Required:

- poll official request status
- store a transaction hash only after provider submission
- record confirmed, failed, expired, rejected, or cancelled
- sanitize provider errors
- keep results owner-only
- support disconnect and emergency disablement

Current implementation:

- `src/types/resultMonitoringCloseout.ts`
- `scripts/test-result-monitoring-closeout.mjs`
- `scripts/check-phase-7i-result-monitoring-closeout.mjs`
- `docs/phase-7I-result-monitoring-closeout.md`
- `npm run check:phase-7i`

Boundary:

- owner, workspace, agent, and prepared-action scope are required
- execution results remain owner-only
- transaction hash is forbidden until provider submission is observed
- confirmed results require confirmation data
- provider failures use sanitized failure messages only
- disconnect is allowed only after closed, expired, or disabled result states
- emergency disablement closes the result without wallet or provider authority

### 7J - Controlled Live Transaction

Status: complete as a local controlled-live gate definition. Runtime wallet
prompt, signing, transaction submission, provider transaction calls, and
transaction hash persistence remain disabled.

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

Current implementation:

- `src/types/controlledLiveTransactionGate.ts`
- `scripts/test-controlled-live-transaction-gate.mjs`
- `scripts/check-phase-7j-base-mcp-provider-wiring.mjs`
- `docs/phase-7J-base-mcp-provider-wiring.md`
- `npm run check:phase-7j`

Boundary:

- gate requires one owner, one workspace, one deployed agent, one Base Account,
  and exactly one prepared action
- first live candidate must be deterministic allowlist pass and low risk
- rollback, emergency disablement, and post-transaction audit are mandatory
- Telegram and public routes cannot authorize controlled live transactions
- wallet prompt, signing, and transaction submission remain false in Phase 7J

## Supporting Readiness Packets

The product roadmap ends at Phase 7J. Anything after that in this repository
is a supporting readiness packet, not an additional product phase. These
packets cover the read-only status caller, controlled smoke preparation,
provider qualification, and official-provider decisioning needed for later
launch review.

Working groups for the supporting packets:

- Group 1: read-only caller and status surface
- Group 2: controlled smoke preparation and provider qualification
- Group 3: official-provider decisioning and offline go/no-go review
- Group 4: owner authority and consent blueprints
- Group 5: disabled route skeleton and auth-helper readiness

Group 3 scope:

- protocol split decision: `docs/phase-7N-official-base-mcp-protocol-decision.md`
- OAuth and wallet-authority threat model:
  `docs/phase-7O-official-mcp-oauth-threat-model.md`
- OAuth client architecture decision:
  `docs/phase-7P-official-mcp-oauth-client-architecture.md`
- scope and consent qualification:
  `docs/phase-7Q-official-mcp-scope-consent-qualification.md`
- current official Base MCP go/no-go packet:
  `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`

Group 3 keeps the official hosted Base MCP adapter in NO-GO unless protected
resource metadata, exact resource/audience, least-privilege scope,
scope-to-tool mapping, approval-link behavior, token lifecycle, revocation,
owner consent, and owner approval are all verified. It does not block the
independent Base Account SDK lane, and it must not enable OAuth, token storage,
MCP sessions, tool invocation, wallet prompts, signing, or transaction
submission.

Group 4 scope:

- owner wallet-authority blueprint:
  `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- token lifecycle and revocation blueprint:
  `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`
- official MCP token schema and RLS blueprint:
  `docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md`
- owner consent and disconnect UX blueprint:
  `docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md`

Group 4 keeps future wallet authority bound to one authenticated owner,
workspace, deployed agent, Base Account, exact resource, exact scope, explicit
consent packet, backend-only encrypted token reference, revocation path,
disconnect path, emergency disablement path, and sanitized owner-only audit.
It is blueprint-only: it must not add executable SQL, RLS changes, OAuth
routes, token exchange, token storage, consent UI, wallet prompts, signing, or
transaction submission without a separate owner-approved implementation gate.

Group 5 scope:

- disabled-only route test harness plan:
  `docs/phase-7AV-disabled-route-test-harness-plan.md`
- disabled-only route skeleton approval packet:
  `docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md`
- disabled-only route skeleton:
  `docs/phase-7AX-disabled-only-route-skeleton.md`
- owner-authentication boundary packet:
  `docs/phase-7AY-owner-authentication-boundary-packet.md`
- owner-auth helper approval packet:
  `docs/phase-7AZ-owner-auth-helper-approval-packet.md`
- local owner-auth helper boundary checker:
  `scripts/check-official-mcp-owner-auth-boundary.mjs`

Group 5 keeps official MCP route code disabled-only and helper-only. Route
files must fail closed, avoid request-body and query-value business logic,
return fixed sanitized responses, and remain unwired from frontend, Telegram,
wallet providers, Supabase deployment config, provider endpoints, OAuth token
exchange, MCP sessions, tool invocation, signing, and transaction submission.
Owner-auth helpers may validate authenticated owner and owner/workspace/agent
binding only through dependency-injected APIs; route integration still requires
a separate owner-approved implementation gate.

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

- Phase 7D owner-initiated Base Account connection is pushed, deployed, and
  owner-smoked as a non-transactional connection.
- Phase 7E wallet prompt/signing boundary is implemented as a deterministic
  fail-closed guard and dashboard evidence surface.
- Phase 7F prepared-action adapter allowlist is implemented as a deterministic
  owner-dashboard-only schema boundary.
- Phase 7G prepared-action policy enforcement is implemented as an
  owner/session/agent/storage/risk/approval boundary.
- Phase 7H dual approval and freeze boundary is implemented as a local
  owner-approval state model with dashboard evidence.
- Phase 7I result monitoring and closeout boundary is implemented as a local
  owner-only sanitized result model with dashboard evidence.
- Phase 7J controlled live transaction gate is implemented as a local
  owner-only go/no-go model with dashboard evidence.
- Supporting readiness packets exist for the read-only caller, controlled
  smoke preparation, provider qualification, and official-provider decision.
- Wallet signing, token approval, swaps, transfers, contract calls, transaction
  submission, and transaction hash persistence remain disabled.
- Phase 7C official Base MCP evidence remains blocked, but blocks only the
  optional official hosted adapter.

Before implementation resumes, keep the pre-Base MCP cleanup gate green:

- `docs/phase-7-pre-base-mcp-cleanup-audit.md`
- `npm run check:pre-base-mcp`

The current primary roadmap work is complete at Phase 7J:

1. Keep the product roadmap frozen at the single canonical flow through 7J.
2. Treat later supporting packets as readiness documents, not new product
   phases.
3. Keep wallet prompt, signing, submission, and transaction hash persistence
   disabled until a separate owner-approved launch decision.
4. Preserve rollback, emergency disablement, and post-transaction audit
   readiness as mandatory prerequisites.

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

Supporting readiness packets:

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
