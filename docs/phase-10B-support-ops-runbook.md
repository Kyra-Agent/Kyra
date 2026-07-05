# Phase 10B Support Operations and Operator Runbook

Status: ready for local closeout. Public execution runtime remains default-off.

This runbook defines the support and operator workflow for Kyra before public product release. It is product-facing operational guidance, not a secret setup guide and not an execution unlock.

## Support Principles

- User wallet authority is priority one.
- Telegram bot-token privacy is priority one.
- Never ask a user for a seed phrase, private key, Telegram bot token, API key, or raw session token.
- Never move funds for a user.
- Never claim Telegram can sign, approve, submit, swap, transfer, or call contracts.
- Keep support evidence sanitized and owner-only.
- Keep public analytics aggregated and privacy-preserving.

## Support Intake

Support can ask for:

- public agent route or display name
- approximate timestamp
- visible command or UI state
- sanitized screenshot with private values hidden
- whether the issue happened on website, dashboard, Telegram, or Base Account prompt

Support must not ask for:

- seed phrase
- private key
- Telegram bot token
- raw API key
- full wallet address unless owner-approved display is required
- raw transaction intent payload
- provider payload body
- raw Edge Function error body
- Supabase service role data

## User-Facing States

| State | User-facing copy | Operator action |
| --- | --- | --- |
| Telegram read-only refusal | Kyra can brief, plan, or review risk, but cannot execute from Telegram. | Confirm command boundary and offer read-only alternative. |
| Wallet prompt unavailable | Wallet execution is gated until the owner uses the private dashboard flow. | Check owner session, selected agent, Base Account connection, and runtime gate. |
| Insufficient gas | The connected Base Account needs Base ETH for gas before submit. | Share funding guidance without custody or private-key instructions. |
| Rejected prompt | The owner rejected the wallet prompt. No transaction was submitted. | Close as owner-rejected unless user retries intentionally. |
| Provider outage | Base Account/provider response is unavailable. No hidden retry is made. | Pause execution lane, monitor provider health, and use incident controls if persistent. |
| Stuck receipt | Result is pending until receipt verification confirms success or failure. | Use owner-only receipt review and do not mark success from pending state. |
| Public profile issue | Public profiles are identity and capability surfaces only. | Verify public copy does not expose wallet, token, session, internal id, payload, or raw error details. |

## Operator Runbook

1. Confirm the report source: website, dashboard, Telegram, public profile, or Base Account prompt.
2. Classify the issue as read-only support, wallet readiness, approval, provider, privacy, abuse, or incident.
3. Confirm whether the affected state is public-safe or owner-only.
4. Collect only sanitized evidence.
5. Check the relevant gate: 9A eligibility, 9B abuse/rate limits, 9C incident controls, 9D monitoring/support, 9E public privacy, or Phase 10 release readiness.
6. If execution or wallet authority is involved, keep the user in the private dashboard and require explicit owner approval plus Base Account approval.
7. If provider, receipt, rollback, or emergency disable is involved, follow the Phase 9C incident controls before continuing.
8. Record the outcome as sanitized owner-only support evidence.

## Emergency Disable

Use emergency disable when:

- public copy implies unauthorized execution
- Telegram appears to trigger execution
- public profile exposes sensitive state
- provider behavior cannot be verified
- receipt verification is stuck or inconsistent
- abuse/rate-limit controls are bypassed
- raw wallet, token, provider, session, internal id, transaction intent, or raw error details appear outside owner-only surfaces

Emergency disable outcome:

- public runtime remains disabled
- transaction submission remains blocked
- Telegram remains read-only
- incident evidence remains owner-only
- public copy is corrected before reopening release review

## Rollback

Rollback targets:

- public README/product copy
- website/dashboard copy
- public agent profile copy
- Telegram response copy
- support runbook text
- release status labels
- runtime flags

Rollback must not:

- expose secrets
- move funds
- alter owner wallet authority
- skip Base Account approval
- mark pending receipts as successful
- erase owner-only audit evidence

## Escalation Rules

Escalate before continuing when:

- a user reports unexpected wallet prompt behavior
- a transaction status is unclear
- Telegram appears to attempt execution
- a public route shows private state
- any secret-like value appears in logs/docs/UI
- abuse controls are bypassed
- provider metadata changes
- official Base MCP scope/resource semantics change

## Closeout Criteria

Batch 10B can close when:

- support intake rules are documented
- operator runbook is documented
- emergency disable rules are documented
- rollback rules are documented
- user-facing blocked-state copy is documented
- privacy and security support boundaries are explicit
- public runtime remains default-off