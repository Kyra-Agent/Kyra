# Phase 6B Review Packet

Review date: 2026-06-15

Status: local review packet only. Do not push, deploy, apply SQL, wire provider
calls, or enable wallet execution from this document.

## Security Priority

User privacy, user wallet security, and user Telegram bot token security are the
top priority.

Phase 6B must keep:

- no seed phrase path
- no private key path
- no wallet custody
- no Telegram token exposure
- no Telegram-triggered wallet or onchain execution
- no live Base MCP provider call wired into runtime
- no prepared-action SQL applied to Supabase
- no raw calldata, transaction hash, provider payload, endpoint URL, or API key
  in public or Telegram responses

## Packet Contents

Primary docs:

- `docs/phase-6B-base-mcp-audit.md`
- `docs/phase-6B-base-mcp-adapter-contract.md`
- `docs/phase-6B-prepared-action-read-model.md`
- `docs/phase-6B-base-mcp-prep-plan.md`

Backend function draft:

- `supabase/functions/base-mcp-prepare/core.ts`
- `supabase/functions/base-mcp-prepare/runtime-config.ts`
- `supabase/functions/base-mcp-prepare/dependencies.ts`
- `supabase/functions/base-mcp-prepare/provider-adapter.ts`
- `supabase/functions/base-mcp-prepare/storage-adapter.ts`

SQL review artifacts:

- `supabase/prepared_action_storage_schema_draft.sql`
- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

Static guard scripts:

- `scripts/check-base-mcp-contract.mjs`
- `scripts/check-prepared-action-boundary.mjs`
- `scripts/check-public-privacy.mjs`
- `scripts/check-functions.mjs`

## What Is Ready Locally

- First allowed Base MCP action is `base_mcp_status_check`.
- `base-mcp-prepare` function skeleton exists and fails closed by default.
- Runtime gate enables only on exact `KYRA_BASE_MCP_PREP_ENABLED=true`.
- Request replay guard rejects stale requests older than 5 minutes.
- Future clock skew guard rejects requests more than 60 seconds ahead.
- Preview TTL guard rejects previews more than 10 minutes out.
- Bearer session and owner/workspace checks run before adapter access.
- Unsupported action kinds fail before ownership lookup or adapter access.
- Provider adapter draft is pure and tested with fake transport only.
- Storage adapter draft is pure and tested with fake client only.
- Prepared-action SQL packet has forward, rollback, and verifier files.
- Public profile and Telegram paths are guarded from prepared-action payloads.

## What Is Still Disabled

- Runtime dependencies do not wire `createBaseMcpStatusCheckAdapter`.
- Runtime dependencies do not wire `storePreparedActionSummary`.
- `supabase/schema.sql` does not include `public.prepared_actions`.
- Prepared-action SQL files are review artifacts only.
- Base MCP endpoint/API key secrets are not exposed to the browser.
- Dashboard does not fetch `approval_requests.prepared_tx` or `tx_hash`.
- Telegram can refuse execution, but cannot prepare, approve, sign, submit, or
  read prepared actions.

## Live Enablement Order

Do not skip order.

1. Re-run full local verification.
2. Review SQL forward, rollback, and verifier against target Supabase project.
3. Apply SQL only after separate Supabase approval.
4. Run verifier SQL and inspect results.
5. Wire storage adapter only after SQL verifier passes.
6. Wire provider adapter only after endpoint, timeout, API key handling, and
   sanitized failure behavior are reviewed.
7. Enable `KYRA_BASE_MCP_PREP_ENABLED=true` only after runtime wiring review.
8. Smoke test dashboard owner session.
9. Smoke test Telegram refusal for swap/wallet/onchain commands.
10. Keep wallet signing and transaction submission deferred to Phase 6C.

## Required Local Verification

Run before any push or deploy:

```powershell
npm run check:phase-6b
deno test supabase/functions/base-mcp-prepare/index_test.ts supabase/functions/base-mcp-prepare/runtime-config_test.ts supabase/functions/base-mcp-prepare/storage-adapter_test.ts supabase/functions/base-mcp-prepare/provider-adapter_test.ts
npm run check:base-mcp
npm run check:prepared-actions
npm run check:privacy
npm run check:functions
npm run build
git diff --check
```

Expected current Deno count:

- `28 passed`

## Hard No-Go

- Do not push just to preview Netlify.
- Do not deploy until all local commits are reviewed together.
- Do not apply SQL without a separate explicit approval.
- Do not add `VITE_` Base MCP secrets.
- Do not expose wallet addresses, private keys, seed phrases, Telegram token
  refs, API keys, provider payload refs, raw calldata, or transaction hashes.
- Do not let Telegram call Base MCP, write prepared actions, approve, sign, or
  submit.
- Do not expand beyond `base_mcp_status_check` during 6B.

## Phase 6B Close Criteria

Phase 6B can be considered locally ready for push review when:

- this packet is current
- all verification commands pass
- runtime dependencies remain unwired
- SQL packet remains unapplied
- no public or Telegram path can read prepared-action state
- no wallet execution path is enabled
- next live steps are explicit enough for Phase 6C to start cleanly
