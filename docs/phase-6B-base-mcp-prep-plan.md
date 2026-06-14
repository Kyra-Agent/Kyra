# Phase 6B Base MCP Preparation Plan

Phase 6B goal: audit and define the first safe Base MCP preparation path without
signing or submitting transactions.

Primary rule: user privacy, wallet security, and Telegram bot token security are
number one. Prepared action data should be minimized, owner-scoped, and excluded
from public surfaces by default.

## Outcome

At the end of 6B, Kyra should know exactly which Base MCP action can be prepared
first, what payload it returns, and how that payload will be shown to the owner
before wallet signing.

6B should not enable live transaction submission.

## Source Audit

Audit artifact: `docs/phase-6B-base-mcp-audit.md`

Adapter contract: `docs/phase-6B-base-mcp-adapter-contract.md`

Default-off function skeleton: `supabase/functions/base-mcp-prepare/`

Start by reading these areas:

- `src/config/appConfig.ts`
- `src/components/ActionConsole.tsx`
- `src/components/WalletApprovalModal.tsx`
- `src/data/actions.ts`
- `src/data/demoScenarios.ts`
- `src/types/agent.ts`
- `src/types/backend.ts`
- `src/types/database.ts`
- `supabase/schema.sql`
- `docs/backend-blueprint.md`
- `docs/phase-6-wallet-base-checklist.md`

Search targets:

- `Base MCP`
- `base_mcp`
- `wallet`
- `approval`
- `prepared_tx`
- `tx_hash`
- `requires_wallet`

Questions to answer:

- What Base MCP endpoint/config exists today?
- Is Base MCP currently only copy/config, or is there a callable adapter?
- What action type is safest to prepare first?
- What data must the owner see before signing?
- What data must never be public?
- Which errors should be sanitized?

## First Candidate Rules

Prefer the smallest safe candidate:

1. Read-only Base MCP health/status if available.
2. Quote-like or preparation-only action if available.
3. Prepared transaction preview without wallet prompt.
4. Wallet prompt only after 6C approval/signing handoff.

Do not start with:

- arbitrary swaps
- arbitrary transfers
- arbitrary contract calls
- Telegram-triggered execution
- autonomous trading

## Prepared Action Contract Draft

The first prepared action should include:

- action id
- agent id
- owner/workspace scope
- action kind
- target chain
- target address or route summary
- value summary
- calldata summary or opaque backend reference
- risk level
- expiry time
- status
- created timestamp

Possible statuses:

- `draft`
- `preparing`
- `prepared`
- `review_required`
- `approved`
- `rejected`
- `expired`
- `failed`

## UI Requirements

Prepared action preview should show:

- action name
- chain/network
- target/route summary
- estimated value or spend summary
- risk level
- approval requirement
- expiry
- reject/cancel option

It should not show:

- raw private data
- confusing hex-only transaction payload as the primary UX
- success copy before wallet signing/submission

## Backend/Data Requirements

- Prefer opaque backend references over exposing raw transaction details when a
  summary is enough for the UI.
- Keep wallet-sensitive and Telegram-token-sensitive data out of public routes,
  browser logs, and user-facing errors.
- Store prepared actions owner-scoped.
- Do not expose prepared transaction payloads on public profiles.
- Keep raw provider/MCP errors out of UI.
- Add expiry/replay protection before signing.
- Fail closed for unknown action kinds.

## Tests And Verification

- [x] MCP config audit completed.
- [x] First action candidate selected.
- [x] Prepared action shape documented or typed.
- [x] Adapter contract documented.
- [x] Backend-only default-off prepare function skeleton added.
- [x] Unsupported action kind fails closed.
- [x] Unsupported action kind never reaches ownership lookup or adapter call.
- [x] Adapter errors are sanitized before user-facing responses.
- [x] Public profile cannot read prepared tx data.
- [x] Dashboard preview shows safe summary.
- [x] Telegram direct execution still refused.
- [x] `npm run check:base-mcp`
- [x] `npm run check:privacy`
- [x] `npm run check:functions`
- [x] `deno test supabase/functions/base-mcp-prepare/index_test.ts`
- [x] Targeted Deno read-only Telegram tests
- [x] `npm run build`
- [x] `git diff --check`
- [x] Local desktop/mobile dashboard smoke

## Done Criteria

- Prepared action privacy boundaries are explicit.
- Wallet and Telegram token security boundaries remain explicit.
- Base MCP preparation target is clear.
- Prepared action contract is bounded.
- Owner review UI requirements are clear.
- No signing or submission is enabled yet.
- Phase 6C can start with a reviewed prepared-action foundation.
