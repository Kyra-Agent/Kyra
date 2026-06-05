# telegram-webhook Edge Function

This local Phase 5 webhook receiver is default-off and has not been redeployed
with the owner-link consume path.

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

## Future Work

Do not deploy or enable the owner-link consume gate until durable rate-limit
and abuse controls, deployment ordering, rollback steps, and production smoke
checks are separately approved.
