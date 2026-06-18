# Phase 7H Release And Rollback Audit

Date: 2026-06-19

Status: historical audit packet. This phase did not enable production
execution, wallet prompts, signing, transaction submission, Telegram execution,
Base MCP provider calls, or prepared-action production storage. Phase 7J later
wires the read-only Base MCP status provider adapter behind the exact runtime
gate.

## Objective

Phase 7H defines the release and rollback discipline required before any Phase
7 production gate can be enabled.

The goal is to keep Kyra shippable without making Netlify/Supabase pushes
casual. Local commits may accumulate, but production deploys must be batched,
reviewed, and tied to a concrete smoke checklist and rollback path.

## Release Rule

No production gate can be enabled until all of these are true:

- owner approval is explicit for the exact gate
- local audit packet exists
- automated checker exists and is included in `npm run check:phase-7`
- forward path is reviewed
- rollback path is reviewed
- live smoke checklist is written
- target account/workspace is low risk
- secrets are configured only in backend secret storage
- Netlify deploy is batched with other reviewed local commits

## Current Gate State

All execution-adjacent gates remain non-executing:

- Prepared-action SQL: review-only.
- Base MCP runtime provider call: default-off; Phase 7J wires only the
  read-only status adapter behind `KYRA_BASE_MCP_PREP_ENABLED=true` and an
  HTTPS backend endpoint.
- Prepared-action storage write: adapter exists as a tested draft, not wired.
- Wallet provider runtime: dependencies installed, prompt execution disabled.
- Wallet signing/submission: state model only, no live signer call.
- Telegram execution: read-only, cannot create approvals or prepared actions.
- Telegram LLM: read-only response enrichment only.

## Rollback Inventory

Prepared-action storage has a complete local SQL review packet:

- `supabase/prepared_action_storage_forward_review.sql`
- `supabase/prepared_action_storage_rollback_review.sql`
- `supabase/verify_prepared_action_storage_review.sql`

Telegram schema/RPC review packets also keep paired rollback artifacts where
they exist:

- `supabase/telegram_owner_link_challenge_forward_review.sql`
- `supabase/telegram_owner_link_challenge_rollback_review.sql`
- `supabase/telegram_owner_link_rate_limit_forward_review.sql`
- `supabase/telegram_owner_link_rate_limit_rollback_review.sql`
- `supabase/telegram_update_claim_forward_review.sql`
- `supabase/telegram_update_claim_rollback_review.sql`
- `supabase/telegram_webhook_receiver_forward_review.sql`
- `supabase/telegram_webhook_receiver_rollback_review.sql`
- `supabase/telegram_delivery_token_resolver_forward_review.sql`
- `supabase/telegram_delivery_token_resolver_rollback_review.sql`
- `supabase/telegram_disconnect_session_claim_forward_review.sql`
- `supabase/telegram_disconnect_session_claim_rollback_review.sql`

Rollback SQL must not be applied blindly after live rows exist. If production
data exists, prefer a reviewed forward fix unless the rollback packet explicitly
allows the exact data state.

## Runtime Gate Rules

- Runtime gates enable only on exact string `true`.
- Runtime gates stay default-off when env is absent.
- Runtime gates read sensitive env lazily only after earlier safety gates pass.
- No `VITE_` env key may expose service-role, Base MCP, Telegram bot token,
  OpenRouter/OpenAI-compatible, private key, or wallet signing material.
- Every newly enabled runtime gate needs a matching disable plan.

## Local Verification Before Push

Run this full local set before any push or deploy:

```powershell
npm run check:phase-7
deno test --quiet supabase/functions
npm run build
git diff --check
```

Expected current Deno result:

- `472 passed | 0 failed`

## Live Smoke Checklist

Use a low-risk owner account and demo workspace only.

Before enabling any production gate:

- confirm the target Supabase project and Netlify site
- confirm secrets are present only in Supabase/Netlify backend secret stores
- confirm no secret appears in `.env.example`, docs, frontend, public assets,
  Telegram chat, screenshots, or logs
- confirm rollback SQL or disable plan is open in the same review packet
- confirm the exact env gate names and current values
- confirm one owner dashboard session can sign in
- confirm public agent route exposes no owner-only fields
- confirm Telegram still refuses wallet/swap/onchain execution
- confirm dashboard activity logs are sanitized
- confirm failure path produces bounded user-facing copy

After enabling a gate:

- run the smallest approved success path once
- run the primary refusal path once
- run one wrong-owner or unauthorized path once
- inspect dashboard state for bounded summaries only
- inspect Telegram output for read-only boundaries
- if any secret, wallet payload, raw calldata, raw provider payload, or
  transaction payload appears, disable the gate immediately

## Netlify Credit Discipline

- Do not push only to preview text, markdown, or docs unless the owner asks.
- Batch local commits and push only after review approval.
- Prefer local `npm run build` and local checker output before consuming deploy
  credit.
- Push immediately only for security fixes, broken production, or owner-approved
  release batches.

## Phase 7H Done Criteria

- Release and rollback audit packet exists.
- Automated Phase 7H checker exists.
- `npm run check:phase-7` includes Phase 7H.
- Rollback inventory is explicit.
- Runtime gate rules are explicit.
- Local verification before push is explicit.
- Live smoke checklist is explicit.
- Netlify credit discipline is explicit.
- No production execution capability is enabled by this audit. The later 7J
  provider wiring remains read-only and default-off until the runtime gate is
  explicitly enabled.

## Next Step

After this packet stays green, Phase 7 can move from audit-only into one narrow
decision packet for the first live candidate. The current safest candidate is
still read-only Base MCP status preparation, not wallet signing or transaction
submission.
