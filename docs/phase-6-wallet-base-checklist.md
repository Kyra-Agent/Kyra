# Phase 6 Wallet And Base MCP Checklist

Phase 6 goal: connect Kyra's execution layer safely without weakening the Phase
5 Telegram read-only boundary.

## Product Objective

Move Kyra from read-only Telegram + LLM planning into wallet-approved Base
action preparation.

Kyra should be able to prepare an action, show the risk and transaction context,
and ask the user's wallet for approval. Kyra must not custody keys, bypass
wallet approval, or execute hidden transactions.

Primary rule: user privacy and security are the first priority. Every Phase 6
decision should prefer less exposure, less persistence, and narrower access when
there is any uncertainty.

Crown jewels:

- User wallet security.
- User Telegram bot token security.

These two areas must stay protected even if it slows down product velocity.

## Phase 6 Targets

Primary target:

- Kyra can prepare a Base action and hand it to the user's connected wallet for
  explicit approval without custody or hidden execution.

Product targets:

- Dashboard shows wallet readiness clearly.
- Dashboard shows approval policy clearly.
- Dashboard can show a prepared action preview before signing.
- Owner can approve, reject, or cancel an action from the product surface.
- Execution state is visible after wallet interaction.
- Telegram remains read-only unless an execution request is converted into a
  dashboard/wallet approval draft.

Technical targets:

- Wallet connection state is represented safely in frontend and backend models.
- Approval policy gates every execution path.
- Base MCP preparation is isolated behind a narrow adapter.
- Prepared action payloads are typed, bounded, expiring, and owner-scoped.
- Risk review is explicit before signing.
- Transaction hash is stored only after user submission.
- Failure states are sanitized and recoverable.

Security targets:

- User wallet security stays first-class.
- User Telegram bot token security stays first-class.
- No private key or seed phrase path exists.
- No Telegram message can directly execute a transaction.
- No public route exposes wallet-sensitive data.
- No raw provider, wallet, MCP, or backend error leaks to users.
- Unsupported action requests fail closed.
- BotFather tokens remain backend-only and never appear in browser storage,
  logs, public profiles, screenshots, or API responses.
- Local privacy checks scan public source/docs for raw BotFather tokens,
  OpenRouter keys, PEM private keys, and raw 32-byte private-key-shaped values.

Launch target:

- Phase 6 should end with one narrow, reviewed wallet-approved Base action path,
  not broad arbitrary execution.

## Phase 6 Non-Targets

Do not attempt these in the first Phase 6 pass:

- Arbitrary token swaps from Telegram.
- Arbitrary transfers.
- Arbitrary contract calls.
- Autonomous trading.
- Multi-wallet routing.
- Public viewer-triggered actions.
- Token launch claims or financial claims.
- Removing the Phase 5 read-only Telegram boundary.

## Milestone Plan

Detailed sub-plans:

- `docs/phase-6A-wallet-readiness-plan.md`
- `docs/phase-6B-base-mcp-prep-plan.md`
- `docs/phase-6B-review-packet.md`
- `docs/phase-6C-wallet-provider-decision.md`
- `docs/phase-6C-wallet-signing-handoff-audit.md`
- `docs/phase-6C-wallet-signing-handoff-plan.md`
- `docs/phase-6-risk-permission-review.md`
- `docs/phase-6-execution-result-logging.md`
- `docs/phase-6-telegram-execution-gate.md`
- `docs/phase-6-closeout-audit.md`

### Milestone 6A - Wallet Readiness

- Wallet connection/readiness state is visible.
- Wallet policy is visible.
- No signing or Base MCP execution yet.

Target result:

- The product can say whether an owner is ready for wallet-approved execution.

### Milestone 6B - Prepared Action Preview

- Base MCP capability is audited.
- One narrow action candidate is selected.
- Prepared action preview can be shown without signing.

Target result:

- Kyra can prepare and display an action safely before asking the wallet.
- Local review packet confirms provider/storage drafts stay unwired until
  explicit approval.

### Milestone 6C - Approval And Signing Handoff

- Owner explicitly approves or rejects the prepared action.
- Wallet prompt is user-initiated.
- User rejection and network mismatch are handled cleanly.
- Audit and plan are documented before any provider dependency is added.

Target result:

- Kyra can hand off a prepared action to the user's wallet without custody.

### Milestone 6D - Execution State And Audit Trail

- Submitted/failed/confirmed states are modeled and validated.
- Dashboard reflects the owner-only execution result trail.
- Public profile stays share-safe.

Target result:

- Every execution attempt has a clean, inspectable state trail.

### Milestone 6E - Telegram Execution Gate Design

- Telegram still refuses direct swaps/transfers.
- Telegram can optionally create a read-only approval draft only after the
  dashboard/wallet path is safe.

Target result:

- Telegram cannot bypass wallet approval.

## Non-Negotiable Boundaries

- User privacy is number one.
- User wallet security is number one.
- User Telegram bot token security is number one.
- No seed phrases.
- No private keys.
- No wallet custody.
- No hidden transaction execution.
- No Telegram-triggered execution until wallet approval policy is reviewed.
- No Base MCP transaction path without simulation, review, and explicit
  approval.
- No production gate enablement before local tests and live smoke are done.

## Phase 6 Flow

1. Wallet connection model.
2. Wallet policy and approval boundary.
3. Base MCP capability audit.
4. Prepared action contract.
5. Risk and permission review.
6. User wallet signing handoff.
7. Execution result logging.
8. Telegram execution-gate design.

## Step 1 - Wallet Connection Model

- [x] Audit current wallet UI and data model.
- [x] Confirm which wallet provider path will be used first.
- [x] Define connected wallet display fields.
- [x] Keep wallet address out of public profiles unless explicitly share-safe.
- [x] Confirm disconnect behavior.
- [x] Confirm signed-out behavior.
- [x] Add tests for wallet connection state if implementation changes.

Definition of done:

- The app can represent wallet connection state without storing private
  material.
- The dashboard can show safe wallet readiness state.
- Public pages do not leak private wallet details.

## Step 2 - Wallet Policy And Approval Boundary

- [x] Audit existing `wallet_policies` table usage.
- [x] Define allowed action categories.
- [x] Define approval-required behavior.
- [x] Define daily limit display and enforcement boundary.
- [x] Define rejected/expired approval states.
- [x] Confirm policy updates require authenticated owner context.
- [x] Confirm Telegram cannot bypass policy.

Definition of done:

- Kyra has a clear policy contract before any Base action is prepared.
- Approval states are explicit and auditable.

## Step 3 - Base MCP Capability Audit

- [x] Inspect current Base MCP config and references.
- [x] Confirm the target Base MCP endpoint and supported actions.
- [x] Identify which action should be first live candidate.
- [x] Define request/response shape for MCP preparation.
- [x] Define timeout and failure behavior.
- [x] Define sanitized error messages.
- [x] Confirm no secrets are exposed to frontend or Telegram for the current
      default-off skeleton.

Definition of done:

- We know exactly what Base MCP can prepare first and what remains out of scope.

Current contract:

- `docs/phase-6B-base-mcp-adapter-contract.md`
- `docs/phase-6B-prepared-action-read-model.md`
- first candidate: `base_mcp_status_check`
- allowed action kinds: `base_mcp_status_check` only
- runtime gates default off
- backend-only function skeleton: `supabase/functions/base-mcp-prepare/`
- disabled response occurs before body, env, session, ownership, service-role,
  or adapter access
- static guards block frontend and Telegram references to the prepare endpoint
  or backend secrets
- runtime enablement requires exact `KYRA_BASE_MCP_PREP_ENABLED=true`
- no wallet signing or transaction submission

## Step 4 - Prepared Action Contract

- [x] Define a prepared action payload type.
- [x] Include action kind, chain, route summary, value summary, and risk.
- [x] Keep prepared payload storage disabled until owner-scoped backend records
      are approved.
- [x] Keep public profile free of prepared transaction data.
- [x] Add replay/expiry fields.
- [x] Add idempotency key or claim strategy if needed.
- [x] Add tests for malformed payloads.
- [x] Add local boundary checks for dashboard/public/Telegram prepared-action
      exposure.
- [x] Draft comment-only owner-scoped storage and idempotency design.
- [x] Draft forward/rollback/verifier SQL review packet without applying it.

Definition of done:

- Prepared actions are structured, bounded, expiring, and owner-scoped.

## Step 5 - Risk And Permission Review

- [x] Define NYX-05 risk gate role.
- [x] Classify read-only/low/medium/high/blocked risk actions.
- [x] Require explicit approval for signable and risky actions.
- [x] Display route, chain, value, expiry, permissions, and risk before signing.
- [x] Refuse unknown or unsupported action types.
- [x] Add safety copy for failed or risky preparation.
- [x] Add tests for risk classification.

Definition of done:

- Users see what they are approving before wallet signing.
- Unsupported action types fail closed.

## Step 6 - User Wallet Signing Handoff

- [x] Audit current signing/wallet handoff surface.
- [x] Define Phase 6C implementation order.
- [x] Confirm current app has no wallet provider signing path.
- [x] Confirm wallet prompts must be user-initiated.
- [x] Confirm Kyra does not sign on behalf of the user.
- [x] Choose first wallet provider path.
- [x] Install wallet provider dependencies after approval.
- [x] Add disabled wallet provider boundary without wallet prompts.
- [x] Add read-only wallet provider status UI.
- [x] Add UI-only wallet signing state model.
- [x] Surface wallet signing state in demo review UI without provider calls.
- [x] Surface unsigned handoff validation in demo review UI without provider
      calls.
- [x] Define unsigned transaction handoff.
- [x] Confirm user pays gas.
- [x] Handle user rejection cleanly.
- [x] Handle wallet/network mismatch cleanly.
- [x] Add tests around signing state transitions where practical.
- [x] Add tests around unsigned handoff validation.

Definition of done:

- Kyra can hand off a prepared action to the user's wallet without custody.

## Step 7 - Execution Result Logging

- [x] Store pending, approved, rejected, submitted, failed, and confirmed
      states.
- [x] Store transaction hash only after submission.
- [x] Store sanitized failure reason.
- [x] Show result in dashboard activity.
- [x] Keep public profile display bounded and share-safe.
- [x] Add rollback/retry rules.

Definition of done:

- Every execution attempt has an auditable state trail.

## Step 8 - Telegram Execution Gate Design

- [x] Keep Phase 5 Telegram read-only behavior unchanged first.
- [x] Define which Telegram messages can create an approval draft.
- [x] Require dashboard or wallet approval before any execution.
- [x] Refuse direct Telegram swaps/transfers until reviewed.
- [x] Add command-level replay protection.
- [x] Add abuse/rate limits.
- [x] Smoke test refusal behavior after execution gates are added.

Definition of done:

- Telegram can never directly execute a wallet or onchain action without the
  approved wallet flow.

Current boundary:

- `approval_draft_candidate` is classification only.
- `canExecuteFromTelegram` and `canCreateDraftNow` stay `false`.
- No Telegram-created approval record, prepared action, wallet prompt, Base MCP
  call, signing, or transaction submission is enabled.

## Suggested First Live Candidate

Start with the smallest safe action:

- Read-only Base MCP status or quote-like preparation, if available.
- Then a prepared transaction preview without signing.
- Then wallet prompt behind explicit owner action.

Do not start Phase 6 with arbitrary swaps, transfers, or contract calls.

## Acceptance Tests

Phase 6 is not done until these user-facing checks pass:

- Signed-out user cannot prepare or approve an action.
- Wrong workspace owner cannot see or approve another owner's prepared action.
- Connected owner can see wallet readiness.
- Owner can see action summary before signing.
- Owner can reject action without side effects.
- Wallet/network mismatch produces a clean failure state.
- Unsupported Telegram execution request is refused.
- Unsupported dashboard execution request fails closed.
- Public agent page does not expose prepared transaction data.
- Activity log shows the final action state without leaking raw sensitive data.

## Verification Gate

Before any push/deploy:

- [x] `git status --short`
- [x] `npm run check:phase-6`
- [x] `npm run check:functions`
- [x] relevant Deno tests
- [x] `npm run build`
- [x] `git diff --check`
- [x] manual dashboard smoke
- [x] manual Telegram refusal smoke

Before enabling production gates:

- [x] Confirm no private keys or seed phrases are accepted.
- [x] Confirm Telegram bot tokens remain backend-only and are never exposed.
- [x] Confirm no secret values appear in logs or UI.
- [x] Add raw secret pattern scanning to `npm run check:privacy`.
- [x] Block unreviewed `console.*` logging from runtime Edge Function code.
- [x] Broaden Telegram unsafe intent classification for wallet/onchain verbs.
- [x] Keep prepared-action browser reads column-scoped to owner-summary fields.
- [x] Keep wallet provider package imports isolated to the gated runtime
      provider.
- [x] Keep the wallet dependency set on the reviewed Wagmi/Viem path.
- [x] Keep demo UI copy from implying live wallet or onchain execution.
- [x] Audit Supabase template catalog copy against the safety-reviewed local
      catalog.
- [x] Prepare reviewed SQL to clean stale production template catalog rows.
- [x] Confirm unsupported execution requests fail closed.
- [x] Confirm wallet approval is required.
- [x] Confirm transaction details are visible before signing.
- [x] Confirm user rejection is handled cleanly.
- [x] Confirm transaction hash is blocked before submission.
- [x] Confirm execution results stay owner-only.

## Phase 6 Done Criteria

- User privacy is preserved across dashboard, Telegram, public profiles, logs,
  and backend records.
- User wallet security and Telegram bot token security remain protected.
- Wallet connection state is represented safely.
- Approval policy is enforced before execution.
- Base MCP preparation is bounded and tested.
- Prepared action review is visible to the owner.
- Wallet signing remains user-controlled.
- Execution results are logged.
- Telegram remains safe and cannot bypass wallet approval.
