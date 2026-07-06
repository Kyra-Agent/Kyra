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
| 8 | Controlled Live Transaction | One owner, one deployed agent, one low-risk prepared action, explicit Kyra approval, explicit Base Account approval, controlled submission, owner-only result. | Complete: controlled live transaction implementation closeout |
| 9 | Public Execution Hardening | Rate limits, rollback, incident controls, monitoring, privacy audits, abuse controls, and wider execution eligibility. | Structurally complete; runtime default-off |
| 10 | Product Release Readiness | Public-ready copy, support ops, launch QA, production runbook, final audit, and release decision. | Active: Batch 10C launch QA and production health evidence |

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
- one low-risk prepared action
- explicit Kyra approval copy
- explicit Base Account approval copy
- owner-only result
- rollback ready
- emergency disablement ready
- owner-only post-action audit

Batch 1 evidence:

- `docs/phase-8-controlled-live-transaction.md`
- `src/types/phase8ControlledExecution.ts`
- `scripts/test-phase-8-controlled-execution.mjs`
- `scripts/check-phase-8-controlled-execution.mjs`

Batch 2 evidence:

- live-window preparation guard
- owner-approved live window
- private dashboard execute intent
- frozen action binding
- Base Account prompt readiness
- `src/types/phase8LiveWindowPreparation.ts`
- `scripts/test-phase-8-live-window-preparation.mjs`
- `scripts/check-phase-8-live-window-preparation.mjs`

Batch 3 evidence:

- controlled wallet prompt opening
- one-time prompt nonce
- owner-click Base Account prompt
- owner-only prompt audit
- transaction submission remains disabled
- `src/types/phase8WalletPromptOpening.ts`
- `scripts/test-phase-8-wallet-prompt-opening.mjs`
- `scripts/check-phase-8-wallet-prompt-opening.mjs`

Batch 4 evidence:

- controlled transaction submission
- one-time submission nonce
- Base Account approval recorded before submission
- sanitized transaction hash reference
- owner-only result closeout
- rollback and emergency disablement readiness
- `src/types/phase8ControlledSubmission.ts`
- `scripts/test-phase-8-controlled-submission.mjs`
- `scripts/check-phase-8-controlled-submission.mjs`

Batch 5 evidence:

- isolated owner dashboard submitter boundary
- `useSendTransaction` only inside `src/components/Phase8ControlledSubmitter.tsx`
- zero-value/no-calldata/Base-only request builder
- default-off runtime flag for the owner-approved live window
- `src/types/phase8OwnerSubmitRequest.ts`
- `scripts/test-phase-8-owner-submit-request.mjs`
- `scripts/check-phase-8-controlled-submitter.mjs`

Status: Batch 25 production closeout. Runtime execution remains default-off. Explicit owner-window flag enablement is required before activation.

Batch 6 evidence:

- owner live-window activation lock
- runtime window must be explicitly enabled
- controlled submission must already be ready
- operator acknowledgement must be recorded before the submitter can arm
- rollback, emergency disable, and post-transaction audit readiness remain required
- `src/types/phase8OwnerLiveWindowActivation.ts`
- `scripts/test-phase-8-owner-live-window-activation.mjs`
- `scripts/check-phase-8-owner-live-window-activation.mjs`

Batch 7 evidence:

- owner arming UX in the private dashboard
- browser-session-only arming state
- active arming bound to owner, workspace, agent, and frozen action
- one-time prompt and submission nonces are created only after owner arming
- reset control clears the browser-session arming state
- activation still requires the explicit runtime flag and all safety gates
- Telegram, public profiles, automation, swaps, token approvals, calldata, and non-zero value remain blocked


Batch 8 evidence:

- owner self-check candidate replaces the placeholder transaction recipient
- candidate requires owner, workspace, selected agent, Base Account connection, Base chain, and browser-session address
- candidate recipient is the connected owner Base Account address
- candidate remains zero-value and no-calldata
- private dashboard shows candidate status before arming
- active arming is invalidated when the connected Base Account candidate changes
- Telegram, public profiles, automation, swaps, token approvals, calldata, and non-zero value remain blocked
- `src/types/phase8OwnerActionCandidate.ts`
- `scripts/test-phase-8-owner-action-candidate.mjs`


Batch 9 evidence:

- owner-only result closeout bridge remains implemented
- submitter emits sanitized owner-only hash event after provider submission
- dashboard stores only the sanitized closeout event in browser state
- result closeout is cleared when arming/candidate context is invalidated
- controlled submission consumes submitted-state closeout evidence
- result monitoring observes provider-submitted status only after sanitized hash exists
- rejected or failed prompts do not create fake transaction hashes
- Telegram, public profiles, automation, swaps, token approvals, calldata, and non-zero value remain blocked
Status: Batch 25 production closeout. Runtime execution remains default-off. Explicit owner-window flag enablement is required before activation.
Do not open a live execution window until the owner explicitly approves it.

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

Phase 9 working groups:

1. Execution eligibility hardening
   - Define exactly which users, agents, templates, chains, action kinds, and value caps can access public execution.
   - Keep Telegram, public profiles, automation, swaps, token approvals, arbitrary calldata, private keys, and seed phrases blocked until explicitly approved.
   - Require owner sign-in, selected deployed agent, Base Account connection, Kyra approval, Base Account approval, receipt verification, and owner-only closeout for every transaction.
2. Abuse, rate limit, and value-limit enforcement
   - Add per-owner, per-agent, per-workspace, per-route, and per-wallet rate limits.
   - Enforce low-value caps, cooldowns, replay locks, nonce locks, duplicate-submit prevention, and provider failure backoff.
   - Keep all abuse decisions sanitized so user wallet data and Telegram token refs never leak to public surfaces.
3. Incident, rollback, and emergency controls
   - Ship operator-facing disable switches, rollback steps, manual recovery notes, and go/no-go rules.
   - Add failure-mode handling for rejected prompts, insufficient gas, reverted transactions, provider outage, chain mismatch, stale approval, stale prepared action, and stuck receipt verification.
   - Require a post-incident owner-only audit record before any affected execution lane can be re-enabled.
4. Monitoring, support, and owner evidence
   - Add production health panels for Netlify, Supabase, Edge Functions, transaction verification, and public execution gates.
   - Add owner-safe support copy and debugging states without exposing raw wallet internals, Telegram tokens, provider payloads, or secrets.
   - Keep public analytics aggregated and privacy-preserving.
5. Public privacy and release gate
   - Audit landing page, public agent profiles, Telegram responses, dashboard copy, logs, docs, and Edge Function errors.
   - Confirm no public surface can display wallet addresses beyond owner-approved display, token refs, session ids, internal ids, provider payload refs, transaction intent internals, or raw error details.
   - Phase 9 can close only after the public execution hardening checks pass and Phase 10 release readiness can start.

Status: structurally complete; runtime default-off. Phase 10 release readiness can start.

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

Status: active; Batch 10C launch QA and production health evidence in progress.

Phase 10 batches:

- 10A - Public product copy and UX final
- 10B - Support operations and operator runbook
- 10C - Launch QA and production health evidence
- 10D - Final security and privacy audit
- 10E - Release decision and closeout

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
- Phase 8 implementation is closed for the controlled live transaction path.
- Phase 9 public execution hardening is structurally complete; Phase 10 release readiness can start.

After Phase 8 closeout, keep these checks green before Phase 9 public hardening:

- `npm run check:roadmap`
- `npm run check:pre-base-mcp`
- `npm run check:execution-launch-readiness`
- `npm run check:phase-7`
- `npm run build`
- `git diff --check`

Do not enable wallet signing or transaction submission merely because the
connection path exists. Each gate remains separate.

Wallet signing, token approval, swaps, transfers, contract calls, and public
execution remain disabled until their separate owner-approved gates are
implemented and verified. Phase 8 Batch 4 models owner-only controlled
submission and sanitized transaction hash references.

Batch 10 evidence:

- runtime enablement preflight added for the owner-dashboard submitter
- runtime flag, owner session, selected deployed agent, Base Account, controlled submission, and owner live-window activation must all pass together
- result closeout locks runtime submitter after a provider-submitted hash reference exists
- Telegram and public profile execution authority remain blocked
- `src/types/phase8RuntimeEnablementPreflight.ts`
- `scripts/test-phase-8-runtime-enable-preflight.mjs`
- `scripts/check-phase-8-runtime-enable-preflight.mjs`
- `npm run check:phase-8-runtime-preflight`

Batch 11 evidence:

- Base ETH gas readiness guard added to the owner-dashboard submitter
- submitter reads only the connected owner Base Account native ETH balance on Base
- submit button stays locked when the balance is unavailable or zero
- owner-facing copy explains that zero-value transactions still require ETH for gas
- Telegram, public profiles, token approvals, swaps, calldata, and non-zero value remain blocked
Batch 12 evidence:

- owner-only submitter closeout helper added for provider-submitted hashes
- closeout requires owner, workspace, agent, prepared action, and submission nonce scope
- invalid transaction hashes are rejected before closeout is recorded
- Dashboard passes the active owner-window submission nonce into the isolated submitter
- `npm run check:phase-8-submitter` covers the closeout helper

Batch 13 evidence:

- owner-only result persistence helper added for submitted, confirmed, and failed events
- result persistence requires owner, workspace, agent, prepared action, submission nonce, sanitized event, and valid transaction hash
- browser-session scoped owner result store added until reviewed Supabase write path is approved
- Dashboard merges persisted Phase 8 owner results into the owner-only execution result list
- public surfaces are checked to exclude Phase 8 owner result persistence
- `src/types/phase8ResultPersistence.ts`
- `src/services/phase8ResultPersistenceStore.ts`
- `scripts/test-phase-8-result-persistence.mjs`
- `scripts/check-phase-8-result-persistence.mjs`


Batch 14 evidence:

- owner-facing funding readiness model added for Base ETH gas requirements
- controlled submitter now uses `evaluatePhase8FundingReadiness` before opening the submit prompt
- empty, unavailable, checking, missing wallet, and missing address states stay blocked
- funding guide clarifies that only native Base ETH on the connected Base Account is needed for gas
- funding copy explicitly rejects seed phrase, private-key, Telegram, public profile, token approval, swap, calldata, and non-zero value paths
- `src/types/phase8FundingReadiness.ts`
- `scripts/test-phase-8-funding-readiness.mjs`
- `scripts/check-phase-8-funding-readiness.mjs`

Batch 15 evidence:

- owner-only controlled smoke closeout model added for not started, submitted, confirmed, failed, and aborted states
- submitted, confirmed, and failed states require valid transaction hash evidence
- confirmed closeout requires provider confirmation data
- failed closeout requires sanitized failure reason
- aborted closeout can safely close before provider submission
- dashboard shows owner-only smoke closeout status and next-gate readiness
- public surfaces and Telegram webhook code are checked to exclude smoke closeout authority
- `src/types/phase8SmokeCloseout.ts`
- `scripts/test-phase-8-smoke-closeout.mjs`
- `scripts/check-phase-8-smoke-closeout.mjs`
Batch 16 evidence:

- owner-only user-safe transaction policy added for controlled live transaction expansion
- policy requires signed-in owner, private dashboard, selected agent, Base Account, Base chain, and prepared action scope
- max transaction value remains `0` wei until the next explicit expansion gate
- calldata, token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- dashboard shows policy status before broader transaction rollout
- public surfaces and Telegram webhook code are checked to exclude user-safe transaction policy authority
- `src/types/phase8UserSafeTransactionPolicy.ts`
- `scripts/test-phase-8-user-safe-transaction-policy.mjs`
- `scripts/check-phase-8-user-safe-transaction-policy.mjs`
Batch 17 evidence:

- low-value transaction readiness model added for first owner-reviewed value-bearing expansion
- max low-value cap is `0.0001 ETH` (`100000000000000` wei)
- required balance is modeled as requested value plus estimated Base gas fee
- signed-in owner, private dashboard, selected agent, Base Account, Base chain, prepared action, and owner approval are required
- calldata, token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- dashboard shows low-value readiness separately from the current zero-value submitter
- public surfaces and Telegram webhook code are checked to exclude low-value readiness authority
- `src/types/phase8LowValueTransactionReadiness.ts`
- `scripts/test-phase-8-low-value-transaction-readiness.mjs`
- `scripts/check-phase-8-low-value-transaction-readiness.mjs`
Batch 18 evidence:

- owner-only low-value submit request skeleton added for first value-bearing transaction preparation
- request requires owner scope, private dashboard, Base Account, Base chain, prepared action, and explicit owner approval
- value must be positive and capped at `0.0001 ETH` (`100000000000000` wei)
- request uses `0x` calldata only and remains owner-only
- token approvals, swaps, Telegram requests, and public profile triggers remain blocked
- dashboard shows request skeleton separately from the current zero-value submitter and low-value readiness panel
- public surfaces and Telegram webhook code are checked to exclude low-value submit request authority
- `src/types/phase8LowValueSubmitRequest.ts`
- `scripts/test-phase-8-low-value-submit-request.mjs`
- `scripts/check-phase-8-low-value-submit-request.mjs`
Batch 19 evidence:

- isolated low-value submitter component added separately from the zero-value controlled submitter
- dedicated runtime flag `VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=owner_low_value_window` defaults disabled
- submit gate requires owner wallet connection, armed owner window, no prior result, low-value readiness, and valid low-value request skeleton
- successful provider handoff records owner-only closeout evidence through the existing sanitized result path
- Telegram, public profiles, token approvals, swaps, arbitrary calldata, seed phrases, and private keys remain blocked
- public surfaces and Telegram webhook code are checked to exclude low-value submitter authority
- `src/components/Phase8LowValueSubmitter.tsx`
- `scripts/test-phase-8-low-value-submitter-gate.mjs`
- `scripts/check-phase-8-low-value-submitter-gate.mjs`
Batch 20 evidence:

- live Base ETH balance is wired into the low-value transaction readiness gate
- owner dashboard no longer feeds a null balance into low-value readiness
- dashboard shows live Base balance and gas/value source before submitter activation
- balance remains browser-session scoped and is not stored publicly
- Telegram and public surfaces are checked to exclude Batch 20 balance authority
- `src/pages/Dashboard.tsx`
- `scripts/check-phase-8-low-value-balance-gas-readiness.mjs`
- `npm run check:phase-8-low-value-balance-gas`

Phase 8 closeout path after Batch 20 used this working peg:

- Batch 20 - live balance and gas readiness
- Batch 21 - first controlled low-value live run
- Batch 22 - transaction result verification
- Batch 23 - user-facing execution flow
- Batch 24 - security and abuse hardening
- Batch 25 - Phase 8 production closeout

Batch 21 evidence:

- first controlled low-value live-run boundary added to the isolated low-value submitter
- submitter requires complete closeout scope before opening Base Account
- stale submitted hash state is cleared before each attempt
- successful low-value handoff records owner-only sanitized hash evidence
- private dashboard masks the submitted transaction hash
- Telegram and public surfaces are checked to exclude low-value live-run authority
- `src/components/Phase8LowValueSubmitter.tsx`
- `src/pages/Dashboard.tsx`
- `scripts/check-phase-8-low-value-live-run.mjs`
- `npm run check:phase-8-low-value-live-run`

Batch 22 evidence:

- owner-only transaction verification model added after low-value provider handoff
- dashboard waits for the Base transaction receipt before confirming the result
- reverted or unavailable receipts close with sanitized owner-only failure evidence
- result monitoring and smoke closeout now promote confirmed status from verified receipt state
- Telegram and public surfaces are checked to exclude transaction verification authority
- `src/types/phase8TransactionVerification.ts`
- `scripts/test-phase-8-transaction-verification.mjs`
- `scripts/check-phase-8-transaction-verification.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-transaction-verification`

Batch 23 evidence:

- owner-facing execution flow model added on top of existing private dashboard gates
- dashboard shows session, agent, Base Account, prepared action, owner approval, submitter, receipt verification, and closeout as one product flow
- active step and blocked reasons are derived from existing owner-only state only
- failed or blocked states remain sanitized and owner-dashboard scoped
- Telegram and public surfaces are checked to exclude user execution flow authority
- `src/types/phase8UserExecutionFlow.ts`
- `scripts/test-phase-8-user-execution-flow.mjs`
- `scripts/check-phase-8-user-execution-flow.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-user-execution-flow`

Batch 24 evidence:

- security and abuse hardening model added around the controlled low-value submitter
- replay and double-submit attempts are blocked by used nonce or recorded result state
- owner scope, runtime enablement, Kyra approval, low-value request readiness, and sanitized failure handling are explicit controls
- transaction shape remains low-value ETH only with no calldata, token approval, or swap path
- private dashboard shows the owner-only hardening panel before the submitter
- submitter requires the hardening guard before opening Base Account
- Telegram and public surfaces are checked to exclude security hardening authority
- `src/types/phase8SecurityAbuseHardening.ts`
- `scripts/test-phase-8-security-abuse-hardening.mjs`
- `scripts/check-phase-8-security-abuse-hardening.mjs`
- `src/pages/Dashboard.tsx`
- `src/components/Phase8LowValueSubmitter.tsx`
- `src/styles.css`
- `npm run check:phase-8-security-abuse-hardening`

Batch 25 evidence:

- production closeout model added for Phase 8 final state
- ready-for-owner-run status distinguishes implementation closeout from a confirmed transaction receipt
- confirmed complete status requires Base receipt verification and owner-only closeout
- failed or pending receipt states cannot fake completion
- dashboard shows owner-only Phase 8 production closeout status
- Phase 9 remains responsible for public execution hardening and wider eligibility
- Telegram and public surfaces are checked to exclude production closeout authority
- `src/types/phase8ProductionCloseout.ts`
- `scripts/test-phase-8-production-closeout.mjs`
- `scripts/check-phase-8-production-closeout.mjs`
- `src/pages/Dashboard.tsx`
- `src/styles.css`
- `npm run check:phase-8-production-closeout`

Phase 8 closeout decision:

- Phase 8 implementation is closed for the controlled owner-only transaction path.
- GitHub `main` has been pushed with the Phase 8 closeout commits.
- Netlify production is live at `https://kyraagent.xyz`; `/` and `/dashboard` returned `200 OK`.
- Supabase project `Kyra Agent` is `ACTIVE_HEALTHY`, and the deployment, Telegram, and Base MCP preparation/status Edge Functions are active.
- Owner manual smoke test was completed after deploy: website navigation, dashboard, Base Account connect/disconnect, existing deployed-agent flow, and Telegram read-only refusal were reported safe.
- A funded owner wallet can run the controlled low-value path under the existing owner, Kyra approval, Base Account approval, receipt verification, and owner-only closeout gates.
- Low-value live transaction receipt proof remains pending until the owner wallet is funded and the owner intentionally runs the controlled low-value path.
- Public execution, multi-user execution eligibility, incident controls, abuse controls, and wider transaction classes remain Phase 9.
