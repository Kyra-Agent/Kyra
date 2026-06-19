# Phase 6 Closeout Audit

Date: 2026-06-18

Canonical roadmap:

- `docs/product-phase-roadmap.md`

Status: pushed live hardening complete. Phase 6 prepares Kyra for
wallet-approved Base actions, but production wallet execution is still
intentionally disabled.

Status classification: foundation complete, not live execution.

## Closeout Position

Phase 6 is complete as a safety-first product foundation:

- Wallet readiness is represented in the owner dashboard.
- Wallet policy and approval state are visible.
- Prepared action preview exists as a bounded model and read-only product
  surface.
- NYX-05 risk review classifies supported, risky, and blocked actions.
- Wallet signing handoff is modeled, but no live wallet prompt is opened.
- Execution result states are modeled without storing a transaction hash before
  user submission.
- Telegram execution intent is classified and refused safely.
- Owner dashboard reads for sensitive tables are column-scoped.
- Activity log messages are sanitized before deploy writes and before dashboard
  display.
- Operator/swap deploy scenarios stay approval-required.

This is not a live arbitrary execution release. It is a reviewed execution
foundation that keeps wallet approval, Base MCP enablement, and production
transaction submission behind explicit future gates.

## Security Decisions

User privacy is the primary product constraint.

Crown jewels:

- User wallet security.
- User Telegram bot token security.

Closeout rules:

- No private keys or seed phrases are accepted.
- No custody path exists.
- Telegram cannot create wallet prompts, signatures, Base MCP calls, prepared
  action database writes, or transaction submissions.
- Prepared action database writes remain disabled until owner-scoped records,
  RLS, replay protection, and verifier SQL are approved.
- Public profiles stay free of wallet-sensitive and transaction-preparation
  payloads.
- Owner dashboard queries do not use broad `select=*` reads for agent
  instances, wallet policies, approval requests, or activity logs.
- Transaction hashes are accepted only after a user-submitted wallet
  transaction.
- Base MCP runtime preparation remains default-off.
- Wallet provider dependencies are installed but isolated behind disabled
  runtime gates.
- Runtime Edge Function logs stay free of unreviewed `console.*` calls.
- Raw provider, wallet, MCP, and backend errors collapse to sanitized user
  messages.
- Activity log text is sanitized at both backend write and frontend read
  boundaries.

## Implemented Boundaries

### Wallet Readiness

- Owner dashboard can show wallet readiness state.
- Wallet labels and shortened addresses are owner-only dashboard data.
- Signed-out and no-agent states do not show private wallet data.
- Public routes do not expose wallet policy or prepared transaction data.

### Approval Policy

- `wallet_policies` is read through column-scoped owner dashboard queries.
- Approval-required behavior remains the default.
- Policy updates are not exposed through Telegram.
- Telegram cannot bypass owner approval.

### Base MCP Preparation

- The first reviewed candidate remains `base_mcp_status_check`.
- Base MCP function skeleton is backend-only and default-off.
- Runtime enablement requires an explicit environment gate.
- Static checks block frontend and Telegram references to the preparation
  endpoint.
- No transaction signing or submission is attached to the Base MCP skeleton.

### Prepared Action Contract

- Prepared action payloads are typed, bounded, expiring, and owner-scoped by
  design.
- Browser/public/Telegram boundaries are checked by scripts.
- Storage SQL remains a reviewed packet, not an applied production write path.
- Prepared action storage forbids wallet address, Telegram token refs, private
  keys, seed phrases, raw calldata, and provider payload references.

### Risk Review

- NYX-05 separates read-only, low, medium, high, and blocked action classes.
- Unknown or unsupported action types fail closed.
- Review copy names risk, route, permissions, expiry, and approval state before
  any future signing handoff.

### Wallet Signing Handoff

- Wagmi/Viem is the reviewed first provider path.
- Provider dependencies are installed but gated.
- Wallet prompts require an owner click and stay disabled in the current
  runtime.
- The connected wallet pays gas in the handoff model.
- User rejection and network mismatch have clean state transitions.

### Execution Result Trail

- Pending, approved, rejected, submitted, failed, and confirmed states are
  modeled.
- Transaction hash is blocked before submission.
- Failure reasons are sanitized.
- Execution results stay owner-only.

### Telegram Execution Gate

- Telegram remains read-only.
- Direct swaps, transfers, approvals, and onchain execution are refused.
- Owner execution intent is classification only.
- `canExecuteFromTelegram` stays `false`.
- `canCreateDraftNow` stays `false`.
- No Telegram-created approval draft is persisted.

## Verification

Closeout verification passed before push and live smoke:

- `git status --short`
- `npm run check:phase-6`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`
- local dashboard smoke
- local Telegram refusal smoke
- live `https://kyraagent.xyz` and `/dashboard` HTTP smoke
- live bundle marker check for sanitizer coverage, approval-required operator
  swap behavior, and absence of broad `select=*` owner dashboard reads

The local Telegram refusal smoke is covered by the execution gate and
read-only pipeline tests. The dashboard smoke confirms the product route loads
locally without enabling wallet prompts or transaction submission.

The latest hardening added regression checks for:

- no `agent_instances?select=*` owner dashboard read
- no `activity_logs?select=*` owner dashboard read
- activity log sanitizer present before deploy insert and dashboard display
- operator/swap deploy scenario remains approval-required

## Still Gated For Future Approval

These are intentionally not live at Phase 6 closeout:

- Applying prepared action storage SQL to production.
- Writing Telegram-created approval drafts.
- Enabling Base MCP preparation in runtime.
- Connecting Base MCP preparation to production storage.
- Opening real wallet prompts.
- Signing or submitting transactions.
- Arbitrary swaps, transfers, or contract calls.
- Public viewer-triggered actions.
- Autonomous trading or campaign execution.

## Next Phase Entry Criteria

Before any future live execution work:

- Start from `docs/phase-7-pre-execution-audit.md`.
- Re-run the full Phase 6 check suite.
- Run `npm run check:phase-7-entry`.
- Review RLS and ownership rules for every write path.
- Verify Telegram bot tokens remain backend-only.
- Verify public routes still hide wallet-sensitive fields.
- Apply storage SQL only after verifier and rollback are reviewed.
- Enable one narrow action path first.
- Require explicit owner approval and wallet confirmation.
- Run live smoke with a low-risk test account only.

Phase 7 product completion must follow the canonical deployed-agent flow:
connect the owner's Base Account, authorize official Base MCP for the selected
agent, prepare and review one action, collect Kyra approval, collect Base
Account approval, submit from the user's account, and record the sanitized
result.
