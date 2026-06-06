# telegram-disconnect Edge Function

This Phase 5 operator disconnect function is local-only, inert, and
default-off. It has not been deployed or enabled.

## Current Behavior

- `OPTIONS` returns the shared CORS response.
- `POST` requires JSON content type and the small body-size guard.
- With `KYRA_TELEGRAM_DISCONNECT_ENABLED` unset or any value other than exact
  `true`, the handler returns `501 not_configured` before reading the request
  body, reading required Edge Function secrets, validating a Supabase session,
  creating a service-role client, querying the database, resolving a token, or
  calling Telegram.
- If the gate is explicitly enabled in tests, the handler validates bearer auth,
  Supabase session shape, and a bounded request body.
- `pause` can claim one owned active Telegram session through the approved
  service-role RPC adapter and returns a sanitized `200 paused` response.
- `disconnect` and `revoke` still return `501 not_configured`; their cleanup
  sequence is modeled locally but not wired into runtime yet.

## Safety Contract

- No Telegram API call is made.
- No BotFather token is accepted.
- No token, token ref, webhook secret, webhook ref, Telegram URL, session ID,
  owner ID, workspace ID, or operator note is returned.
- No Supabase service-role RPC client is created while the gate is off.
- No database read or write is performed while the gate is off.
- No raw BotFather token, token ref, webhook secret ref, Telegram URL, session
  ID, owner ID, workspace ID, or operator note is returned.

## Future Work

Real disconnect and revoke behavior requires separate approval for runtime
wiring, Edge Function deployment, production smoke tests, gate enablement, and
rollback steps.
