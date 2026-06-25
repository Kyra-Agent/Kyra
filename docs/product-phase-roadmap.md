# Kyra Agent Canonical Product Roadmap

Date: 2026-06-25

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

## The 10 Product Phases

This is the only active roadmap. Older Phase 7A-Z documents remain supporting
evidence packets, not extra product phases.

| Phase | Name | Product outcome | Current status |
| --- | --- | --- | --- |
| 1 | Product Foundation | Product identity, public positioning, route shell, and baseline UX. | Complete |
| 2 | Backend Foundation | Supabase-backed product data, deploy records, dashboard reads, public profile reads. | Complete |
| 3 | Security + Privacy Foundation | Private/public data split, RLS assumptions, secret hygiene, owner-only sensitive state. | Complete |
| 4 | Agent Deployment Flow | Users can create demo agents from templates and module stacks. | Complete |
| 5 | Telegram + LLM Live | Connected deployed agents reply in Telegram with read-only commands and LLM planning. | Complete, live read-only |
| 6 | Wallet/Approval Foundation | Wallet readiness, approval policy, risk review, prepared-action models, and refusal boundaries. | Foundation complete |
| 7 | Base Account + Execution Readiness | Owner Base Account connection, prompt locks, prepared-action allowlist, policy gates, dual approval model, result closeout model, production smoke freeze. | Complete as readiness; not live execution |
| 8 | Controlled Live Transaction | One owner, one deployed agent, one low-risk prepared action, explicit Kyra approval, explicit Base Account approval, real submission, owner-only result. | Next |
| 9 | Public Execution Hardening | Rate limits, rollback, incident controls, monitoring, privacy audits, abuse controls, and wider execution eligibility. | Pending |
| 10 | Product Release Readiness | Public-ready copy, support ops, launch QA, production runbook, final audit, and release decision. | Pending |

## Phase 1 - Product Foundation

Outcome:

- Kyra is positioned as a Base-native AI agent console.
- Public and private surfaces clearly separate product marketing, dashboard,
  and deployed-agent identity.
- UI copy does not imply unsupported wallet execution.

Status: complete.

## Phase 2 - Backend Foundation

Outcome:

- Backend-connected demo data exists through Supabase.
- Dashboard and public profile reads are backend-ready.
- Activity and deployment records are sanitized before display.

Status: complete.

## Phase 3 - Security + Privacy Foundation

Outcome:

- Owner data, Telegram bot-token handling, wallet information, and public
  profile information have clear boundaries.
- Secrets are kept out of public docs and source.
- User wallet authority and user Telegram bot-token privacy are priority one.

Status: complete.

## Phase 4 - Agent Deployment Flow

Outcome:

- Users can deploy demo agents from templates.
- Deployed agents receive template-specific modules.
- Workspace ownership and demo persistence exist.

Status: complete for the current backend-connected product demo.

## Phase 5 - Telegram + LLM Live

Product outcome:

- Each deployed agent can use its own connected Telegram bot.
- Authorized chats receive slash-command and bounded natural-language replies.
- LLM enrichment is backend-only.
- Wallet and onchain requests are refused.

Status: complete and live read-only.

Canonical closeout:

- `docs/phase-5-telegram-closeout.md`

## Phase 6 - Wallet/Approval Foundation

Product outcome:

- Prepare a Base action model.
- Show the owner transaction and risk context.
- Require explicit user-controlled wallet approval.
- Record the result safely.

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

## Phase 7 - Base Account + Execution Readiness

Product outcome:

Kyra is ready to attempt controlled execution, but wallet signing and
transaction submission remain disabled until Phase 8.

Delivered:

- owner-click Base Account connection in the private dashboard
- Base Account only connector
- browser-session-only connection with no auto reconnect
- owner/workspace/agent/chain/address drift disconnects
- Phase 7E wallet prompt/signing boundary is implemented
- Phase 7F prepared-action adapter allowlist is implemented
- Phase 7G prepared-action policy enforcement is implemented
- Phase 7H dual approval and freeze boundary is implemented
- Phase 7I result monitoring and closeout boundary is implemented
- Phase 7J controlled live transaction gate is implemented
- production smoke freeze checkpoint is recorded
- controlled execution launch packet is visible

Status: complete as readiness; not live execution.

Phase 7 remains locked against:

- wallet signing
- transaction submission
- token approvals
- Telegram-triggered wallet execution
- public execution visibility
- official hosted Base MCP OAuth
- official hosted Base MCP tokens
- official hosted Base MCP sessions
- official hosted Base MCP tool invocation
- transaction hash persistence before observed provider submission

Canonical readiness documents:

- `docs/phase-7D-base-account-connection-runtime.md`
- foundation closeout: `docs/phase-7D-foundation-closeout.md`
- `docs/phase-7E-wallet-prompt-signing-audit.md`
- `docs/phase-7F-prepared-action-allowlist.md`
- `docs/phase-7G-prepared-action-policy-enforcement.md`
- `docs/phase-7H-dual-approval-execution.md`
- `docs/phase-7I-result-monitoring-closeout.md`
- `docs/phase-7J-base-mcp-provider-wiring.md`
- `docs/controlled-execution-launch-packet.md`
- `docs/production-smoke-freeze-checkpoint.md`

Supporting readiness packets:

- Group 1: read-only caller and status surface
- Group 2: controlled smoke preparation and provider qualification
- Group 3: official-provider decisioning and offline go/no-go review
- Group 4: owner authority and consent blueprints
- Group 5: disabled route skeleton and auth-helper readiness

The groups are not additional product phases. They are retained as supporting
evidence under Phase 7 and summarized in:

- `docs/supporting-readiness-closeout.md`
- `docs/phase-7AL-official-base-mcp-unblock-readiness.md`

Supporting packet references retained for local guards:

- `docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`
- `docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md`
- `docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md`
- `docs/phase-7AU-official-oauth-route-implementation-plan.md`
- `docs/phase-7AV-disabled-route-test-harness-plan.md`
- `docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md`
- `docs/phase-7AX-disabled-only-route-skeleton.md`
- `docs/phase-7AY-owner-authentication-boundary-packet.md`
- `docs/phase-7AZ-owner-auth-helper-approval-packet.md`

### Phase 7 Evidence Appendix

These headings are retained so older local guards can verify that Phase 7
readiness evidence still exists. They are not extra product phases.

### 7C - Official Base MCP Provider Contract

Status: blocked by currently verified provider metadata and scope ambiguity.

This gate keeps official MCP OAuth, token storage, authenticated sessions,
tool discovery, tool invocation, and provider approval links disabled until
the official adapter has verified evidence and explicit owner approval.

Evidence:

- `docs/phase-7C-official-base-mcp-provider-contract-audit.md`
- `docs/phase-7C-go-criteria-hard-gate.md`

### 7D - Base Account Connection Per Deployed Agent

Status: complete and live for owner-initiated Base Account connection.

Evidence:

- foundation closeout: `docs/phase-7D-foundation-closeout.md`
- `docs/phase-7D-base-account-connection-runtime.md`

### 7F - Prepared-Action Adapter Allowlist

Status: complete as a deterministic allowlist boundary.

Evidence:

- `src/types/preparedAction.ts`
- `scripts/test-prepared-action-allowlist.mjs`
- `docs/phase-7F-prepared-action-allowlist.md`

### 7G - Prepared Action And Policy Enforcement

Status: complete as a policy enforcement boundary.

Evidence:

- `src/types/preparedActionPolicy.ts`
- `scripts/test-prepared-action-policy.mjs`
- `docs/phase-7G-prepared-action-policy-enforcement.md`

Phase 7H dual approval and freeze boundary is implemented.
Phase 7I result monitoring and closeout boundary is implemented.
Phase 7J controlled live transaction gate is implemented.
Status: complete and live for owner-initiated Base Account connection.

### 7H - Dual Approval Execution

Status: complete as a local dual-approval and freeze boundary.

Evidence:

- `docs/phase-7H-dual-approval-execution.md`
- `src/types/dualApprovalExecution.ts`

### 7I - Result Monitoring And Closeout

Status: complete as a local result monitoring and closeout boundary.

Evidence:

- `docs/phase-7I-result-monitoring-closeout.md`
- `src/types/resultMonitoringCloseout.ts`

### 7J - Controlled Live Transaction

Status: complete as a local controlled-live gate definition.

Evidence:

- `docs/phase-7J-base-mcp-provider-wiring.md`
- `docs/controlled-execution-launch-packet.md`

Controlled execution launch packet: `docs/controlled-execution-launch-packet.md`
It does not enable wallet prompt, signing, submission, or official MCP tools.

Phase 8 is the next phase.

## Phase 8 - Controlled Live Transaction

Product outcome:

One deployed agent completes one narrow, manually approved Base action through
the owner's Base Account.

Phase 8 is not complete until this complete user flow works:

```text
selected deployed agent
-> connect owner's Base Account
-> create one bounded prepared action through Kyra's adapter
-> run NYX-05 and deterministic policy review
-> receive explicit Kyra owner approval
-> receive explicit Base Account SDK approval in the browser
-> submit from the user's Base Account
-> record confirmed or failed owner-only result
-> complete rollback and post-transaction audit
```

Required before implementation:

- one authenticated owner
- one workspace
- one deployed agent
- one owner-click Base Account connection
- one allowlisted low-risk prepared action
- explicit Kyra approval copy
- explicit Base Account approval copy
- rollback ready
- emergency disablement ready
- owner-only post-action audit

Status: next. Do not start Phase 8 unless Phase 7 verification is green and the
owner explicitly approves the live execution window.

## Phase 9 - Public Execution Hardening

Product outcome:

Controlled execution becomes eligible for broader public use without weakening
privacy, owner authority, approval, or rollback requirements.

Required:

- production rate limits and abuse controls
- transaction amount and action limits
- incident and emergency disablement runbook
- monitoring and owner-only audit review
- privacy review for public profiles, Telegram, dashboard, and logs
- negative-case tests for prompt, signing, approval, replay, drift, and
  provider failures

Status: pending.

## Phase 10 - Product Release Readiness

Product outcome:

Kyra is ready to be treated as a public product, not only a demo.

Required:

- final README and website product copy
- final support and operator runbook
- production launch checklist
- Netlify and Supabase health evidence
- final security and privacy audit
- final release decision

Status: pending.

## Base MCP Position

Base Account is the primary user transaction boundary.

Official hosted Base MCP remains an optional provider adapter. It is not
required for Kyra's primary Base Account SDK path, and it stays disabled until
provider metadata, resource/audience, scope semantics, scope-to-tool mapping,
consent, token lifecycle, revocation, and owner approval are all verified.

Current official-provider audit:

- `docs/phase-7C-official-base-mcp-provider-contract-audit.md`
- decision: no-go for the official hosted adapter until evidence is verified

Status: blocked by currently verified provider metadata and scope ambiguity.

This NO-GO applies only to the official hosted `mcp.base.org` adapter. It does
not block the independent Base Account SDK lane.

This restriction does not freeze the independent Base Account SDK primary
lane.

Coinbase CDP Node or another RPC provider may later support independent chain
verification, monitoring, analytics, or fallback reads. It is not required for
the primary Base Account product flow.

## Telegram Boundary

Telegram remains unable to sign or submit.

A later approved Telegram flow may create an owner review draft, but execution
still requires:

- private Kyra dashboard review
- Kyra owner approval
- Base Account manual approval

Telegram bot tokens and Base MCP credentials must remain completely separate.

## Current Position

Current position:

- Phases 1-5 are live/readiness complete for product, backend, deployment,
  Telegram, and LLM read-only use.
- Phase 6 is foundation complete.
- Phase 7 is complete as Base Account + execution readiness.
- Phase 8 is the next product phase: controlled live transaction.
- Phase 9 and Phase 10 remain pending.

Before Phase 8 starts, keep these checks green:

- `npm run check:roadmap`
- `npm run check:pre-base-mcp`
- `npm run check:execution-launch-readiness`
- `npm run check:phase-7`
- `npm run build`
- `git diff --check`

Do not enable wallet signing or transaction submission merely because the
connection path exists. Each gate remains separate.

Wallet signing, token approval, swaps, transfers, contract calls, transaction
submission, and transaction hash persistence remain disabled until their
separate owner-approved gates are implemented and verified.
