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
- By default, does not return, log, persist, or use a BotFather token.
- Does not call Telegram APIs by default.
- If `KYRA_TELEGRAM_CONNECT_GETME_ENABLED=true` is explicitly enabled later, the
  function may validate a token with `getMe` after auth and ownership checks,
  but it still does not persist tokens, access Vault, write database records, or
  register webhooks.
- If `KYRA_TELEGRAM_CONNECT_STORE_ENABLED=true` is explicitly enabled later, the
  function may validate the token with `getMe` and store it through the approved
  backend-only secret store. The response must still not return the raw token,
  resolved token, `tokenSecretRef`, owner ID, workspace ID, or Telegram bot ID.
- If both `KYRA_TELEGRAM_CONNECT_STORE_ENABLED=true` and
  `KYRA_TELEGRAM_CONNECT_SESSION_WRITE_ENABLED=true` are explicitly enabled
  later, the function may update exactly one existing mock `telegram_sessions`
  row for the owned agent to `webhook_status=queued`, set its validated bot
  handle, and attach the opaque `tokenSecretRef`.
- Session persistence never inserts or upserts a Telegram session and never
  marks it active by itself. If it succeeds, the response is a bounded `queued`
  success without session IDs or token refs.
- If session persistence fails after token storage, the function makes a
  best-effort backend-only revoke call and returns a sanitized error.
- `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED=true` is parsed by the runtime
  but defaults off. When it is off, no webhook URL is read, no webhook secret is
  generated, and no Telegram webhook registration dependency is mounted.
- If webhook registration is explicitly enabled later, it also depends on the
  prior `getMe`, secret-store, and session-write gates being safely configured.
  It must use a backend-only `KYRA_TELEGRAM_WEBHOOK_URL` value and a generated
  per-request webhook secret.
- The gated production finalization path stores only the webhook secret hash and
  opaque ref, calls Telegram `setWebhook`, then activates the exact queued
  token-backed session.
- If gated webhook registration succeeds, the response is a bounded `active`
  success with safe metadata only.
- A failed `setWebhook` attempt revokes the newly stored webhook secret row on a
  best-effort basis and does not activate the queued session.
- If `setWebhook` succeeds but exact queued-session activation fails, the
  finalizer makes a best-effort Telegram `deleteWebhook` call with
  `drop_pending_updates=false`, then revokes the stored webhook secret row.
- Activation cleanup failures stay sanitized. The session remains `queued` for
  audit or manual recovery and is never presented as active.
- The webhook registration gate must remain disabled until webhook secret
  storage, webhook session lookup, command authorization, and deployment smoke
  checks are separately approved.
- The store gate does not make Telegram live by itself.
- The session-write gate does not make Telegram live by itself and has no effect
  unless the store gate is also enabled.
- Does not access Supabase Vault by default.
- Does not create or read secrets by default.
- Does not write database records by default.
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

If future runtime gates are explicitly enabled, successful steps return only
bounded safe statuses:

- `validated`: token validation succeeded, but no backend state was activated.
- `review`: token storage succeeded and backend finalization is still required.
- `queued`: session staging succeeded and webhook activation is pending.
- `active`: webhook registration and session activation succeeded.

## Future Work

Real Telegram connection requires separate approval for token input, Supabase
Vault or approved fallback secret storage, schema/RLS changes, Telegram `getMe`,
webhook registration, ownership validation, and production deployment.
