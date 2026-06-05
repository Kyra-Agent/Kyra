# telegram-link Edge Function

This local-only Phase 5 owner-link issue function is default-off and has not
been deployed.

## Safety Contract

- Supabase gateway JWT verification must remain enabled.
- `KYRA_TELEGRAM_LINK_ISSUE_ENABLED` defaults off and enables only for the exact
  string `true`.
- While disabled, the handler returns `501 not_configured` without reading the
  body, required env values, Supabase session, service-role client, or RPC.
- The enabled path requires a valid Supabase session, exact agent ownership, and
  exactly one active matching Telegram session.
- The active-session lookup selects only `id`, `agent_id`, `bot_handle`, and
  `webhook_status`; it never selects or returns `token_secret_ref`.
- Challenge material is generated only after auth, ownership, and active-session
  validation.
- Only the challenge hash is sent to the service-role-only issue RPC.
- The issue RPC's bounded `rate_limited` result maps to a fixed sanitized
  `429` response without exposing thresholds, reset time, IDs, or policy
  details.
- The raw challenge is returned exactly once inside the Telegram deep link. It
  is never logged, persisted, or returned separately.
- Responses never include owner/workspace/session IDs, challenge hashes, token
  refs, BotFather tokens, or raw database errors.
- This function does not call Telegram APIs, access Vault, or change schema/RLS.

## Current Default Response

```json
{
  "ok": false,
  "status": "not_configured",
  "message": "Telegram owner linking is planned but not enabled yet."
}
```

Do not deploy or enable the issue gate until the owner-link webhook consume
branch, durable abuse controls, UI, and production smoke plan are separately
approved.
