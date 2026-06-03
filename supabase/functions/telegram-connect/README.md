# telegram-connect Edge Function

This is an inert Phase 5D skeleton for the future Telegram connection flow.
It is not a live Telegram integration.

## Safety Contract

- Accepts `POST` and `OPTIONS` only.
- Requires a valid Supabase Auth bearer token.
- Parses JSON safely.
- Requires an `agentId` string.
- Ignores any submitted `botToken`.
- Does not return, log, persist, validate, or use a BotFather token.
- Does not call Telegram APIs.
- Does not access Supabase Vault.
- Does not create or read secrets.
- Does not write database records.
- Does not register webhooks.

## Current Response

Authenticated requests with a valid JSON body and `agentId` return:

```json
{
  "ok": false,
  "status": "not_configured",
  "message": "Telegram connect is planned but not enabled yet."
}
```

## Future Work

Real Telegram connection requires separate approval for token input, Supabase
Vault or approved fallback secret storage, schema/RLS changes, Telegram `getMe`,
webhook registration, ownership validation, and production deployment.
