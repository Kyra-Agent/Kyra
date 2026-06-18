# Phase 6 Telegram Execution Gate

Status: local boundary implemented. No Telegram approval-draft database write,
wallet prompt, Base MCP call, transaction signing, or transaction submission is
enabled.

## Goal

Telegram must never bypass the dashboard and wallet approval flow.

Phase 6 Step 8 defines the first safe bridge between Telegram requests and the
future dashboard approval path:

- read-only chat stays allowed;
- execution-like chat is classified;
- direct execution wording is blocked;
- owner execution-review wording can only become an approval-draft candidate;
- actual draft creation remains disabled until owner-scoped storage, replay
  protection, rate limits, and dashboard review are approved.

## Current Implementation

- `supabase/functions/telegram-webhook/execution-gate.ts` defines the local
  gate decision model.
- `supabase/functions/telegram-webhook/read-only-pipeline.ts` uses the gate to
  override unsafe natural-chat execution responses.
- `supabase/functions/telegram-webhook/execution-gate_test.ts` covers draft
  candidates, direct execution rejection, non-owner rejection, secret-like
  rejection, and replay-key validation.
- `supabase/functions/telegram-webhook/read-only-pipeline_test.ts` covers the
  end-to-end read-only pipeline behavior.

## Decision States

- `read_only_allowed`: normal Telegram read-only request.
- `approval_draft_candidate`: owner/admin execution-review wording. It is not a
  database write yet.
- `blocked`: direct execution wording, non-owner draft intent, or secret-like
  content.

Every decision has:

- `canExecuteFromTelegram: false`
- `canCreateDraftNow: false`

## Draft Candidate Rules

Owner/admin messages such as `review 10 USDC to ETH swap` can be classified as
`approval_draft_candidate`.

The response must say:

- Telegram execution is disabled.
- The request can only become an owner-scoped dashboard approval draft after
  Phase 6 gates are enabled.
- No wallet prompt, signature, Base MCP call, or transaction submission was
  created.

## Block Rules

The gate blocks:

- direct language such as `execute`, `submit`, `broadcast`, `swap now`, `sign
  now`, or `approve now`;
- non-owner/member/public attempts to create wallet or onchain drafts;
- seed phrases, private keys, BotFather-token-shaped values, OpenRouter-key
  shaped values, and Supabase secret shaped values.

## Replay And Rate Limits

Future draft creation must use a session/update/message-scoped replay key:

`telegram-draft:<telegram_session_id>:<update_id>:<message_id>`

Draft creation must also be rate-limited by owner/workspace/session before any
database write is enabled.

## Not Enabled

- No Telegram-created approval records.
- No Telegram-created prepared actions.
- No wallet prompts.
- No Base MCP calls.
- No transaction submission.
- No public execution status.
