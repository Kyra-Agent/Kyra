# telegram-connect Edge Function

This is an inert Phase 5 skeleton for the future Telegram connection flow. It is
not a live Telegram integration.

## Safety Contract

- Accepts `POST` and `OPTIONS` only.
- Requires a valid Supabase Auth bearer token.
- Parses JSON safely.
- Requires a UUID `agentId`.
- Validates the signed-in user owns the target agent with a read-only
  `agent_instances -> workspaces.owner_user_id` lookup.
- Includes a mockable BotFather token validator contract for tests and future
  wiring.
- Ignores any submitted `botToken` unless a test or the backend-only
  `KYRA_TELEGRAM_CONNECT_GETME_ENABLED=true` runtime gate explicitly enables
  validation.
- Does not return, log, persist, or use a BotFather token.
- Does not call Telegram APIs by default.
- If `KYRA_TELEGRAM_CONNECT_GETME_ENABLED=true` is explicitly enabled later, the
  function may validate a token with `getMe` after auth and ownership checks,
  but it still does not persist tokens, access Vault, write database records, or
  register webhooks.
- Does not access Supabase Vault.
- Does not create or read secrets.
- Does not write database records.
- Does not register webhooks.

## Current Response

Authenticated owner requests with a valid JSON body and `agentId` return:

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
