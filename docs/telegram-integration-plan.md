# Telegram Integration Plan

Phase 5A.1 is documentation and planning only. It does not implement Telegram
connectivity, token handling, webhook registration, command processing, schema
changes, RLS changes, or production behavior changes.

## Current State Findings

- Kyra is currently a production-safe backend-connected demo.
- Telegram is represented as a simulated integration in frontend runtime config.
- The deploy wizard already explains that no real BotFather token is required in
  demo mode.
- The public agent page exposes only a demo Telegram launch state. It does not
  open a live Telegram bot or register a webhook.
- The dashboard can display Telegram handle and webhook state metadata from demo
  records.
- The database already includes `telegram_sessions` for Telegram connection
  metadata.
- Current demo deploy writes a `telegram_sessions` row with `webhook_status` set
  to `mocked` and `token_secret_ref` set to `null`.
- No current code path accepts, stores, logs, validates, or registers a real
  Telegram bot token.
- No current Edge Function handles Telegram webhook updates.

## Recommended Architecture

Real Telegram integration should use backend-only token handling with Supabase
Edge Functions as the security boundary.

The browser may collect a BotFather token only inside a dedicated connection
form. The token must be submitted directly to the backend over an authenticated
request and must not become durable frontend state.

The backend should own all sensitive work:

- Validate the signed-in Supabase user session.
- Validate that the target agent belongs to the signed-in user's workspace.
- Validate the BotFather token with Telegram `getMe`.
- Store only a backend secret reference in database records.
- Register a Telegram webhook after token validation succeeds.
- Verify every incoming webhook request with a per-connection webhook secret.
- Return only safe metadata to the frontend, such as bot handle, connection
  status, and webhook status.

The frontend should only render safe connection state:

- `Telegram demo ready`
- `Real Telegram bot not connected`
- `Connect Telegram` gated or disabled until the backend connection flow is
  explicitly approved
- Connected bot handle after successful backend validation
- Recoverable failure state if webhook registration fails

## Token Handling Rules

The BotFather token is a secret. It may only exist as transient form input during
submit.

Required rules:

- Never store a BotFather token in `localStorage`, `sessionStorage`, IndexedDB,
  cookies, URL params, analytics events, browser logs, or persisted frontend
  state.
- Never render the token back to the user after submit.
- Never keep the token in global React state or shared app stores.
- Never include the token in frontend telemetry, backend activity logs, database
  logs, error messages, API responses, or screenshots.
- Never store the raw token in public database tables.
- Never expose a token through `VITE_` environment variables.
- Backend responses must return safe metadata only.
- Error handling must sanitize Telegram and Supabase messages before returning
  them to the browser.

## Secret Storage Decision

Preferred Phase 5 approach: use Supabase Vault if it is available in the active
Supabase project and can be accessed from Edge Functions without exposing secret
values to the browser.

Fallback approaches are allowed only if Supabase Vault is unavailable:

- An encrypted private table that is not exposed through public API grants and
  can only be read by Edge Functions through service-role access.
- An external secret manager with per-token references stored in Kyra metadata.

Required storage rules:

- Public database tables must store only `token_secret_ref`.
- Public database tables must never store the raw BotFather token.
- `token_secret_ref` must not be exposed through public views.
- Edge Functions must be the only runtime allowed to resolve token references.
- Frontend code must never receive a resolved token value.
- Token rotation and revocation must be possible without changing public agent
  records.

## Edge Function Plan

### `telegram-connect`

Purpose: connect a user's existing Kyra demo agent to a real Telegram bot.

Expected request:

- `Authorization: Bearer <supabase-access-token>`
- JSON body with `agentId` and transient `botToken`

Required behavior:

- Reject missing or invalid Supabase sessions with `401`.
- Reject malformed request bodies with `400`.
- Validate `agentId` format before querying.
- Use the Supabase Auth user from the bearer token.
- Query `agent_instances` joined through `workspaces`.
- Confirm `workspaces.owner_user_id` matches the authenticated user.
- Reject non-owned agents with `403`.
- Call Telegram `getMe` with the submitted token.
- Confirm the token belongs to a bot account and extract safe metadata:
  `id`, `username`, `first_name`, and capability flags if needed.
- Create or update a backend-only secret reference for the token.
- Upsert `telegram_sessions` with safe metadata and `token_secret_ref`.
- Persist Telegram bot identity, such as `telegram_bot_id`, when schema support
  is explicitly approved.
- Set `agent_instances.telegram_status` to `queued`, `review`, or `active`
  depending on webhook registration state.
- Register the webhook only after token validation and ownership validation
  succeed.
- Return only safe response fields:
  `ok`, `status`, `agentId`, `botHandle`, `webhookStatus`, and a sanitized
  message.

Must not:

- Return the raw token.
- Store the raw token in the database.
- Log the raw request body.
- Log Telegram API URLs containing the token.
- Allow browser-side direct writes to token or webhook fields.

### `telegram-webhook`

Purpose: receive Telegram updates after webhook registration.

Required behavior:

- Prefer Telegram `X-Telegram-Bot-Api-Secret-Token` verification.
- Alternative if the header cannot be used: an unguessable per-session webhook
  path.
- Verify the webhook secret before parsing or processing the request body.
- Never log the request body before webhook verification succeeds.
- Reject requests before parsing or processing if verification fails.
- Resolve the Telegram session without exposing the token.
- Load the bot token only inside backend runtime when needed.
- Reject unknown, paused, or mismatched webhook sessions.
- Parse Telegram updates defensively.
- Ignore or safely reject unsupported update types.
- Route supported text commands to a Kyra command processor.
- Persist safe activity logs without raw tokens, private Telegram payloads, or
  sensitive wallet data.
- Keep onchain execution disabled until the later wallet/Base phase is approved.

Must not:

- Trust user identity from Telegram message text.
- Trigger wallet execution directly.
- Store raw Telegram update payloads if they include private user content.
- Expose bot token, chat IDs, or private message content in public views.

## Chat Authorization Model

Telegram chat access must be explicit before any command is accepted.

Personal agent rules:

- Only the owner-linked Telegram user or chat can issue commands.
- The owner-linking step must be completed through an authenticated Kyra session
  or another approval-first verification flow.
- Unknown chats should receive a safe denial message or no-op response.

Community or project agent rules:

- An explicit allowlist, admin role policy, or project-defined access policy is
  required before commands are accepted.
- Public read-only commands must be separated from write or approval commands.
- Write, admin, or approval commands must never rely only on Telegram display
  name, username, or message text.
- Unknown chats should receive a safe denial message or no-op response.

## DB And Schema Decision

The current schema already has `telegram_sessions`:

- `id`
- `agent_id`
- `bot_handle`
- `webhook_status`
- `token_secret_ref`
- `created_at`
- `last_event_at`

This is enough for demo metadata and may be enough for the first secure connect
prototype if `token_secret_ref` points to a backend-only secret store.

Possible columns needed later:

- `telegram_bot_id`
- `telegram_bot_username`
- `webhook_secret_ref` or `webhook_secret_hash`
- `connected_at`
- `last_webhook_error`
- `last_webhook_error_at`
- `revoked_at`
- `status_reason`

Duplicate bot and reconnect policy:

- Store Telegram bot identity, such as `telegram_bot_id`, when schema changes are
  approved.
- One Telegram bot identity should not be active across multiple workspaces
  unless an explicit transfer flow exists.
- Reconnect must safely revoke the old webhook before activating the new
  session.
- Failed reconnect must not break the existing active session.
- If a reconnect fails after token validation but before webhook activation, the
  prior active session should remain active and the failed attempt should be
  recorded as recoverable.

Schema and RLS impact:

- Any schema migration requires separate explicit approval.
- Any RLS change requires separate explicit approval.
- Authenticated browser users should not receive direct insert or update access
  to Telegram token or webhook metadata.
- Production writes should continue to go through Edge Functions using
  service-role permissions inside the backend only.
- Public views must not expose `token_secret_ref`, webhook secrets, private chat
  identifiers, raw Telegram payloads, or internal errors.

## Rollout Phases

### 1. UI Placeholder

- Add a non-sensitive connection placeholder.
- Show `Telegram demo ready` and `Real Telegram bot not connected`.
- Keep `Connect Telegram` disabled or gated.
- Do not add real token input until backend handling is approved.

### 2. Connect Function

- Implement `telegram-connect`.
- Validate session and agent ownership.
- Validate BotFather token with Telegram `getMe`.
- Store token backend-only and persist only a secret reference.
- Return safe metadata only.

### 3. Webhook Registration

- Generate per-connection webhook secret.
- Register webhook with Telegram after `getMe` succeeds.
- Store webhook status and safe metadata.
- Roll back or mark recoverable status if registration fails.

### 4. Command Processor

- Implement Telegram update parsing.
- Support a narrow command set first.
- Convert commands into Kyra intent records and dashboard-safe activity logs.
- Keep wallet approval and onchain execution simulated until the wallet/Base
  phase is approved.

### 5. Production Smoke

- Verify signed-out connect returns `401`.
- Verify non-owner connect returns `403`.
- Verify invalid BotFather token returns a sanitized error and writes no token
  reference.
- Verify successful connect stores no raw token in DB-visible fields.
- Verify webhook secret verification rejects spoofed requests.
- Verify public agent and dashboard views never display token values.
- Verify no console, API response, activity log, or error message leaks token
  content.
- Verify production still states that wallet execution and onchain actions are
  approval-first and disabled until later approval.

## Explicit Non-Goals For Phase 5A.1

- No code behavior changes.
- No backend implementation.
- No Telegram token input.
- No webhook endpoint.
- No Telegram API calls.
- No schema or RLS migration.
- No Supabase secret changes.
- No production deploy.
- No commit or push without approval.
