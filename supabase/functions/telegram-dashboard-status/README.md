# telegram-dashboard-status

Default-off Edge Function skeleton for future dashboard-safe Telegram status.

Current behavior:

- `OPTIONS` returns CORS `ok`.
- `POST` validates method, JSON content type, and body size.
- With `KYRA_TELEGRAM_DASHBOARD_STATUS_ENABLED` disabled or unset, returns
  `not_configured` before reading request body, required env values, user
  session, service-role clients, or database data.

Future enabled contract:

- Require `Authorization: Bearer`.
- Validate the Supabase session.
- Accept only `{ "agentIds": string[] }`.
- Verify ownership before returning any agent status.
- Return only bounded dashboard fields:
  `agentId`, `botHandle`, `webhookStatus`, `ownerChatLinked`,
  `ownerLinkAvailable`, and `lastEventAt`.

Hard boundaries:

- Do not read `.env.local` or secret values locally.
- Do not expose Telegram user IDs, chat IDs, owner IDs, workspace IDs, session
  IDs, challenge fields, token refs, webhook secret refs, raw BotFather tokens,
  raw webhook secrets, or raw database errors.
- Do not query `telegram_chat_authorizations` from the browser.
- Do not grant browser roles direct access to private Telegram authorization
  tables.
- Do not deploy or enable this function until the backing read model is
  separately approved and verified.
