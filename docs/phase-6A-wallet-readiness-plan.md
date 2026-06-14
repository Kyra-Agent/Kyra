# Phase 6A Wallet Readiness Plan

Phase 6A goal: make Kyra accurately represent wallet readiness before any Base
MCP preparation or signing path is enabled.

Primary rule: user privacy and wallet security are number one. Wallet readiness
must reveal only what the owner needs to see and nothing extra.

## Outcome

At the end of 6A, the dashboard should clearly answer:

- Is a wallet connected?
- Which wallet address is safely visible to the owner?
- Is the wallet on the expected network?
- Is wallet-approved execution still disabled, ready, or blocked?
- What policy would gate future actions?

6A should not submit transactions, sign messages for execution, or call Base
MCP.

## Source Audit

Audit artifact: `docs/phase-6A-wallet-readiness-audit.md`

Start by reading these areas:

- `src/components/WalletApprovalModal.tsx`
- `src/components/ActionConsole.tsx`
- `src/pages/Dashboard.tsx`
- `src/types/backend.ts`
- `src/types/database.ts`
- `src/data/demoBackend.ts`
- `src/services/supabaseDashboardService.ts`
- `supabase/schema.sql`
- `supabase/seed.sql`

Questions to answer:

- Where is wallet policy displayed today?
- Is wallet address currently modeled as real, mock, or nullable?
- Which UI copy still implies simulation only?
- Which backend fields already exist for future wallet state?
- Which fields are safe for private dashboard only?
- Which fields must never appear on public profiles?

## Implementation Slice

Recommended first implementation slice:

1. Add or refine wallet readiness state in the dashboard model.
2. Show readiness as one of:
   - `not_connected`
   - `connected_wrong_network`
   - `connected_ready_for_approval`
   - `execution_disabled`
3. Keep public agent profiles share-safe.
4. Keep Telegram policy copy read-only.
5. Add tests or focused assertions where the existing test setup allows.

## UI Requirements

Dashboard wallet panel should show:

- wallet connection status
- safe shortened address when available
- network readiness
- approval policy status
- execution boundary
- next required action

Copy rules:

- Say "wallet approval required", not "Kyra controls wallet".
- Say "execution gated", not "execution live", until Phase 6C/6D proves it.
- Do not show seed phrase, private key, or raw signing payload language.

## Backend/Data Requirements

- Prefer minimum necessary wallet data.
- Treat wallet security as a first-class product requirement, not an add-on.
- Do not store private keys.
- Do not store seed phrases.
- Treat wallet address as owner-private unless intentionally made share-safe.
- Keep public profile output free of wallet-sensitive fields.
- Keep approval policy owner-scoped.
- Do not add write privileges for browser clients unless separately reviewed.

## Tests And Verification

- [x] Current wallet UI and data model audited.
- [x] Public profile data boundary audited.
- [x] Telegram token boundary audited.
- [x] Dashboard wallet/approval reads narrowed away from raw prepared
  transaction payloads.
- [x] Dashboard wallet readiness model added.
- [x] Dashboard renders no-wallet state.
- [x] Dashboard renders execution-disabled state.
- [ ] Dashboard renders wrong-network state if modeled.
- [ ] Public profile does not expose private wallet fields.
- [ ] Telegram `/policy` still refuses wallet/onchain execution.
- [x] `npm run build`
- [x] `git diff --check`
- [x] Local desktop/mobile dashboard smoke

## Done Criteria

- User privacy is preserved in wallet display, dashboard state, and public
  profile output.
- Wallet security remains protected: no custody, no private key path, no hidden
  signing path.
- Wallet readiness is explicit.
- Owner sees what is missing before execution can happen.
- Public viewers do not see private wallet state.
- No transaction can be signed or submitted.
- Phase 6B can start with a clean wallet-readiness foundation.
