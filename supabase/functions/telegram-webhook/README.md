# telegram-webhook Edge Function

This is an inert Phase 5D skeleton for the future Telegram webhook receiver.
It is not a live webhook integration.

## Safety Contract

- Accepts `POST` and `OPTIONS` only.
- Checks for `X-Telegram-Bot-Api-Secret-Token` before reading the request body.
- Rejects missing webhook secret headers with a generic `401`.
- Does not parse the Telegram update body.
- Does not log the request body.
- Does not call Telegram APIs.
- Does not access Supabase Vault.
- Does not create or read secrets.
- Does not write database records.
- Does not route commands.
- Does not trigger wallet, Base MCP, or onchain execution.

## Current Response

Requests with a webhook secret header return:

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

Real Telegram webhook handling requires separate approval for webhook secret
storage, Supabase Vault or approved fallback secret resolution, session lookup,
chat authorization, command processing, safe activity logging, and production
deployment.
