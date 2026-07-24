# telegram-webhook Edge Function

This production webhook receiver is gate-controlled and live for
read-only Telegram + LLM replies. The latest implementation can
resolve active sessions, consume owner-link challenges, authorize read-only
commands and bounded natural chat, claim updates, and deliver bounded read-only
replies only when the corresponding runtime gates are enabled.

## Safety Contract

- Accepts `POST` and `OPTIONS` only.
- Checks for `X-Telegram-Bot-Api-Secret-Token` before reading the request body.
- Rejects missing webhook secret headers with a generic `401`.
- All runtime gates enable only for the exact string `true`.
- Owner-link consume requires successful active-session lookup before one body
  read.
- Owner-link candidates are parsed and consumed through the service-role-only
  hash-based RPC, then receive one generic acknowledgement.
- Owner-link candidates bypass normal chat authorization, normal update claim,
  token resolution, and Telegram response delivery.
- Normal read-only commands and natural chat preserve the existing gated
  webhook pipeline.
- Supported read-only commands are `/help`, `/status`, `/agent`, `/actions`,
  `/modules`, and `/policy`.
- Bounded plain-text messages are accepted as read-only chat and classified into
  safe intents such as market brief, campaign plan, narrative map, launch copy,
  and community pulse.
- Template context enrichment is default-off and only applies to `/agent`,
  `/actions`, `/modules`, and natural chat after session lookup, chat
  authorization, and atomic update claim.
- Agent-brain enrichment is default-off and only applies to `/agent`,
  `/actions`, `/modules`, and natural chat when a reviewed provider dependency
  is injected.
- Does not log the request body.
- Does not expose webhook secrets, challenge material, challenge hashes,
  Telegram identities, session IDs, token refs, BotFather tokens, or raw
  database errors.
- Does not access Supabase Vault from the owner-link consume path.
- Does not call Telegram APIs from the owner-link consume path.
- Does not trigger wallet, Robinhood Chain actions, or onchain execution.
- Natural chat execution-like messages are classified by the wallet execution
  gate. Owner/admin review wording can only be described as a future dashboard
  approval-draft candidate; direct execution wording and non-owner execution
  intent are refused.
- Execution-gate decisions keep `canExecuteFromTelegram` and
  `canCreateDraftNow` false. No Telegram-created approval record, prepared
  action, wallet prompt, Robinhood Chain provider call, signature, or transaction submission is
  enabled by this webhook.

## Current Response

With all gates disabled, requests with a webhook secret header return:

```json
{
  "ok": false,
  "status": "not_configured",
  "message": "Telegram webhook is planned but not enabled yet."
}
```

Requests without the webhook secret header return:

```json
{
  "ok": false,
  "status": "webhook_verification_failed",
  "message": "Telegram webhook verification failed."
}
```

## Gate Order

Keep the webhook path staged behind runtime gates:

1. Active session lookup.
2. Update parsing.
3. Owner-link consume.
4. Chat authorization.
5. Atomic update claim.
6. Optional template context lookup for `/agent`, `/actions`, `/modules`, and
   natural chat.
7. Optional agent-brain response enrichment for `/agent`, `/actions`, and
   `/modules` or natural chat.
8. Token resolution.
9. Read-only response delivery.

Do not enable write, approval, wallet, Robinhood Chain actions, onchain, or LLM command
execution from this webhook without a separate reviewed implementation.

## Wallet Execution Gate

`execution-gate.ts` is a local fail-closed classifier for natural chat messages
that look like wallet, approval, Robinhood Chain actions, swap, transfer, or onchain requests.

It can return:

- `read_only_allowed`
- `approval_draft_candidate`
- `blocked`

This is not a database writer. Draft creation stays disabled until owner-scoped
storage, replay protection, rate limits, dashboard review, and wallet approval
are approved. The replay-key shape for future draft creation is
`telegram-draft:<telegram_session_id>:<update_id>:<message_id>`.

## Agent Brain Boundary

`agent-brain.ts` defines the local-only LLM/provider boundary for Telegram
responses. It builds sanitized read-only prompts and validates provider output,
but it does not call any LLM provider by itself.

`agent-brain-provider.ts` defines an OpenAI-compatible provider adapter that can
turn the sanitized local request into an outbound provider request when the
reviewed runtime gates are enabled. It validates endpoint, model, API key
presence, response shape, timeout behavior, and sanitized failure states. The
runtime wires it lazily only after the agent-brain and provider gates are
enabled, and only reads provider environment values when an eligible read-only
command or natural chat reaches the provider path.

The webhook can use agent-brain output only when
`KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_ENABLED` is exactly `true` and a reviewed
provider dependency is injected. Without that dependency, the gate falls back to
the existing static or template-context response instead of breaking delivery.
The OpenAI-compatible adapter is additionally protected by
`KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_PROVIDER_ENABLED`; provider API key and model
env values are read lazily only when both agent-brain and provider gates are
enabled and an eligible read-only command or natural chat reaches the provider
path.

For OpenRouter, keep the same backend-only boundary and configure the provider
through Supabase Edge Function secrets/env only:

- `KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_ENABLED=true`
- `KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_PROVIDER_ENABLED=true`
- `KYRA_TELEGRAM_AGENT_BRAIN_ENDPOINT=https://openrouter.ai/api/v1/chat/completions`
- `KYRA_TELEGRAM_AGENT_BRAIN_MODEL=<openrouter model id>`
- `KYRA_TELEGRAM_AGENT_BRAIN_API_KEY=<Supabase Edge Function secret>`

OpenRouter uses the chat completions request shape at
`/api/v1/chat/completions`; the provider sends `messages` for that endpoint and
keeps the Responses API `input` shape for `/v1/responses`-style endpoints.

Never put the OpenRouter API key in the repo, browser storage, frontend state,
logs, screenshots, or chat. The runtime should read it only inside the Edge
Function after the webhook, session, chat authorization, update claim, and
agent-brain gates pass.

## Template And Module Context

`template-context.ts` defines the local-only template/module context boundary for
Telegram responses. It normalizes template actions and modules, marks
read-only-ready actions separately from dashboard-gated and owner wallet-gated
actions, and keeps Executor-style wallet automation gated until Robinhood Chain actions work is
approved.

`template-context-lookup.ts` defines the injectable lookup adapter for future
runtime wiring. It reads only agent/template profile fields and sanitizes
malformed rows and database failures.

The webhook can enrich `/agent`, `/actions`, `/modules`, and natural chat
replies with template context only when
`KYRA_TELEGRAM_WEBHOOK_TEMPLATE_CONTEXT_ENABLED` is exactly `true`. The gate is
disabled by default. The runtime lookup is lazy, uses read-only REST queries for
`agent_instances` and `agent_templates`, and runs only after the webhook secret,
active session, chat authorization, and atomic claim gates pass. `/policy` stays
static so safety boundaries remain available even when optional context gates
are disabled.

## Future Work

Before expanding beyond read-only commands and natural read-only chat, add a reviewed write command processor contract, stronger prompt-injection
protections, approval queue mapping, abuse limits, rollback steps, wallet
approval checks, Robinhood Chain action execution boundaries, and production smoke checks.
