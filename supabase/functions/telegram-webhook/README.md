# telegram-webhook Edge Function

This Phase 5 webhook receiver is gate-controlled. The latest implementation can
resolve active sessions, consume owner-link challenges, authorize read-only
commands, claim updates, and deliver bounded read-only replies only when the
corresponding runtime gates are enabled.

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
- Normal read-only commands preserve the existing gated webhook pipeline.
- Supported read-only commands are `/help`, `/status`, `/agent`, and
  `/actions`.
- Does not log the request body.
- Does not expose webhook secrets, challenge material, challenge hashes,
  Telegram identities, session IDs, token refs, BotFather tokens, or raw
  database errors.
- Does not access Supabase Vault from the owner-link consume path.
- Does not call Telegram APIs from the owner-link consume path.
- Does not trigger wallet, Base MCP, or onchain execution.

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
6. Token resolution.
7. Read-only response delivery.

Do not enable write, approval, wallet, Base MCP, onchain, or LLM command
execution from this webhook without a separate reviewed implementation.

## Future Work

Before expanding beyond read-only commands, add a reviewed command processor
contract, LLM provider boundary, prompt-injection protections, approval queue
mapping, abuse limits, rollback steps, and production smoke checks.
