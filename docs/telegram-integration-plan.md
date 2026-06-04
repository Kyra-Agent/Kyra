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

## Phase 5C Vault Capability Check

Phase 5C is a capability check and design decision only. It does not enable
Supabase Vault, create or read real secrets, change schema/RLS, implement Edge
Functions, add live token input, register webhooks, or deploy anything.

### Vault Readiness Assessment

- The repo does not currently implement Supabase Vault.
- The repo does not reference `vault.secrets`, `vault.decrypted_secrets`,
  `vault.create_secret()`, `vault.update_secret()`, `supabase_vault`, or
  `pgsodium` in executable code.
- The current schema only has `telegram_sessions.token_secret_ref` for future
  secret references.
- The current schema has `pgcrypto`, but `pgcrypto` is not enough by itself for
  safe per-agent BotFather token storage because Kyra would still need a secure
  key-management and decrypt-access boundary.
- Supabase Vault remains the preferred path if it is available in the active
  Supabase project and can be restricted so only server-side functions can create
  and resolve token references.

### Recommended Path

Use Supabase Vault with a narrow server-side RPC boundary.

Recommended model:

- `telegram-connect` receives the BotFather token only as transient request
  input.
- A server-side database function stores the token with Supabase Vault and
  returns only a Vault secret reference.
- `telegram_sessions.token_secret_ref` stores only the Vault secret reference.
- A separate server-side database function resolves the token reference only for
  trusted Edge Function runtime.
- No frontend code, public view, authenticated browser request, dashboard query,
  or public agent profile can access resolved token values.

Edge Function environment secrets are not suitable for per-agent BotFather
tokens:

- Function secrets are deployment-level configuration, not per-user or per-agent
  records.
- They are not a practical dynamic store for many user-created bot tokens.
- They do not naturally model token rotation, revocation, transfer, or per-agent
  ownership.
- Storing user bot tokens as function env values would mix tenant data with
  infrastructure configuration.
- Function secrets are still appropriate for server runtime configuration such
  as service-role keys, fixed API keys, or feature flags.

### Required Future Approvals

Separate explicit approval is required before any of these steps:

- Enable or apply the Supabase Vault extension.
- Add or modify schema objects for Telegram token references.
- Add or modify RLS policies or grants around Telegram metadata.
- Add database functions/RPCs that create, update, resolve, or revoke Vault
  secrets.
- Grant Edge Function/service-role access to Vault-backed RPCs.
- Add uniqueness constraints or policies for Telegram bot identity.
- Add live BotFather token input to the frontend.
- Call Telegram `getMe` with a real token.
- Register a Telegram webhook.
- Deploy Telegram Edge Functions.

### Can Be Implemented Before Schema Changes

These items can be implemented later before schema/Vault approval, as long as
they remain mocked or non-secret:

- Edge Function skeleton.
- Auth/session validation.
- Ownership validation query design.
- Request/response validators.
- Sanitized error contract.
- Mocked token validator tests.
- Gated UI state.

### Must Not Be Touched Yet

- Do not read `.env.local` or any secret values.
- Do not create or read real secrets.
- Do not change schema or RLS.
- Do not enable or apply the Vault extension.
- Do not call real Telegram `getMe`.
- Do not register webhooks.
- Do not enable live token input.
- Do not commit or push without approval.

## Edge Function Plan

## Phase 5B Backend Design Preflight

Phase 5B preflight is audit and contract design only. It does not add Edge
Functions, token input, Telegram API calls, schema migrations, RLS changes, env
changes, or production deploys.

### Current Edge Function Patterns

The repo currently has two Supabase Edge Function patterns to reuse.

`deploy-agent` pattern:

- Accepts `OPTIONS`, `GET` health checks, and authenticated `POST` requests.
- Reads `Authorization: Bearer <supabase-access-token>` from the request.
- Validates the Supabase session with an anon Supabase client and
  `auth.getUser()`.
- Creates a service-role Supabase client only after session validation.
- Performs production writes through the service-role client, not direct browser
  table writes.
- Returns scoped JSON receipts with safe demo metadata.

`reset-demo-workspace` pattern:

- Accepts `OPTIONS` and authenticated `POST` requests.
- Validates the Supabase session with `auth.getUser()`.
- Validates server-side admin access with
  `user.app_metadata?.role === "admin"`.
- Performs destructive demo reset only through the service-role client.
- Does not accept arbitrary workspace or target user IDs from the browser.
- Returns a scoped receipt without secret values, user emails, or raw internal
  data.

Shared error pattern:

- Uses a small `HttpError` class with `statusCode` and stable `code`.
- Rejects unsupported methods with `405`.
- Rejects missing bearer tokens with `401`.
- Uses `getEnv()` for required Edge Function secrets and returns `missing_env`
  without exposing secret values.
- Sanitizes unknown errors before returning them to the browser.
- Redacts Supabase keys and JWT-like values from error messages.

### `telegram-connect`

Purpose: connect a user's existing Kyra demo agent to a real Telegram bot.

Expected request:

- `Authorization: Bearer <supabase-access-token>`
- JSON body with `agentId`, transient `botToken`, and optional `reconnect`

Proposed request body:

```json
{
  "agentId": "uuid",
  "botToken": "transient BotFather token",
  "reconnect": false
}
```

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

Proposed success response:

```json
{
  "ok": true,
  "status": "queued",
  "message": "Telegram connection validated. Webhook activation is pending.",
  "agentId": "uuid",
  "telegramSessionId": "uuid",
  "bot": {
    "id": "telegram-bot-id",
    "username": "kyra_demo_bot",
    "firstName": "Kyra Demo"
  },
  "webhookStatus": "queued"
}
```

Allowed success statuses:

- `queued`: token validated and session staged, webhook activation pending.
- `active`: token validated and webhook registered.
- `review`: token validated but connection needs manual or policy review.

Proposed error states:

- `400 invalid_request`: malformed JSON, missing fields, invalid `agentId`, or
  unsupported reconnect payload.
- `401 unauthorized`: missing or invalid Supabase bearer token.
- `403 forbidden`: authenticated user does not own the target agent.
- `404 agent_not_found`: target agent does not exist or is not connectable.
- `409 duplicate_bot_active`: Telegram bot identity is already active for
  another workspace.
- `409 reconnect_required`: an active session already exists and reconnect was
  not explicitly requested.
- `422 telegram_validation_failed`: Telegram `getMe` rejected the token or
  returned an unusable bot identity.
- `424 webhook_registration_failed`: token validation succeeded but webhook
  registration failed.
- `429 rate_limited`: connect attempts exceeded a server-side limit.
- `500 missing_env`: required function secret is missing.
- `503 secret_store_unavailable`: Supabase Vault or the approved fallback secret
  store is unavailable.

Must not:

- Return the raw token.
- Store the raw token in the database.
- Log the raw request body.
- Log Telegram API URLs containing the token.
- Allow browser-side direct writes to token or webhook fields.

### `telegram-webhook`

Purpose: receive Telegram updates after webhook registration.

Expected request:

- `POST` from Telegram.
- `X-Telegram-Bot-Api-Secret-Token` header when header verification is used.
- Telegram Update JSON body.

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

Proposed success response:

```json
{
  "ok": true,
  "status": "accepted"
}
```

Allowed webhook statuses:

- `accepted`: verified update was accepted for processing.
- `ignored`: verified update type is unsupported or irrelevant.
- `noop`: verified update produced no state change.

Proposed error states:

- `401 webhook_verification_failed`: missing or invalid webhook secret.
- `404 session_not_found`: webhook secret or path does not map to an active
  Telegram session.
- `409 session_paused`: Telegram session exists but is paused or not accepting
  updates.
- `422 unsupported_update`: update parsed successfully but cannot be handled.
- `500 server_error`: sanitized unexpected backend failure.

Must not:

- Trust user identity from Telegram message text.
- Trigger wallet execution directly.
- Store raw Telegram update payloads if they include private user content.
- Expose bot token, chat IDs, or private message content in public views.

### Phase 5B Security Checks

- Validate Supabase bearer session before creating any write-capable service-role
  client in `telegram-connect`.
- Validate agent ownership with `agent_instances.workspace_id` joined to
  `workspaces.owner_user_id`.
- Do not accept workspace IDs, owner user IDs, or target user IDs from the
  browser.
- Use Telegram `getMe` before storing any token reference or registering any
  webhook.
- Store only a secret reference in Kyra tables; never store or return the raw
  BotFather token.
- Prefer Supabase Vault for token storage. Use an encrypted private table or
  external secret manager only if Vault is unavailable and separately approved.
- Resolve token references only inside Edge Functions.
- Verify webhook secret before reading, parsing, processing, or logging the
  request body.
- Keep public views free of `token_secret_ref`, webhook secrets, chat IDs, raw
  Telegram payloads, and internal errors.
- Require explicit chat authorization before accepting commands.
- Separate read-only public commands from write, admin, or approval commands.
- Prevent one Telegram bot identity from being active in multiple workspaces
  unless a transfer flow is explicitly designed.
- Stage reconnects so a failed reconnect does not break the existing active
  session.

### Files Likely Touched Later

- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/README.md`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/README.md`
- `scripts/check-functions.mjs`
- `src/services/telegramConnectService.ts`
- `src/config/appConfig.ts`
- `src/types/database.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/PublicAgent.tsx`
- `supabase/schema.sql` or a migration file, only after separate schema/RLS
  approval

### What Not To Touch Yet

- Do not implement `telegram-connect`.
- Do not implement `telegram-webhook`.
- Do not add a real BotFather token input.
- Do not add Telegram API calls.
- Do not add, read, or change env values.
- Do not change schema or RLS.
- Do not change quota, auth, deploy, wallet, Base MCP, or onchain execution
  behavior.
- Do not deploy Edge Functions.
- Do not commit or push without approval.

## Phase 5G.4 Ownership Read Boundary Plan

Phase 5G.4 is an audit and design step for the future real ownership lookup in
`telegram-connect`. It does not add a real database query, service-role client,
schema/RLS change, Telegram API call, Vault access, token input, deploy, push,
or production publish.

Current readiness:

- `telegram-connect` already has an inert pure ownership adapter contract for
  `lookupAgentOwnership`.
- The current runtime does not wire a real database lookup yet.
- `workspaces.owner_user_id` and `agent_instances.workspace_id` already exist.
- Existing RLS includes `public.owns_workspace(workspace_id)` and owner-read
  policies.
- The existing backend pattern validates a Supabase bearer session first, then
  creates a service-role client only inside trusted Edge Function runtime.

Recommended future read boundary:

- Keep the browser contract limited to authenticated `agentId` submission.
- Do not accept `workspaceId`, owner user IDs, target user IDs, or ownership
  hints from the browser.
- Validate method, bearer session, content type, body size, JSON shape, and
  `agentId` before any ownership lookup.
- Create a service-role Supabase client only after session validation succeeds.
- Perform a read-only lookup with minimal selected fields.
- Normalize the lookup result into the pure `lookupAgentOwnership` contract.
- Keep the response inert until later approval; an owner match should still
  return `not_configured` while real Telegram connect remains disabled.

Recommended lookup model:

```text
agent_instances.id = agentId
agent_instances.workspace_id -> workspaces.id
workspaces.owner_user_id must equal authenticated user.id
```

Recommended minimal result shape:

```ts
{
  agentId: "uuid",
  workspaceId: "uuid",
  ownerUserId: "uuid"
}
```

The result shape is internal only. API responses must never expose
`ownerUserId`, `workspaceId`, `owner_user_id`, `workspace_id`, raw database
errors, token refs, or secret values.

Implementation choices:

- Prefer a direct service-role read in `telegram-connect` for the first inert
  implementation slice, because existing Edge Functions already use
  service-role clients after session validation.
- Use the narrowest possible select, not `select("*")`.
- If Supabase join typing becomes brittle, use two minimal reads:
  first `agent_instances(id, workspace_id)`, then
  `workspaces(id, owner_user_id)`.
- Consider a database RPC only when ownership lookup grows beyond this simple
  read boundary or when Vault-backed secret operations need a stricter database
  boundary.

Error contract:

- `400 invalid_request`: `agentId` is missing, empty, malformed, or not a
  string.
- `401 unauthorized`: bearer token is missing or Supabase session validation
  fails.
- `404 agent_not_found`: no `agent_instances` row exists for the validated
  `agentId`.
- `403 forbidden`: the agent exists but `workspaces.owner_user_id` does not
  match the authenticated Supabase user.
- `500 server_error`: unexpected ownership lookup failure, with sanitized
  message only.

Security notes:

- The requested `403` versus `404` split intentionally reveals that an agent can
  exist but be non-owned. This is acceptable for the planned owner dashboard
  flow, but should remain documented and should not expose internal row data.
- Public demo agent read policies do not make the connect operation public.
  Connect must still require a signed-in Supabase session and owner match.
- The ownership read slice must not write `telegram_sessions`, update
  `agent_instances`, store tokens, call Telegram, access Vault, or register
  webhooks.

Test plan for the future implementation slice:

- Missing bearer returns `401` before env reads, DB lookup, or body parsing that
  could expose secret data.
- Invalid session returns `401`.
- Missing or malformed `agentId` returns `400` and does not run ownership
  lookup.
- Lookup returns null and maps to `404 agent_not_found`.
- Lookup returns owner mismatch and maps to `403 forbidden`.
- Lookup returns owner match and still returns inert `not_configured`.
- Lookup throws and maps to sanitized `500 server_error`.
- Responses do not include owner IDs, workspace IDs, token refs, raw database
  messages, or secret-like strings.

Files likely touched later:

- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/core.ts`
- `supabase/functions/telegram-connect/index_test.ts`
- `supabase/functions/telegram-connect/README.md`, if documenting the inert
  ownership read behavior.

What not to touch in this phase:

- No real DB read implementation.
- No service-role client wiring in `telegram-connect`.
- No DB writes.
- No schema/RLS changes.
- No Telegram API calls.
- No Vault access.
- No frontend token input.
- No Edge Function deploy.
- No push or production publish.

## Phase 5G.5 Read-Only Ownership Lookup State

Phase 5G.5 wires the first real ownership read boundary into the inert
`telegram-connect` function. It remains preparatory backend work only. It does
not enable real Telegram connection, token validation, token storage, webhook
registration, schema/RLS changes, frontend token input, Edge Function deploy, or
production publish.

Current behavior:

- `telegram-connect` still requires `POST`, bearer auth, JSON content type, body
  size limits, valid Supabase session, and a valid `agentId`.
- `agentId` is validated as a UUID before any ownership lookup.
- After session validation and body validation, the function creates a
  service-role Supabase client inside trusted Edge Function runtime.
- The service-role client is used only for read-only ownership lookup.
- Owner match still returns inert `501 not_configured`.
- There is still no Telegram API call, no `getMe`, no `setWebhook`, no Vault
  access, no DB write, and no token persistence.

Implemented lookup contract:

```text
agent_instances.id = agentId
agent_instances.workspace_id -> workspaces.id
workspaces.owner_user_id must equal authenticated user.id
```

Implemented read shape:

- Read `agent_instances` with `select("id,workspace_id")`.
- If no agent row exists, return `404 agent_not_found`.
- Read `workspaces` with `select("id,owner_user_id")`.
- If the workspace owner does not match the authenticated user, return
  `403 forbidden`.
- If ownership lookup throws unexpectedly, return sanitized
  `500 server_error`.

Response safety rules preserved:

- Do not return `owner_user_id`, `workspace_id`, `ownerUserId`, `workspaceId`,
  raw database errors, `token_secret_ref`, BotFather tokens, or secret-like
  values.
- Do not log request bodies.
- Do not echo `botToken` if a client sends it early.
- Do not filter the ownership query by `owner_user_id` before distinguishing
  `404 agent_not_found` from `403 forbidden`.

Test coverage added:

- Read-only lookup queries `agent_instances` first, then `workspaces`.
- Missing agent maps to `404 agent_not_found`.
- Non-owner maps to `403 forbidden`.
- Owner match remains inert and returns `not_configured`.
- Non-UUID `agentId` maps to `400 invalid_request`.
- Unexpected lookup errors map to sanitized `500 server_error`.
- Responses do not leak owner IDs, workspace IDs, token refs, raw DB errors, or
  submitted BotFather tokens.

Remaining approvals before real Telegram connect:

- BotFather token input UI.
- Supabase Vault or approved fallback secret storage.
- Token validation with Telegram `getMe`.
- Webhook secret generation and registration.
- Any schema/RLS changes, including Telegram bot identity columns.
- Edge Function deploy and production publish.

## Phase 5G.7 Mocked Token Validator Contract State

Phase 5G.7 adds a mockable token validation boundary to the inert
`telegram-connect` core. It does not call Telegram, validate a real BotFather
token, access Vault, store token data, write database records, deploy Edge
Functions, or publish production changes.

Current behavior:

- Runtime remains inert because `telegram-connect/index.ts` does not wire a real
  Telegram validator dependency.
- Requests that do not provide a validator dependency behave as before and
  return `501 not_configured` after auth, body validation, and ownership checks.
- If a test or future approved runtime dependency provides
  `validateTelegramBotToken`, `botToken` is required and shape-checked only
  after session validation, UUID `agentId` validation, and ownership match.
- A successful mocked validator result still returns inert `not_configured`.
- Validator failures map to safe errors without exposing the submitted token or
  raw Telegram URL/message content.

Implemented validator contract:

```ts
validateTelegramBotToken(botToken) -> {
  telegramBotId: string;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
}
```

Implemented error contract:

- `400 invalid_request`: missing, non-string, empty, or malformed `botToken`
  when the validator dependency is enabled.
- `422 telegram_validation_failed`: mocked validator rejects the token or
  returns incomplete bot metadata.
- `500 server_error`: unexpected validator error, returned with a generic
  sanitized message.

Security rules preserved:

- Do not call `api.telegram.org`, `getMe`, or `setWebhook` yet.
- Do not log request bodies or token values.
- Do not return `botToken`, Telegram raw error bodies, Telegram API URLs,
  `token_secret_ref`, owner IDs, or workspace IDs.
- Do not run token validation before the signed-in user owns the target agent.
- Do not persist token or bot metadata yet.

Test coverage added:

- Missing `botToken` maps to `400 invalid_request` only when the mocked
  validator dependency is enabled.
- Malformed `botToken` maps to `400 invalid_request` before validator execution.
- Mocked validator success remains inert and returns `not_configured`.
- Mocked validation rejection maps to `422 telegram_validation_failed`.
- Unexpected validator errors map to sanitized `500 server_error`.
- Non-owner requests do not run token validation.
- Responses do not echo the submitted BotFather token or mocked Telegram bot
  identity.

Remaining approvals before real token validation:

- Real BotFather token input UI.
- Real Telegram `getMe` HTTP client with timeout and sanitized errors.
- Supabase Vault or approved fallback secret storage.
- DB writes for `telegram_sessions.token_secret_ref` and safe bot metadata.
- Schema/RLS changes for persistent Telegram bot identity, if needed.
- Edge Function deploy and production publish.

## Phase 5H Secret Storage And RLS Boundary Plan

Phase 5H is a storage boundary and schema/RLS readiness step. It does not apply
Supabase Vault, create or read real secrets, change schema/RLS, write Telegram
session records, call Telegram, deploy Edge Functions, push commits, or publish
production changes.

Original storage findings:

- The repo does not currently implement Supabase Vault in executable code.
- The repo has `pgcrypto`, but `pgcrypto` alone is not a complete per-agent
  token storage design because it does not define key management, secret
  resolution, or access boundaries.
- `telegram_sessions.token_secret_ref` already exists and is currently written
  as `null` for demo sessions.
- The initial browser path used broad `telegram_sessions` reads and
  `telegram_sessions?select=*`.
- The current safe path uses `telegram_session_summaries` and explicit safe
  columns instead.
- Public agent profile views do not expose `token_secret_ref`.

Important risk before real token storage:

- A real `token_secret_ref` is not the raw BotFather token, but it is still
  sensitive backend metadata.
- A browser session could receive `token_secret_ref` if broad table reads or
  `select=*` dashboard queries are reintroduced after it becomes non-null.
- The safe summary path and tightened grants must stay verified before any real
  secret reference is written.

Recommended Phase 5H storage path:

- Use Supabase Vault as the preferred secret store.
- Put Vault create/update/revoke/resolve behind narrow server-side RPCs.
- Let `telegram-connect` call only the store RPC after session, ownership, and
  real Telegram `getMe` validation succeed.
- Store only the returned opaque `token_secret_ref` in Kyra metadata.
- Allow only trusted Edge Function runtime/service-role paths to resolve a
  `token_secret_ref`.
- Never return a resolved token to browser code, public views, activity logs, or
  API responses.

Recommended schema/RLS boundary:

1. Preferred: expose Telegram connection metadata through a safe view or RPC.
   - Example safe fields: `id`, `agent_id`, `bot_handle`, `webhook_status`,
     `created_at`, `last_event_at`.
   - Exclude `token_secret_ref`, webhook secrets, chat identifiers, raw webhook
     payloads, and internal error details.
   - Keep dashboard reads on the safe view/RPC instead of
     `telegram_sessions?select=*`.

2. Fallback: use column-level grants on `telegram_sessions`.
   - Revoke broad authenticated `select`.
   - Grant authenticated users select only on safe columns.
   - Keep `token_secret_ref` service-role/server-only.
   - This is acceptable but more brittle than a dedicated safe view/RPC.

Required future approvals:

- Enable or apply Supabase Vault.
- Add Vault-backed store/resolve/revoke RPCs.
- Add or modify a safe Telegram session metadata view/RPC.
- Change grants/RLS around `telegram_sessions`, if target verification shows
  drift from the safe model.
- Update dashboard/frontend reads away from `select=*`.
- Add or persist real `token_secret_ref` values.
- Persist Telegram bot identity columns such as `telegram_bot_id`.
- Add webhook secret storage fields or references.

Can be implemented before schema/Vault approval:

- Documentation updates.
- Mocked secret-store adapter interfaces and tests.
- Tests that assert API responses never include `token_secret_ref`.
- Planning for dashboard query narrowing.

Must not be touched yet:

- Do not apply the Vault extension.
- Do not create, read, update, or resolve real secrets.
- Do not change schema or RLS.
- Do not write non-null `token_secret_ref`.
- Do not add live token input.
- Do not call real Telegram `getMe`.
- Do not register webhooks.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5I Telegram `getMe` HTTP Boundary Plan

Phase 5I is the design boundary for a future real Telegram `getMe` client. It
does not implement the client, call Telegram, validate a real token, add token
input, access Vault, store secrets, write database records, deploy Edge
Functions, push commits, or publish production changes.

Current readiness:

- `telegram-connect` already validates method, bearer auth, content type, body
  size, Supabase session, UUID `agentId`, and agent ownership.
- `telegram-connect` already has an optional `validateTelegramBotToken`
  dependency used only by tests and future approved runtime wiring.
- Runtime does not currently wire a real validator, so valid owner requests
  still return inert `501 not_configured`.
- There is no runtime `fetch`, `api.telegram.org`, `getMe`, Vault access, or DB
  write path.

Recommended `getMe` helper boundary:

- Implement the real Telegram client as a small isolated helper, not inline in
  the request handler.
- Accept only a locally shape-checked BotFather token.
- Dependency-inject `fetch` for tests.
- Use `AbortController` and a short timeout.
- Build the Telegram URL inside the helper and never expose it to logs, errors,
  responses, or activity records because the URL contains the token.
- Parse only the minimum Telegram response fields needed for safe bot metadata.
- Return normalized safe metadata only:
  - `telegramBotId`
  - `username`
  - `firstName`
  - `canJoinGroups`
  - `canReadAllGroupMessages`
- Do not persist the normalized metadata until the later storage/schema slice is
  separately approved.

Recommended request order when eventually wired:

1. Method, bearer, content type, and body size guards.
2. Supabase session validation.
3. JSON body parse.
4. UUID `agentId` validation.
5. Read-only ownership lookup.
6. Local `botToken` shape validation.
7. Real Telegram `getMe` call.
8. Return inert `not_configured` until secret storage and DB writes are
   separately approved.

Recommended error mapping:

- `400 invalid_request`: missing, non-string, empty, or malformed `botToken`.
- `422 telegram_validation_failed`: Telegram rejects the token, returns
  unauthorized/not found, returns `ok: false`, or returns incomplete bot
  metadata.
- `429 rate_limited`: Telegram returns rate limit.
- `503 telegram_unavailable`: timeout, network failure, or Telegram 5xx.
- `500 server_error`: unexpected internal failure with a generic sanitized
  message.

Security requirements:

- Never log the raw token.
- Never log the Telegram request URL.
- Never return Telegram raw response bodies to the browser.
- Never include the token in thrown error messages.
- Never persist token or bot metadata in Phase 5I.
- Never call `getMe` before ownership succeeds.
- Never call `setWebhook` from the token validator.
- Keep test fixtures fake and local. Do not use real BotFather tokens.

Test plan for the future implementation slice:

- Successful mocked fetch normalizes Telegram `getMe` response into safe
  metadata.
- `ok: false`, `401`, or `404` maps to `422 telegram_validation_failed`.
- Missing `id`, `username`, or `first_name` maps to
  `422 telegram_validation_failed`.
- `429` maps to `429 rate_limited`.
- Timeout, abort, network error, and Telegram 5xx map to
  `503 telegram_unavailable`.
- Unexpected malformed JSON maps to a sanitized failure.
- Token, request URL, and raw Telegram body never appear in thrown errors or API
  responses.
- Runtime remains inert unless the real validator dependency is explicitly
  wired in a separately approved slice.

Files likely touched later:

- `supabase/functions/telegram-connect/core.ts`
- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/index_test.ts`
- Optional isolated helper:
  `supabase/functions/telegram-connect/telegram-api.ts`
- Optional isolated tests:
  `supabase/functions/telegram-connect/telegram-api_test.ts`
- `supabase/functions/telegram-connect/README.md`
- `docs/telegram-integration-plan.md`

Must not be touched yet:

- Do not implement real `fetch`/`getMe`.
- Do not call Telegram.
- Do not use a real BotFather token.
- Do not add frontend token input.
- Do not access Vault.
- Do not write DB records.
- Do not change schema/RLS.
- Do not register webhooks.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5S.1 Backend `getMe` Runtime Gate Plan

Phase 5S.1 is the runtime gating plan for wiring the existing Telegram `getMe`
helper into `telegram-connect` later. It does not change code behavior, call
Telegram, enable token input, access Vault, write database records, deploy Edge
Functions, push commits, or publish production changes.

Current readiness:

- `telegram-connect` already validates method, bearer auth, JSON content type,
  body size, Supabase session, UUID `agentId`, and read-only agent ownership.
- `validateTelegramBotTokenWithGetMe` exists as an isolated helper with mocked
  tests for successful metadata normalization and safe error mapping.
- The live `telegram-connect` runtime does not currently pass
  `validateTelegramBotToken`, so valid owner requests still return
  `501 not_configured`.
- Frontend BotFather token input exists only behind the default-off
  `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT` flag.

Recommended backend runtime flag:

- Add a backend-only Edge Function flag such as
  `KYRA_TELEGRAM_CONNECT_GETME_ENABLED`.
- The flag must default to off unless its value is exactly `true`.
- When the flag is off, `telegram-connect` must preserve current inert behavior:
  auth, body, and ownership checks may run, but no Telegram API call is made and
  the response remains `501 not_configured`.
- When the flag is on, `telegram-connect` may validate the submitted token with
  `getMe` after ownership succeeds, but it must still return `not_configured`
  until secret storage and metadata persistence are separately approved.
- The frontend token input flag and backend `getMe` flag are separate controls.
  Enabling backend `getMe` must not automatically expose the frontend form in
  production.

Approved future request order for the gated `getMe` slice:

1. `OPTIONS` returns CORS without reading body.
2. `POST` method guard.
3. Bearer authorization guard.
4. JSON content type and body size guards.
5. Supabase session validation.
6. JSON body parse.
7. UUID `agentId` validation.
8. Read-only ownership lookup.
9. Backend `getMe` flag check.
10. If the flag is off, return inert `not_configured`.
11. If the flag is on, locally shape-check `botToken`.
12. Call Telegram `getMe` through the isolated helper.
13. Return safe status only; do not persist token, metadata, or webhook state.

Security requirements for the gated slice:

- Never call `getMe` before session and ownership validation succeed.
- Never read `.env.local` or expose backend flags through `VITE_` values.
- Never log the token, Telegram request URL, Telegram response body, owner ID,
  workspace ID, or `token_secret_ref`.
- Never return the submitted token, Telegram request URL, raw Telegram response,
  owner ID, workspace ID, or `token_secret_ref`.
- Never access Vault, create secrets, resolve secrets, write database records, or
  register webhooks in this slice.
- Keep all tests fake and local; do not use real BotFather tokens.

Expected response behavior:

- Flag off + valid owner request: `501 not_configured`.
- Missing or malformed `botToken` only matters when the backend flag is on:
  `400 invalid_request`.
- Telegram rejected token: `422 telegram_validation_failed`.
- Telegram rate limit: `429 rate_limited`.
- Telegram timeout, network failure, or 5xx: `503 telegram_unavailable`.
- Unexpected internal failure: sanitized `500 server_error`.

Test plan for the implementation slice:

- Flag defaults off and does not call the validator.
- Explicit `KYRA_TELEGRAM_CONNECT_GETME_ENABLED=true` wires the validator after
  ownership succeeds.
- Flag values other than exact `true` remain off.
- Non-owner and missing-agent paths do not call the validator.
- Missing or malformed `botToken` maps to `400 invalid_request` only when the
  flag is on.
- Mocked `getMe` success still returns inert `not_configured`.
- Mocked `getMe` failures map to sanitized `422`, `429`, or `503` responses.
- API responses never include the submitted token, `token_secret_ref`, owner ID,
  workspace ID, Telegram URL, or raw Telegram body.

Files likely touched later:

- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/core.ts`
- `supabase/functions/telegram-connect/index_test.ts`
- `supabase/functions/telegram-connect/README.md`
- `docs/telegram-integration-plan.md`

Still blocked until separate approval:

- Supabase Vault or fallback secret storage.
- Real secret creation/read/update/revoke.
- DB writes to `telegram_sessions`.
- Non-null `token_secret_ref` persistence.
- Webhook secret generation and webhook registration.
- Frontend token input enabled in production.
- Edge Function deployment.
- Push or production publish.

## Phase 5J Secret-Store Adapter Boundary Plan

Phase 5J is the boundary for future backend-only token storage. It does not
apply Supabase Vault, create/read/update/revoke real secrets, write
`telegram_sessions.token_secret_ref`, change schema/RLS, deploy Edge Functions,
push commits, or publish production changes.

Current readiness:

- `telegram-connect` can validate a signed-in owner and has an isolated `getMe`
  helper available for future approved runtime wiring.
- The repo still has no executable Supabase Vault implementation.
- `telegram_sessions.token_secret_ref` exists but is currently `null` for demo
  sessions.
- Dashboard reads use `telegram_session_summaries`, not
  `telegram_sessions?select=*`, so browser-facing reads already use the safe
  metadata path.
- Authenticated table-level select on `telegram_sessions` must remain revoked,
  and `token_secret_ref` column access must remain unavailable to browser roles
  before any non-null secret references are written.

Recommended adapter contract:

- Keep the storage boundary behind a small dependency-injected interface.
- Use mocked implementations and unit tests before any real Vault/RPC wiring.
- Treat `tokenSecretRef` as sensitive backend metadata even though it is not the
  raw BotFather token.
- Never expose raw tokens or resolved token values through responses, logs,
  activity records, frontend state, public views, or dashboard queries.

Proposed adapter shape:

```ts
storeTelegramBotToken({
  agentId,
  ownerUserId,
  telegramBotId,
  botToken
}) -> {
  tokenSecretRef,
  provider
}

resolveTelegramBotToken({ tokenSecretRef }) -> {
  botToken
}

revokeTelegramBotToken({ tokenSecretRef }) -> {
  revoked
}
```

Mocked adapter rules:

- Return an opaque fake `tokenSecretRef`, such as
  `mock_telegram_token_ref_<id>`.
- Do not derive the reference from the raw token.
- Do not include the raw token in thrown errors.
- Do not persist anything.
- Do not call Vault, Supabase, external secret managers, or the database.
- Keep the adapter isolated and not wired into `telegram-connect/index.ts`.

Recommended future real path:

- Prefer Supabase Vault through narrow server-side RPCs.
- `store` creates or rotates a Vault secret and returns only the secret
  reference.
- `resolve` is allowed only in trusted Edge Function runtime paths that need to
  call Telegram.
- `revoke` deletes or deactivates the secret reference before session
  deactivation or transfer.
- Real storage wiring must happen only after the safe Telegram session metadata
  exposure remains verified in the target Supabase project.

Error mapping:

- `503 secret_store_unavailable`: Vault/RPC/secret manager unavailable.
- `500 server_error`: unexpected sanitized storage failure.
- `404 secret_not_found`: future resolve/revoke cannot find an expected secret.
- `409 secret_conflict`: future store detects duplicate or conflicting secret
  state.

Test plan for the mocked adapter:

- Store returns an opaque reference and provider without exposing the token.
- Store does not call external dependencies.
- Resolve returns only to server-side caller tests, never API responses.
- Revoke returns a safe `{ revoked: true }` style result.
- Store/resolve/revoke unexpected errors sanitize token-like strings.
- No tests use real BotFather tokens.
- No runtime file imports the mocked adapter unless separately approved.

Must not be touched yet:

- Do not enable/apply Supabase Vault.
- Do not create/read/update/revoke real secrets.
- Do not add Vault RPCs.
- Do not change schema/RLS.
- Do not write `telegram_sessions.token_secret_ref`.
- Do not wire the adapter into runtime `telegram-connect`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5K Telegram Metadata Persistence Boundary Plan

Phase 5K is the boundary for future Telegram metadata writes. It does not write
`telegram_sessions`, update `agent_instances`, change schema/RLS, persist a real
`token_secret_ref`, wire Vault, call Telegram, deploy Edge Functions, push
commits, or publish production changes.

Current persistence findings:

- `telegram_sessions` already exists with demo-safe fields and
  `token_secret_ref`.
- Demo deploy currently writes `telegram_sessions.token_secret_ref` as `null`.
- Dashboard reads use `telegram_session_summaries` and request only safe fields.
- Production grants should keep broad authenticated table select revoked and
  should keep `token_secret_ref` unavailable to browser roles.
- Public agent profile views do not currently expose `token_secret_ref`.
- The isolated getMe helper and mocked secret-store adapter are not wired into
  the live `telegram-connect` runtime.

Blocking issue before real metadata writes:

- `token_secret_ref` is sensitive backend metadata even though it is not the raw
  BotFather token.
- No real connect flow may write a non-null `token_secret_ref` until safe view
  usage and schema/RLS exposure are verified in the target Supabase project.
- The safe exposure boundary must be approved before any real persistence,
  reconnect, webhook registration, or active Telegram session state.

Recommended safe exposure model:

1. Preferred: keep using a safe view or RPC for browser-facing Telegram session
   metadata.
   - Safe fields: `id`, `agent_id`, `bot_handle`, `webhook_status`,
     `created_at`, and `last_event_at`.
   - Excluded fields: `token_secret_ref`, webhook secrets, chat identifiers,
     raw webhook payloads, internal error details, `owner_user_id`,
     `workspace_id`, and raw DB errors.
   - Dashboard code must continue using this safe view/RPC instead of
     `telegram_sessions?select=*`.

2. Fallback: use column-level grants on `telegram_sessions`.
   - Revoke broad authenticated table select.
   - Grant authenticated users select only on safe columns.
   - Keep `token_secret_ref` accessible only to trusted server-side paths.
   - This is more brittle than a dedicated safe view/RPC and should be used only
     if the view/RPC approach is not practical.

Future write contract for `telegram-connect`:

- Inputs already validated before persistence:
  - signed-in Supabase user ID
  - owner-validated `agentId`
  - normalized Telegram bot metadata from `getMe`
  - opaque `tokenSecretRef` from the approved secret-store boundary
- Write target:
  - upsert one active `telegram_sessions` record for the agent
  - update `agent_instances.telegram_status` only after safe session metadata is
    persisted
- Response to browser:
  - `ok`
  - `status`
  - `agentId`
  - `botHandle`
  - `webhookStatus`
  - optional safe `telegramSessionId`
- Response must never include:
  - raw BotFather token
  - resolved token
  - `token_secret_ref`
  - webhook secret
  - `owner_user_id`
  - `workspace_id`
  - raw DB error

Future duplicate and reconnect policy:

- Persist Telegram bot identity, such as `telegram_bot_id`, only after schema
  approval.
- One Telegram bot identity should not be active across multiple workspaces
  unless an explicit transfer flow is approved.
- Reconnect must not break the existing active session until the new token,
  ownership, bot identity, secret storage, and webhook registration steps all
  pass.
- Failed reconnect should preserve the existing active session and return a
  sanitized recoverable error.
- Old webhook revocation must happen in a controlled step before activating the
  new session.

Recommended implementation order:

1. Verify the safe metadata exposure boundary in the target Supabase project.
2. Add tests that prove browser-facing reads cannot include `token_secret_ref`.
3. Add persistence adapter tests with mocked DB writes only.
4. Wire real metadata writes in `telegram-connect` after token validation and
   secret storage are separately approved.
5. Add reconnect/duplicate bot tests before webhook registration becomes live.

Expected error contract:

- `400 invalid_request`: malformed `agentId` or invalid persistence input.
- `401 unauthorized`: missing or invalid signed-in session.
- `403 forbidden`: signed-in user does not own the agent workspace.
- `404 agent_not_found`: ownership lookup cannot find the agent.
- `409 telegram_bot_conflict`: bot identity is already active elsewhere.
- `409 reconnect_incomplete`: reconnect cannot safely replace the active
  session.
- `503 secret_store_unavailable`: approved secret-store boundary cannot persist
  or rotate the secret reference.
- `500 server_error`: unexpected persistence failure, sanitized.

Test plan before real persistence:

- Browser-facing Telegram session reads exclude `token_secret_ref`.
- Dashboard no longer uses `telegram_sessions?select=*`.
- Persistence response excludes token, `token_secret_ref`, owner/workspace IDs,
  and raw DB errors.
- Successful mocked persistence returns only safe metadata.
- Duplicate bot identity maps to `409 telegram_bot_conflict`.
- Failed reconnect preserves the existing active session.
- Unexpected DB errors map to sanitized `500 server_error`.
- No tests use real BotFather tokens, Vault, Telegram API, or live DB writes.

Files likely touched later:

- `docs/telegram-integration-plan.md`
- `supabase/schema.sql` or a future migration file
- `src/types/database.ts`
- `src/services/supabaseDashboardService.ts`
- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/core.ts`
- `supabase/functions/telegram-connect/index_test.ts`
- Optional persistence helper/tests under `supabase/functions/telegram-connect/`

Must not be touched yet:

- Do not change schema/RLS.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not persist Telegram bot identity.
- Do not wire real secret storage into runtime.
- Do not call real Telegram `getMe` from runtime.
- Do not register or revoke webhooks.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5L Safe Telegram Metadata Exposure Plan

Phase 5L defines and tracks the browser-facing Telegram session metadata
boundary required before real Telegram persistence is enabled. It does not
change schema/RLS, dashboard queries, Edge Functions, token handling, Vault
access, Telegram API calls, deploys, pushes, or production behavior.

Current exposure findings:

- `telegram_sessions` includes `token_secret_ref`.
- RLS limits `telegram_sessions` reads to workspace owners through the existing
  owner policy.
- The approved lockdown path revokes broad authenticated table-level select on
  `telegram_sessions`.
- Authenticated browser reads use `telegram_session_summaries` and explicit safe
  columns.
- Dashboard fetches Telegram session summaries with
  `telegram_session_summaries?select=id,agent_id,bot_handle,webhook_status,created_at,last_event_at`.
- Public agent profile reads use `public_agent_profiles` and do not expose
  `token_secret_ref`.
- The TypeScript frontend uses a local safe row type for browser-facing
  Telegram summaries.

Why this must be fixed before real connect:

- `token_secret_ref` is not the raw BotFather token, but it is still sensitive
  backend metadata.
- Owner-only RLS is not enough for this field because the browser should not
  receive any token reference at all.
- A non-null `token_secret_ref` must not be written until the target Supabase
  project verifies broad table reads are revoked and dashboard reads use the
  safe summary path.

Preferred safe exposure approach:

1. Keep the browser-facing safe view
   `public.telegram_session_summaries`.
2. Use `with (security_invoker = true)` so existing RLS still applies.
3. Keep broad authenticated select on `telegram_sessions` revoked.
4. Grant authenticated select only on safe `telegram_sessions` columns required
   by the view.
5. Grant authenticated select on the safe view.
6. Keep dashboard reads on the safe view with explicit column selection.
7. Keep full table access available only to trusted server-side service-role
   paths.

Proposed safe view fields:

- `id`
- `agent_id`
- `bot_handle`
- `webhook_status`
- `created_at`
- `last_event_at`

Fields that must not be exposed:

- `token_secret_ref`
- raw BotFather token
- resolved token value
- webhook secret or webhook secret reference
- Telegram chat IDs
- raw webhook payloads
- `owner_user_id`
- `workspace_id`
- raw database or internal error details

Reference SQL shape for target verification:

```sql
revoke all privileges on public.telegram_sessions from authenticated;

grant select (
  id,
  agent_id,
  bot_handle,
  webhook_status,
  created_at,
  last_event_at
) on public.telegram_sessions to authenticated;

create or replace view public.telegram_session_summaries
with (security_invoker = true)
as
select
  sessions.id,
  sessions.agent_id,
  sessions.bot_handle,
  sessions.webhook_status,
  sessions.created_at,
  sessions.last_event_at
from public.telegram_sessions sessions;

grant select on public.telegram_session_summaries to authenticated;
grant all on public.telegram_sessions to service_role;
```

Dashboard query target:

```ts
telegram_session_summaries?select=id,agent_id,bot_handle,webhook_status,created_at,last_event_at&agent_id=in.(...)
```

Browser query that must stay absent:

```ts
telegram_sessions?select=*
```

TypeScript impact:

- The frontend uses a safe row type for `telegram_session_summaries`.
- Prefer adding `KyraDatabase["public"]["Views"]` typing if more views will be
  used later.
- Do not reuse `SupabaseTableRow<"telegram_sessions">` for browser-facing
  metadata after the safe view exists, because that table type includes
  `token_secret_ref`.

Verification plan before real token persistence:

- `rg "telegram_sessions\\?select=\\*" src`
- `rg "token_secret_ref" src`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Supabase verifier confirms authenticated users do not have broad
  `telegram_sessions` table select.
- Supabase verifier confirms the safe view excludes `token_secret_ref`.
- Browser/dashboard smoke confirms Telegram demo metadata still renders.

Approval points before real token persistence:

- Schema/RLS approval for any additional grant or view changes.
- Type model approval if `KyraDatabase` gains a `Views` section.
- Production rollout approval before applying SQL to a live Supabase project.

Files likely touched later:

- `docs/telegram-integration-plan.md`
- `supabase/schema.sql` or a future migration file
- `src/types/database.ts`
- `src/services/supabaseDashboardService.ts`

Must not be touched yet:

- Do not change schema/RLS without separate approval.
- Do not apply additional SQL without separate approval.
- Do not write real `token_secret_ref` values.
- Do not wire token storage.
- Do not call Telegram.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5N Supabase-First Rollout Plan

Phase 5N defines the rollout order for the safe Telegram metadata exposure
change. It does not apply SQL, deploy Edge Functions, push commits, unlock
Netlify, publish production, call Telegram, access Vault, or enable real
Telegram behavior.

Current rollout state:

- Local `main` contains a frontend query that expects
  `public.telegram_session_summaries`.
- Local SQL files define `public.telegram_session_summaries` and narrow
  authenticated `telegram_sessions` select grants to safe columns.
- The production site is intentionally held back while Netlify auto publishing
  remains locked.
- Netlify static deploys build and publish `dist`; they do not apply Supabase
  SQL changes.
- Supabase Edge Functions are not deployed automatically by a Netlify static
  deploy unless a separate deployment process is explicitly run.

Main rollout risk:

- If the frontend is published before the Supabase production project has the
  `telegram_session_summaries` view, signed-in dashboard reads can fail.
- If broad `telegram_sessions` select remains active when real
  `token_secret_ref` values are later written, token reference metadata could
  reach the browser.

Required order before production publish:

1. Keep Netlify auto publishing locked.
2. Do not trigger a manual Netlify deploy.
3. Apply the approved SQL changes to the Supabase target project first.
4. Verify the safe view and grants in Supabase.
5. Push the code only after the Supabase dependency is understood and approved.
6. Keep Netlify locked after push until production publish is explicitly
   approved.
7. Publish or unlock Netlify only after Supabase verification passes and deploy
   credits are approved.

Supabase verification requirements:

- `public.telegram_session_summaries` exists.
- The safe view returns only:
  - `id`
  - `agent_id`
  - `bot_handle`
  - `webhook_status`
  - `created_at`
  - `last_event_at`
- The safe view excludes:
  - `token_secret_ref`
  - webhook secrets
  - chat identifiers
  - raw payloads
  - `owner_user_id`
  - `workspace_id`
- Authenticated users can select from `public.telegram_session_summaries`.
- Authenticated users do not have broad table-level select on
  `public.telegram_sessions`.
- Authenticated users do not have insert/update/delete grants on
  `public.telegram_sessions`.
- Service-role access remains available for approved backend-only writes.

Recommended future verifier update:

- Extend `supabase/verify_authenticated_demo_write_lockdown.sql` to check:
  - safe view existence
  - authenticated select privilege on the safe view
  - absence of broad authenticated table select on `telegram_sessions`
  - absence of authenticated access to `telegram_sessions.token_secret_ref`
  - service-role access for backend write paths

Pre-push checklist:

- Working tree clean.
- Local verification passed:
  - `npm exec tsc -- --noEmit`
  - `npm run check:functions`
  - `npm run build`
  - `git diff --check`
  - `rg "telegram_sessions\\?select=\\*" src`
  - `rg "grant select on public\\.telegram_sessions to authenticated" supabase`
- Netlify auto publishing remains locked.
- User explicitly approves push.

Pre-publish checklist:

- Supabase SQL has been applied to the production target project.
- Supabase verifier confirms the safe view/grants.
- Dashboard signed-in smoke can read `telegram_session_summaries`.
- Public agent page still loads through `public_agent_profiles`.
- No live Telegram claims are visible.
- `Connect Telegram` remains disabled or gated until the real connect flow is
  separately approved.
- User explicitly approves spending Netlify deploy/build credits.

What a Netlify publish will not do:

- It will not apply Supabase SQL.
- It will not deploy Supabase Edge Functions.
- It will not create Vault secrets.
- It will not register Telegram webhooks.
- It will not make Telegram live unless frontend and backend runtime behavior
  are separately enabled.

Must not be touched yet:

- Do not push without explicit approval.
- Do not unlock Netlify auto publishing.
- Do not trigger manual Netlify deploy.
- Do not apply Supabase SQL without explicit production approval.
- Do not deploy Telegram Edge Functions.
- Do not create/read/update Vault secrets.
- Do not call Telegram APIs.
- Do not add live token input.

## Phase 5P Local Push Readiness State

Phase 5P confirms the local Phase 5 Telegram preparation stack is safe to push
to GitHub only while Netlify auto publishing remains locked. This state does not
mean production is ready to publish.

Push-ready conditions:

- Working tree is clean before push.
- Local verification has passed for TypeScript, build, Edge Function checks,
  static SQL scans, and diff whitespace checks.
- Telegram runtime remains inert:
  - no live token input is enabled by default
  - any token input UI remains behind an explicit default-off feature flag
  - no Vault access
  - no real token persistence
  - no webhook registration
  - no Telegram API call wired into runtime
- Netlify auto publishing remains locked.
- No manual Netlify deploy is triggered.
- User explicitly approves the push.

Production publish remains blocked until:

- Supabase SQL is applied to the production target project.
- `supabase/verify_authenticated_demo_write_lockdown.sql` confirms the safe
  Telegram metadata view and grants.
- Dashboard smoke confirms `telegram_session_summaries` is readable.
- User explicitly approves spending Netlify build/deploy credits.

Push does not do any of these:

- It does not apply Supabase SQL.
- It does not deploy Supabase Edge Functions.
- It does not unlock or publish Netlify.
- It does not enable real Telegram integration.

## Phase 5R.4 Telegram Token Input Release Gate

The dashboard may contain a gated BotFather token form for local or staged
contract testing, but it must remain disabled by default in production.

Release gate:

- `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT` must default to off.
- The token input may be enabled only by explicitly setting
  `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT=true`.
- Production should keep the placeholder copy visible by default:
  - `Telegram demo ready`
  - `Real Telegram bot not connected`
  - disabled `Connect Telegram`
  - `Coming next`
- Publishing code that contains the hidden form is acceptable only if the
  production environment does not enable the flag.

Why the flag stays off:

- The user-facing connect flow is not complete until Vault or an approved secret
  store is live.
- `telegram-connect` must validate ownership, validate the BotFather token,
  persist only a secret reference, and return safe metadata before users are
  encouraged to submit real tokens.
- Webhook registration and webhook secret verification must be wired and smoked
  before Kyra claims a real Telegram bot is connected.
- Enabling the form too early creates UX risk because users may submit a token
  even though the backend can still return `not_configured`.

Enable checklist:

- Supabase Vault or the approved fallback secret store is available and verified.
- `telegram-connect` stores no raw token in database tables, API responses,
  logs, screenshots, or frontend state.
- `telegram-connect` validates the signed-in user owns the agent before token
  validation or persistence.
- Telegram `getMe` validation is wired with sanitized errors and timeout/rate
  limit handling.
- Webhook registration writes only safe metadata and stores webhook secrets
  backend-only.
- Failed connect attempts leave the previous active session intact.
- Production smoke with a test bot passes.
- Rollback is simple: remove or set
  `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT=false`.

## Phase 5T.1 Vault RPC Rollout Plan

Phase 5T.1 is documentation only. It does not enable Supabase Vault, add RPCs,
change schema/RLS, create/read/update/revoke secrets, write `token_secret_ref`,
wire runtime storage, deploy Edge Functions, push commits, or publish
production.

Current readiness:

- `telegram-connect` can validate signed-in ownership and can optionally validate
  BotFather tokens with `getMe` behind a backend default-off flag.
- Frontend token input remains behind a separate default-off flag.
- Dashboard reads Telegram metadata from `telegram_session_summaries`, not
  `telegram_sessions?select=*`.
- The repo has a mock secret-store adapter contract, but no executable Vault
  implementation.
- The target Supabase project must be verified for Vault support before any real
  secret storage work starts.

Preferred storage architecture:

- Use Supabase Vault for BotFather tokens.
- Keep Vault operations behind narrow server-side RPCs.
- Public tables store only opaque `token_secret_ref` values.
- Edge Functions are the only runtime allowed to call store/resolve/revoke
  boundaries.
- Frontend code, public views, authenticated browser REST calls, dashboard
  queries, and activity logs must never receive raw tokens or resolved token
  values.

Proposed RPC boundary:

```sql
public.store_telegram_bot_token(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_telegram_bot_id text,
  p_bot_token text
) returns text -- token_secret_ref

public.resolve_telegram_bot_token(
  p_token_secret_ref text
) returns text -- raw bot token, Edge Function only

public.revoke_telegram_bot_token(
  p_token_secret_ref text
) returns boolean
```

RPC requirements:

- Use `security definer` with a pinned `search_path`.
- Validate non-empty inputs before touching Vault.
- Create opaque references that are not derived from the raw token.
- Store enough Vault metadata to support ownership audit, rotation, and
  revocation without exposing the token.
- Return only `token_secret_ref` from store.
- Return raw token only from resolve, and only to trusted server-side callers.
- Never raise errors containing the raw token, Vault decrypted value, Telegram
  request URL, owner ID, workspace ID, or raw Vault details.
- Revoke should be idempotent or map missing secrets to a safe
  `secret_not_found`/`false` result, depending on the approved API contract.

Grant model:

- Revoke execute on Vault RPCs from `anon` and `authenticated`.
- Grant execute only to `service_role` or another approved backend-only role.
- Keep `telegram_sessions.token_secret_ref` hidden from browser roles.
- Keep `telegram_session_summaries` as the browser-facing metadata source.
- Verify `service_role` can still insert/update `telegram_sessions` after grants
  are tightened.

Approval gates before implementation:

1. Approve using Supabase Vault in the target project.
2. Approve the SQL migration or manual SQL for Vault extension/RPC setup.
3. Approve grants/RLS changes for RPC execution and Telegram metadata.
4. Approve verifier updates that prove browser roles cannot read
   `token_secret_ref`.
5. Approve runtime wiring in `telegram-connect`.
6. Approve Edge Function deploy.
7. Approve production smoke with a test bot.
8. Approve frontend token input enablement only after backend storage and
   webhook readiness are verified.

Fallback only if Vault is unavailable:

- Encrypted private table:
  - Not exposed through public REST grants.
  - Encryption key managed outside browser-visible config.
  - Access only through service-role Edge Functions or backend-only RPCs.
- External secret manager:
  - Store only opaque references in Kyra metadata.
  - Resolve only inside Edge Functions.
  - Include rotation and revocation operations before production use.

Fallbacks require separate approval and must not be silently substituted for
Vault.

Implementation order when approved:

1. Add docs/tests for expected RPC signatures and sanitized errors.
2. Add SQL migration for Vault extension/RPCs and grants.
3. Extend `supabase/verify_authenticated_demo_write_lockdown.sql` to check:
   - Vault RPC execute is unavailable to `anon`/`authenticated`
   - `service_role` can execute approved RPCs
   - browser roles cannot read `telegram_sessions.token_secret_ref`
   - `telegram_session_summaries` excludes sensitive columns
4. Add an Edge Function secret-store adapter for RPC calls.
5. Unit-test adapter success/failure without real tokens.
6. Wire store after auth, ownership, and `getMe` validation.
7. Write only safe Telegram session metadata plus non-raw `token_secret_ref`.
8. Keep webhook registration separate until secret storage smoke passes.

Required test coverage:

- Store returns only opaque `tokenSecretRef`.
- Store never returns or logs raw token.
- Resolve is not reachable by browser-role calls.
- Revoke handles missing/already-revoked refs safely.
- Unexpected Vault/RPC errors map to sanitized
  `503 secret_store_unavailable` or `500 server_error`.
- API responses never include raw token, resolved token, `token_secret_ref`,
  owner ID, workspace ID, or Vault internals.
- Production verifier proves browser-facing reads stay safe before any non-null
  `token_secret_ref` is written.

Must not be touched until approved:

- Do not enable or apply Supabase Vault.
- Do not create/read/update/revoke real secrets.
- Do not add Vault RPCs.
- Do not modify schema/RLS/grants.
- Do not wire secret-store runtime.
- Do not write non-null `token_secret_ref`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5U.1 Secret Store RPC Adapter Contract Plan

Phase 5U.1 is documentation only. It does not implement a real RPC adapter,
enable Supabase Vault, add SQL functions, change schema/RLS, create/read/update
secrets, wire runtime storage, write `telegram_sessions`, deploy Edge Functions,
push commits, or publish production.

Current audit state:

- `supabase/functions/telegram-connect/secret-store.ts` already defines a
  `TelegramBotTokenSecretStore` interface and a mock in-memory implementation
  for tests.
- The mock store is isolated from `telegram-connect` runtime wiring.
- No executable code currently calls Supabase Vault or a secret-manager RPC.
- `telegram-connect` validates session and ownership before optional `getMe`
  validation.
- Real token persistence is still blocked until Vault/RPC/schema approval.

Recommended next implementation slice:

- Add a pure RPC secret-store adapter that receives an injected RPC client.
- Keep the adapter unmounted from `telegram-connect` runtime until separate
  approval.
- Do not create a Supabase client inside the adapter tests.
- Do not call a live database in tests.
- Do not call Supabase Vault, Telegram, or external secret managers.
- Use mocked RPC responses to prove request/response normalization and error
  sanitization.

Proposed injected RPC client contract:

```ts
type TelegramSecretStoreRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
};
```

Adapter mapping:

- `storeTelegramBotToken(input)` calls `store_telegram_bot_token` with:
  - `p_agent_id`
  - `p_owner_user_id`
  - `p_telegram_bot_id`
  - `p_bot_token`
- `storeTelegramBotToken(input)` returns only:
  - `tokenSecretRef`
  - `provider: "supabase_vault"`
- `resolveTelegramBotToken(input)` calls `resolve_telegram_bot_token` with:
  - `p_token_secret_ref`
- `resolveTelegramBotToken(input)` may return a raw token only to trusted
  backend runtime code, never to a browser response.
- `revokeTelegramBotToken(input)` calls `revoke_telegram_bot_token` with:
  - `p_token_secret_ref`
- `revokeTelegramBotToken(input)` returns only:
  - `revoked`

Sanitization requirements:

- Adapter errors must never include raw BotFather tokens.
- Adapter errors must never include resolved tokens, `token_secret_ref` values,
  owner IDs, workspace IDs, raw RPC errors, Vault internals, or Telegram URLs.
- Invalid local inputs should stay `400 invalid_request`.
- Missing secret refs should map to `404 secret_not_found` only when the RPC
  contract explicitly returns that safe state.
- Vault/RPC availability failures should map to
  `503 secret_store_unavailable`.
- Unexpected adapter failures should map to sanitized `500 server_error` or the
  existing secret-store sanitizer contract.

Tests for the next implementation slice:

- Store calls the expected RPC name with expected argument keys.
- Store returns only an opaque `tokenSecretRef` and provider metadata.
- Store result does not include raw token, owner ID, workspace ID, or Telegram
  bot ID.
- Resolve validates `tokenSecretRef` before calling RPC.
- Resolve returns the raw token only from the backend-only method result.
- Revoke validates `tokenSecretRef` and returns a boolean result.
- RPC errors are sanitized and do not expose raw tokens or raw database errors.
- Adapter tests use mocks only and do not create a Supabase client.
- `telegram-connect` valid runtime path still returns `not_configured` because
  the adapter is not wired yet.

Files likely touched if approved:

- `supabase/functions/telegram-connect/secret-store.ts`
- `supabase/functions/telegram-connect/secret-store_test.ts`
- `supabase/functions/telegram-connect/README.md`
- `docs/telegram-integration-plan.md`

Files not expected to be touched in this slice:

- `supabase/schema.sql`
- `supabase/lockdown_authenticated_demo_writes.sql`
- `supabase/verify_authenticated_demo_write_lockdown.sql`
- `supabase/functions/telegram-connect/index.ts`
- `src/pages/Dashboard.tsx`
- frontend token input files

Verification for the next implementation slice:

- `deno check supabase/functions/telegram-connect/index.ts supabase/functions/telegram-webhook/index.ts`
- `deno test supabase/functions/telegram-connect supabase/functions/telegram-webhook`
- `npm run check:functions`
- `git diff --check`
- Security scan for Vault access, Telegram API calls, DB writes, request body
  logging, token echo, and runtime secret-store wiring.

Must not be touched until separately approved:

- Do not enable or apply Supabase Vault.
- Do not add real SQL RPCs.
- Do not modify schema/RLS/grants.
- Do not create/read/update/revoke real secrets.
- Do not create a live Supabase RPC client path.
- Do not wire the adapter into `telegram-connect` runtime.
- Do not persist `telegram_sessions.token_secret_ref`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5V.1 SQL RPC/Vault Approval Boundary

Phase 5V.1 is documentation only. It does not enable Supabase Vault, add SQL
functions, modify schema/RLS/grants, create/read/update/revoke real secrets,
wire secret-store runtime, deploy Edge Functions, push commits, or publish
production.

Current SQL readiness:

- `telegram_sessions.token_secret_ref` already exists.
- Demo deploy writes `telegram_sessions.token_secret_ref` as `null`.
- Dashboard reads Telegram metadata from `telegram_session_summaries`, not
  `telegram_sessions?select=*`.
- `telegram_session_summaries` excludes `token_secret_ref`, `owner_user_id`, and
  `workspace_id`.
- Authenticated browser grants are limited to safe Telegram session columns.
- `service_role` retains backend-only access needed for approved Edge Function
  writes.
- `supabase/verify_authenticated_demo_write_lockdown.sql` checks safe view
  existence, expected columns, absence of broad authenticated
  `telegram_sessions` table select, absence of authenticated
  `token_secret_ref` column access, and service-role Telegram write access.
- No `store_telegram_bot_token`, `resolve_telegram_bot_token`, or
  `revoke_telegram_bot_token` SQL function exists yet.
- No executable code currently accesses Supabase Vault.

Approved architecture target:

- Use Supabase Vault as the preferred BotFather token store.
- Keep all Vault operations behind narrow backend-only RPCs.
- Store only opaque `token_secret_ref` values in public Kyra metadata tables.
- Let Edge Functions call the RPCs through trusted backend credentials only.
- Never expose raw tokens, resolved tokens, token refs, owner IDs, workspace IDs,
  Vault internals, or raw RPC errors to browser responses or public views.

SQL RPCs that require separate schema approval:

```sql
public.store_telegram_bot_token(
  p_agent_id uuid,
  p_owner_user_id uuid,
  p_telegram_bot_id text,
  p_bot_token text
) returns text

public.resolve_telegram_bot_token(
  p_token_secret_ref text
) returns text

public.revoke_telegram_bot_token(
  p_token_secret_ref text
) returns boolean
```

RPC hardening requirements:

- Use `security definer`.
- Pin `search_path` explicitly.
- Validate non-empty inputs before touching Vault.
- Generate opaque token refs that are not derived from raw tokens.
- Store enough non-secret metadata to support audit, rotation, and revocation.
- Return only `token_secret_ref` from store.
- Return raw token only from resolve and only to backend-only callers.
- Avoid `raise exception` messages that include raw tokens, decrypted Vault
  values, token refs, owner IDs, workspace IDs, Telegram URLs, or Vault internals.
- Prefer idempotent revoke behavior or a safe `secret_not_found` result for
  missing refs.

Grant and RLS requirements:

- Revoke execute on Vault RPCs from `anon`.
- Revoke execute on Vault RPCs from `authenticated`.
- Grant execute only to `service_role` or another explicitly approved
  backend-only role.
- Keep broad authenticated `telegram_sessions` select revoked.
- Keep `telegram_sessions.token_secret_ref` unavailable to browser roles.
- Keep `telegram_session_summaries` as the browser-facing Telegram metadata
  source.
- Preserve `service_role` insert/update access for approved backend writes.

Verifier changes required before real token persistence:

- Check each approved Vault RPC exists.
- Check `anon` cannot execute each Vault RPC.
- Check `authenticated` cannot execute each Vault RPC.
- Check `service_role` can execute each Vault RPC.
- Keep existing checks for safe view existence and expected columns.
- Keep existing checks that browser roles cannot read `token_secret_ref`.
- Keep existing checks that authenticated users do not have insert/update/delete
  grants on `telegram_sessions`.

Approval points before implementation:

1. Confirm Supabase Vault availability in the target Supabase project.
2. Approve the exact SQL migration or manual SQL.
3. Approve RPC signatures and return types.
4. Approve execute grants and browser-role revokes.
5. Approve verifier updates.
6. Apply SQL only after production rollout order is agreed.
7. Verify in Supabase before writing any non-null `token_secret_ref`.
8. Approve runtime wiring after SQL verification passes.

Files likely touched when schema work is approved:

- `supabase/schema.sql` or a dedicated migration file.
- `supabase/lockdown_authenticated_demo_writes.sql` if the production lockdown
  script must carry the RPC/grant model.
- `supabase/verify_authenticated_demo_write_lockdown.sql`.
- `docs/telegram-integration-plan.md`.

Files not expected to be touched by the SQL approval slice:

- `src/pages/Dashboard.tsx`.
- `src/services/telegramConnectService.ts`.
- `supabase/functions/telegram-connect/index.ts`.
- `supabase/functions/telegram-connect/secret-store.ts`.
- `supabase/functions/telegram-webhook/index.ts`.

Must not be touched yet:

- Do not apply Supabase Vault.
- Do not create/read/update/revoke real secrets.
- Do not add SQL RPCs without explicit schema approval.
- Do not modify RLS/grants without explicit schema approval.
- Do not wire the RPC adapter into runtime.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not enable frontend token input in production.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5W.1 Vault RPC Verifier Design

Phase 5W.1 is documentation only. It does not edit verifier SQL, add Vault RPCs,
change schema/RLS/grants, enable Supabase Vault, create/read/update/revoke
secrets, wire runtime storage, deploy Edge Functions, push commits, or publish
production.

Current verifier state:

- `supabase/verify_authenticated_demo_write_lockdown.sql` checks table, column,
  view, policy, and service-role write readiness for Telegram metadata.
- It already checks that authenticated users do not have broad
  `telegram_sessions` table select.
- It already checks that authenticated users cannot select
  `telegram_sessions.token_secret_ref`.
- It already checks that `telegram_session_summaries` exists and excludes
  sensitive fields.
- It does not yet check function existence or execute privileges for future
  Vault RPCs.
- The Vault RPCs do not exist yet, so verifier changes must be clear about
  whether missing RPCs are expected or a blocker.

Recommended verifier approach:

- Use `to_regprocedure(...)` to detect whether each approved RPC exists.
- Use `has_function_privilege(...)` only when the RPC exists, so the verifier
  does not fail by referencing a missing function.
- Report explicit booleans for each RPC:
  - function exists
  - `anon` cannot execute
  - `authenticated` cannot execute
  - `service_role` can execute
- Keep the existing Telegram metadata checks unchanged.
- Treat missing RPCs as acceptable before schema approval and as blockers only
  after the Vault SQL rollout is approved.

Proposed function signatures for verifier checks:

```sql
public.store_telegram_bot_token(uuid, uuid, text, text)
public.resolve_telegram_bot_token(text)
public.revoke_telegram_bot_token(text)
```

Recommended check shape:

```sql
case
  when to_regprocedure('public.store_telegram_bot_token(uuid, uuid, text, text)') is null then false
  else not has_function_privilege(
    'authenticated',
    'public.store_telegram_bot_token(uuid, uuid, text, text)',
    'execute'
  )
end as auth_cannot_execute_store_telegram_bot_token
```

The same missing-RPC-safe pattern should be used for `anon`, `authenticated`,
and `service_role` across all three RPCs. `PUBLIC` execute defaults should be
detected through function ACL metadata, because PostgreSQL `PUBLIC` is a
pseudo-role rather than a normal login role.

Recommended columns to add after schema approval:

- `store_telegram_bot_token_function_exists`
- `public_cannot_execute_store_telegram_bot_token`
- `anon_cannot_execute_store_telegram_bot_token`
- `auth_cannot_execute_store_telegram_bot_token`
- `service_role_can_execute_store_telegram_bot_token`
- `resolve_telegram_bot_token_function_exists`
- `public_cannot_execute_resolve_telegram_bot_token`
- `anon_cannot_execute_resolve_telegram_bot_token`
- `auth_cannot_execute_resolve_telegram_bot_token`
- `service_role_can_execute_resolve_telegram_bot_token`
- `revoke_telegram_bot_token_function_exists`
- `public_cannot_execute_revoke_telegram_bot_token`
- `anon_cannot_execute_revoke_telegram_bot_token`
- `auth_cannot_execute_revoke_telegram_bot_token`
- `service_role_can_execute_revoke_telegram_bot_token`

Verifier interpretation:

- Before schema approval:
  - RPC existence checks may be `false`.
  - This confirms real Vault storage is not enabled yet.
  - Browser safety checks for `telegram_sessions` and
    `telegram_session_summaries` must still pass.
- After schema approval:
  - All RPC existence checks must be `true`.
  - All `public_cannot_execute_*` checks must be `true`.
  - All `anon_cannot_execute_*` checks must be `true`.
  - All `auth_cannot_execute_*` checks must be `true`.
  - All `service_role_can_execute_*` checks must be `true`.
  - Browser safety checks must still pass before any non-null
    `token_secret_ref` is written.

Security priority:

- `resolve_telegram_bot_token` is the most sensitive RPC because it returns a
  raw BotFather token to backend runtime.
- `resolve_telegram_bot_token` must never be executable by `anon` or
  `authenticated`.
- `store_telegram_bot_token` must never be executable by browser roles because
  browser roles could otherwise create secrets outside the Edge Function
  validation path.
- `revoke_telegram_bot_token` must also stay backend-only to avoid user-triggered
  deletion of unrelated token refs.

Files likely touched if verifier implementation is approved:

- `supabase/verify_authenticated_demo_write_lockdown.sql`
- `docs/telegram-integration-plan.md`

Files not expected to be touched by verifier-only implementation:

- `supabase/schema.sql`
- `supabase/lockdown_authenticated_demo_writes.sql`
- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/secret-store.ts`
- frontend files

Verification for verifier-only implementation:

- Static inspect `supabase/verify_authenticated_demo_write_lockdown.sql`.
- `git diff --check`.
- `rg "store_telegram_bot_token|resolve_telegram_bot_token|revoke_telegram_bot_token" supabase/verify_authenticated_demo_write_lockdown.sql`.
- If run in Supabase before RPC creation, confirm RPC existence checks are
  `false` and existing browser-safety checks still pass.
- If run after approved RPC creation, confirm the expected function/grant booleans
  are all `true`.

Must not be touched yet:

- Do not apply Supabase Vault.
- Do not create or alter SQL RPCs.
- Do not change RLS or grants.
- Do not create/read/update/revoke real secrets.
- Do not wire runtime storage.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5X.1 Vault SQL Migration Draft Boundary

Phase 5X.1 is documentation only. It does not add a migration file, edit
`schema.sql`, edit lockdown SQL, enable Supabase Vault, create SQL RPCs, change
schema/RLS/grants, create/read/update/revoke secrets, wire runtime storage,
deploy Edge Functions, push commits, or publish production.

Current migration readiness:

- The repo has no formal `supabase/migrations` directory.
- SQL is currently maintained as focused root-level Supabase SQL files such as
  `schema.sql`, `lockdown_authenticated_demo_writes.sql`, and verifier scripts.
- `telegram_sessions.token_secret_ref` already exists for future backend-only
  secret references.
- `telegram_session_summaries` is the browser-facing Telegram metadata source
  and excludes `token_secret_ref`.
- `supabase/verify_authenticated_demo_write_lockdown.sql` can now check future
  Vault RPC existence and execute grants without failing when the RPCs are
  missing.
- The Edge Function secret-store adapter expects plain return values from RPCs:
  text for `store`, text for `resolve`, and boolean for `revoke`.
- No executable code currently accesses Supabase Vault.

Recommended migration delivery shape:

- Do not place unverified Vault SQL directly into `schema.sql` first.
- Prefer a dedicated draft file after explicit approval, for example:
  `supabase/telegram_vault_rpc_draft.sql`.
- Keep the draft clearly marked as not applied and not production-ready until it
  is verified against the target Supabase project.
- After the SQL is verified and approved, decide whether to fold it into
  `schema.sql`, keep it as a separate production runbook SQL file, or convert it
  into a formal migration if the project adopts a migration directory.

Vault capability assumptions to verify before writing SQL:

- The target Supabase project supports Supabase Vault.
- The Vault extension can be enabled with the expected extension name and schema.
- `vault.create_secret(...)` is available and returns a secret identifier.
- `vault.decrypted_secrets` exists after Vault is enabled.
- The target project supports the expected Vault update/revoke/delete operation
  or an approved alternative for revocation.
- Access to decrypted secrets can be constrained to backend-only SQL execution.

Draft SQL responsibilities when approved:

1. Enable or require Supabase Vault in the target project.
2. Create `public.store_telegram_bot_token(...)`.
3. Create `public.resolve_telegram_bot_token(...)`.
4. Create `public.revoke_telegram_bot_token(...)`.
5. Revoke execute on all three RPCs from `anon`.
6. Revoke execute on all three RPCs from `authenticated`.
7. Grant execute on all three RPCs only to `service_role` or another approved
   backend-only role.
8. Preserve browser-safe `telegram_sessions` and `telegram_session_summaries`
   grants.
9. Keep verifier checks passing before any non-null `token_secret_ref` is
   written.

RPC implementation constraints:

- Use `security definer`.
- Pin `search_path` explicitly.
- Validate inputs before touching Vault.
- Generate opaque refs that are not derived from raw tokens or user IDs.
- Do not store raw BotFather tokens in public tables.
- Do not return owner IDs, workspace IDs, raw tokens, decrypted values, Vault
  internals, or Telegram URLs from error messages.
- Return only `token_secret_ref` from `store_telegram_bot_token`.
- Return raw token only from `resolve_telegram_bot_token`.
- Return a boolean from `revoke_telegram_bot_token`.
- Keep `resolve_telegram_bot_token` backend-only because it returns the raw
  BotFather token.

Adapter compatibility requirements:

- `store_telegram_bot_token` must accept:
  - `p_agent_id uuid`
  - `p_owner_user_id uuid`
  - `p_telegram_bot_id text`
  - `p_bot_token text`
- `store_telegram_bot_token` must return a text value compatible with
  `assertTokenSecretRef`.
- `resolve_telegram_bot_token` must accept:
  - `p_token_secret_ref text`
- `resolve_telegram_bot_token` must return a non-empty text token only to
  backend runtime.
- `revoke_telegram_bot_token` must accept:
  - `p_token_secret_ref text`
- `revoke_telegram_bot_token` must return boolean.

Open decisions before SQL implementation:

- Exact Vault extension enable statement for the target project.
- Exact Vault secret naming scheme.
- Whether `token_secret_ref` is a Vault UUID, a prefixed opaque ref, or another
  backend-only reference format.
- How revocation maps to Vault operations in the target Supabase project.
- Whether to keep a separate backend-only metadata table for ownership audit,
  rotation, and revocation.
- Whether duplicate bot identity enforcement requires new columns such as
  `telegram_bot_id` before production live connect.

Approval gates before SQL draft implementation:

1. Approve creating a draft SQL file.
2. Approve the target Vault API assumptions.
3. Approve whether a backend-only metadata table is needed.
4. Approve exact RPC signatures and return shapes.
5. Approve grant model and verifier expected results.
6. Approve whether this remains a standalone SQL runbook or becomes part of
   `schema.sql`.

Verification plan after SQL draft exists:

- Static scan that draft SQL contains no raw tokens.
- Static scan that execute grants are backend-only.
- `git diff --check`.
- `rg "grant execute on function public\\.(store|resolve|revoke)_telegram_bot_token" supabase`.
- Run verifier in a Supabase target only after SQL approval.
- Confirm all RPC existence checks are `true`.
- Confirm all browser-role execute-deny checks are `true`.
- Confirm all service-role execute checks are `true`.
- Confirm browser roles still cannot read `telegram_sessions.token_secret_ref`.

Must not be touched yet:

- Do not create a migration or draft SQL file yet.
- Do not edit `schema.sql` or lockdown SQL.
- Do not enable or apply Supabase Vault.
- Do not create SQL RPCs.
- Do not modify RLS or grants.
- Do not create/read/update/revoke real secrets.
- Do not wire runtime storage.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5X.3 Vault SQL Draft Technical Decisions

Phase 5X.3 is documentation only. It does not create a SQL draft file, edit
`schema.sql`, edit lockdown SQL, enable Supabase Vault, create SQL RPCs, change
schema/RLS/grants, create/read/update/revoke secrets, wire runtime storage,
deploy Edge Functions, push commits, or publish production.

Recommended `token_secret_ref` format:

- Use a prefixed opaque reference rather than a raw Vault UUID.
- Preferred shape: `vault:telegram:<uuid>` or another explicitly approved
  provider-prefixed equivalent.
- The ref must not be derived from the raw BotFather token, owner ID, workspace
  ID, Telegram bot username, or chat ID.
- The ref must remain compatible with the current `assertTokenSecretRef`
  validator.
- The browser must never receive `token_secret_ref`, even though it is not the
  raw token.

Recommended backend-only metadata:

- Add a backend-only mapping table in the draft SQL if real Vault storage moves
  forward.
- The metadata table should not be exposed through public views or browser
  grants.
- Minimum useful fields:
  - `token_secret_ref`
  - `vault_secret_id`
  - `agent_id`
  - `owner_user_id`
  - `telegram_bot_id`
  - `created_at`
  - `revoked_at`
- This table supports audit, rotation, revoke, duplicate-bot checks, and future
  reconnect handling without exposing raw tokens.

Recommended duplicate bot policy:

- Do not claim production-ready live Telegram connect until Telegram bot
  identity is persisted and checked.
- `telegram_bot_id` should be treated as the stable duplicate-detection key.
- One Telegram bot identity should not be active across multiple workspaces
  unless a separate transfer flow is approved.
- A storage-only Vault RPC can exist before duplicate enforcement, but runtime
  live connect must not activate a session until duplicate-bot handling is
  implemented.
- If duplicate enforcement requires schema changes on `telegram_sessions`, those
  changes require separate approval.

Recommended reconnect policy:

- Failed reconnect must not break the existing active session.
- New token validation and secret storage should be staged before replacing an
  active token ref.
- Revoke should be safe and either idempotent or return a sanitized `false` for
  inactive refs.
- Revoke must not leak whether a token ref belongs to another owner or workspace.
- Webhook revocation and webhook registration remain a later phase and should
  not be bundled into the first Vault storage SQL draft.

Recommended SQL draft scope:

- The first draft should focus on Vault-backed token store/resolve/revoke
  boundaries and backend-only metadata.
- It should not wire runtime behavior.
- It should not register webhooks.
- It should not add frontend token input behavior.
- It should not write `telegram_sessions.token_secret_ref` from live code.
- It should not attempt production duplicate-bot enforcement unless the required
  metadata and constraints are explicitly included and approved.

Open decisions before creating the SQL draft:

- Confirm the exact Vault extension statement in the target Supabase project.
- Confirm whether Vault secret IDs should be stored as UUIDs internally and
  exposed to Edge Functions only through prefixed refs.
- Confirm whether `telegram_bot_id` should live only in backend-only metadata
  first or also be added to `telegram_sessions`.
- Confirm whether active duplicate-bot uniqueness belongs in SQL constraints,
  RPC logic, or both.
- Confirm whether `revoked_at` is enough for lifecycle state or whether an
  explicit `status` column is needed.

Must not be touched yet:

- Do not create the draft SQL file yet.
- Do not apply Supabase Vault.
- Do not create metadata tables.
- Do not create SQL RPCs.
- Do not add `telegram_bot_id` columns or constraints.
- Do not modify RLS or grants.
- Do not create/read/update/revoke real secrets.
- Do not wire runtime storage.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5X.6 Vault SQL Migration Approval Checklist

Phase 5X.6 is documentation only. It does not edit executable SQL, apply
Supabase Vault, create SQL RPCs, change schema/RLS/grants, create/read/update/
revoke secrets, wire runtime storage, deploy Edge Functions, push commits, or
publish production.

Current state after the draft artifact:

- `supabase/telegram_vault_rpc_draft.sql` exists as a comment-only review
  artifact.
- The draft is intentionally inert and must remain marked `DRAFT ONLY - DO NOT
  APPLY` until a separate approval converts it into executable SQL.
- `supabase/verify_authenticated_demo_write_lockdown.sql` can inspect the
  future Telegram Vault RPC names without failing while the functions are
  missing.
- The historical Phase 5X.1 and Phase 5X.3 notes that say not to create a draft
  SQL file are superseded by this current state section; they remain useful as
  phase history.

Required approvals before executable SQL exists:

1. Supabase Vault availability and exact extension/API names.
2. Whether the metadata table is `public.telegram_bot_token_secrets` or another
   approved backend-only table.
3. Metadata columns, including `token_secret_ref`, `vault_secret_id`,
   `agent_id`, `owner_user_id`, `telegram_bot_id`, `created_at`, and
   `revoked_at`.
4. Exact `token_secret_ref` format, preferably a prefixed opaque value such as
   `vault:telegram:<uuid>`.
5. Duplicate bot identity policy for active `telegram_bot_id` rows.
6. Reconnect and revoke behavior, including failed reconnect rollback.
7. Function signatures and return shapes for store, resolve, and revoke.
8. Grant model and verifier expected results.
9. Whether the SQL remains a manual runbook file or becomes a formal migration.
10. Exact production rollout timing, including Edge Function deploy and Netlify
    publish approval.

Function privilege checklist:

- Executable SQL must revoke `execute` from `public`, not only from `anon` and
  `authenticated`.
- Executable SQL must revoke `execute` from `anon`.
- Executable SQL must revoke `execute` from `authenticated`.
- Executable SQL must grant `execute` only to `service_role` or another
  separately approved backend-only role.
- `resolve_telegram_bot_token` is the most sensitive RPC because it returns a
  decrypted BotFather token to backend runtime; it must never be browser-callable.
- Verifier coverage includes `public` execute-deny checks so default PostgreSQL
  function execute privileges are detected before any real token ref is written.

Executable SQL safety checklist:

- Use `security definer` only with an explicit pinned `search_path`.
- Validate all inputs before touching Vault or metadata.
- Do not derive `token_secret_ref` from user IDs, workspace IDs, Telegram
  usernames, chat IDs, or raw BotFather tokens.
- Store raw BotFather tokens only in Vault or an explicitly approved secret
  manager.
- Store only opaque refs and safe metadata in Kyra tables.
- Never return raw tokens, resolved tokens, `token_secret_ref`, owner IDs,
  workspace IDs, Vault internals, Telegram URLs, or raw DB errors in API
  responses.
- Keep metadata table access backend-only; browser roles must not read or write
  it directly.
- Keep `telegram_sessions.token_secret_ref` unavailable to browser roles before
  any non-null ref is written.

Verification checklist before any approved apply:

- Static scan the SQL for accidental raw tokens or secret-like test values.
- Static scan grant statements for `revoke execute ... from public`, `anon`, and
  `authenticated`.
- Static scan grant statements for service-role-only execute grants.
- Run `git diff --check`.
- Run the Supabase verifier before applying and capture the current baseline.
- Apply only after explicit approval in the target Supabase project.
- Run the Supabase verifier after applying.
- Confirm all Telegram Vault RPC existence checks are `true`.
- Confirm browser-role execute-deny checks are `true`.
- Confirm service-role execute checks are `true`.
- Confirm browser roles still cannot read `telegram_sessions.token_secret_ref`.
- Do not write any non-null `token_secret_ref` until the verifier passes.

Go/no-go boundary:

- Go: keep refining the comment-only draft and docs.
- Go: add future verifier checks for `public` execute denial after approval.
- No-go: executable SQL, Vault apply, schema/RLS changes, runtime storage,
  token input, Telegram API calls, Edge Function deploy, Netlify publish, or push
  without separate approval.

## Phase 5Y.1 Executable SQL Readiness Packet

Phase 5Y.1 is documentation only. It does not convert the draft into executable
SQL, apply Supabase Vault, change schema/RLS/grants, create/read/update/revoke
secrets, enable runtime gates, wire token persistence, deploy Edge Functions,
push commits, or publish production.

Readiness summary:

- `supabase/telegram_vault_rpc_draft.sql` is a comment-only artifact and remains
  `DRAFT ONLY - DO NOT APPLY`.
- `supabase/verify_authenticated_demo_write_lockdown.sql` can verify future
  Telegram Vault RPC existence and execute boundaries.
- The verifier now covers `public`, `anon`, `authenticated`, and `service_role`
  execute outcomes.
- `telegram-connect` has gated helper code for future `getMe` validation and
  RPC-based secret storage, but those paths must remain inactive until SQL,
  Vault, and deployment approvals are complete.
- `telegram_sessions.token_secret_ref` must stay `null` for demo rows and must
  not be written with a real ref until post-apply verification passes.
- `supabase/telegram_vault_rpc_review_draft.sql` was created as a local SQL
  review draft and later applied manually in Phase 5Z after explicit approval.

Manual Supabase confirmations required before executable SQL:

1. Confirm Supabase Vault is available in the target project.
2. Confirm the exact Vault extension statement and schema name.
3. Confirm `vault.create_secret(...)` is available and returns a UUID secret
   identifier in the target project.
4. Confirm `vault.decrypted_secrets` is available and exposes
   `decrypted_secret` only to approved backend-only SQL paths.
5. Confirm whether `vault.update_secret(...)` should remain out of the first
   approved SQL apply. The current review draft does not call it.
6. Treat physical Vault delete/revoke as unverified until the target project
   proves an approved delete path exists.
7. Confirm the exact approved revocation alternative before any executable
   revoke SQL exists.
8. Confirm the data type returned by Vault for secret identifiers.
9. Confirm whether `public.telegram_bot_token_secrets` is the approved metadata
   table name.
10. Confirm the partial unique index or RPC logic for active `telegram_bot_id`
   duplicate prevention.
11. Confirm whether `revoked_at` is enough lifecycle state or whether a `status`
   column is required.
12. Confirm the runbook/migration delivery format before any SQL is copied into a
   Supabase SQL editor.

Verified Vault API assumptions from official docs:

- `vault.create_secret(...)` creates a secret and returns the new secret UUID.
- `vault.decrypted_secrets` is the decrypted view and includes
  `decrypted_secret`.
- `vault.update_secret(...)` updates an existing secret by UUID, but the current
  review draft does not depend on it.
- Access to `vault.decrypted_secrets` must be tightly protected because access
  to the view exposes decrypted secret values.
- No approved `vault.delete_secret(...)` or `vault.revoke_secret(...)` function
  is assumed for Kyra until the target Supabase project proves it exists and is
  safe to use.

Revoke v1 decision:

- `revoke_telegram_bot_token` should be metadata-first.
- The minimum safe behavior is to mark Kyra metadata `revoked_at` and stop
  resolving that `token_secret_ref`.
- Optional Vault sanitization via `vault.update_secret(...)` is deferred to a
  later approval and is not part of the current review draft.
- Physical deletion from `vault.secrets` is out of scope until separately
  approved.
- Reconnect must still avoid breaking the existing active session until the new
  token and session state are fully validated.

Do not enable runtime gates yet:

- Do not set or enable `KYRA_TELEGRAM_CONNECT_GETME_ENABLED=true` in production.
- Do not enable any future token persistence gate.
- Do not expose frontend BotFather token input.
- Do not deploy `telegram-connect` with live token storage behavior.
- Do not deploy `telegram-webhook` with live command processing.
- Do not write non-null `telegram_sessions.token_secret_ref`.

Expected verifier booleans after an approved SQL apply:

- `store_telegram_bot_token_function_exists` must be `true`.
- `public_cannot_execute_store_telegram_bot_token` must be `true`.
- `anon_cannot_execute_store_telegram_bot_token` must be `true`.
- `auth_cannot_execute_store_telegram_bot_token` must be `true`.
- `service_role_can_execute_store_telegram_bot_token` must be `true`.
- `resolve_telegram_bot_token_function_exists` must be `true`.
- `public_cannot_execute_resolve_telegram_bot_token` must be `true`.
- `anon_cannot_execute_resolve_telegram_bot_token` must be `true`.
- `auth_cannot_execute_resolve_telegram_bot_token` must be `true`.
- `service_role_can_execute_resolve_telegram_bot_token` must be `true`.
- `revoke_telegram_bot_token_function_exists` must be `true`.
- `public_cannot_execute_revoke_telegram_bot_token` must be `true`.
- `anon_cannot_execute_revoke_telegram_bot_token` must be `true`.
- `auth_cannot_execute_revoke_telegram_bot_token` must be `true`.
- `service_role_can_execute_revoke_telegram_bot_token` must be `true`.
- Browser-facing Telegram session checks must still prove `token_secret_ref`,
  owner IDs, workspace IDs, and other sensitive fields are not exposed.

Abort criteria:

- Abort if the Vault extension/API names differ from the assumptions in the
  draft.
- Abort if `vault.create_secret(...)` or `vault.decrypted_secrets` are
  unavailable.
- Abort if the review draft unexpectedly depends on `vault.update_secret(...)`,
  `vault.delete_secret(...)`, or `vault.revoke_secret(...)`.
- Abort if executable SQL assumes physical Vault delete/revoke without a proven
  target-project API.
- Abort if any browser role can execute `store`, `resolve`, or `revoke`.
- Abort if `service_role` cannot execute all three RPCs.
- Abort if `telegram_session_summaries` exposes `token_secret_ref`,
  `owner_user_id`, or `workspace_id`.
- Abort if the metadata table is browser-readable or browser-writable.
- Abort if any SQL error output or verifier output includes raw token-like test
  values.
- Abort before writing any non-null `token_secret_ref`.

Completed Phase 5Z approval slice:

- `supabase/telegram_vault_rpc_review_draft.sql` was reviewed before apply.
- Static scans were run before Supabase apply.
- The SQL was applied manually only after explicit approval.
- Verifier output was captured immediately after apply.

Manual Supabase apply checklist used for the current review draft:

1. Confirm Netlify publish/deploy remains intentionally separate from SQL apply.
2. Confirm no runtime gates are enabled before SQL apply.
3. Run `supabase/verify_authenticated_demo_write_lockdown.sql` first and capture
   the baseline.
4. Confirm the baseline still shows browser-safe Telegram session visibility.
5. Confirm the baseline shows the Telegram Vault RPC existence checks as
   `false` before apply.
6. Review `supabase/telegram_vault_rpc_review_draft.sql` in full before copying
   it into Supabase SQL editor.
7. Apply only the approved SQL review draft.
8. Run `supabase/verify_authenticated_demo_write_lockdown.sql` immediately after
   apply.
9. Confirm every `*_function_exists` check for store, resolve, and revoke is
   `true`.
10. Confirm every `public_cannot_execute_*`, `anon_cannot_execute_*`, and
    `auth_cannot_execute_*` check is `true`.
11. Confirm every `service_role_can_execute_*` check is `true`.
12. Confirm `auth_can_select_telegram_token_secret_ref` remains `false`.
13. Confirm `telegram_session_summaries_excludes_sensitive_columns` remains
    `true`.
14. Do not write non-null `telegram_sessions.token_secret_ref` until all post
    apply checks pass.

## Phase 5Z Supabase Vault RPC Apply Result

Phase 5Z applied the approved Telegram Vault RPC SQL manually in the target
Supabase project. The SQL editor reported `Success. No rows returned`.

Post-apply verifier result:

- `store_telegram_bot_token_function_exists` is `true`.
- `public_cannot_execute_store_telegram_bot_token` is `true`.
- `anon_cannot_execute_store_telegram_bot_token` is `true`.
- `auth_cannot_execute_store_telegram_bot_token` is `true`.
- `service_role_can_execute_store_telegram_bot_token` is `true`.
- `resolve_telegram_bot_token_function_exists` is `true`.
- `public_cannot_execute_resolve_telegram_bot_token` is `true`.
- `anon_cannot_execute_resolve_telegram_bot_token` is `true`.
- `auth_cannot_execute_resolve_telegram_bot_token` is `true`.
- `service_role_can_execute_resolve_telegram_bot_token` is `true`.
- `revoke_telegram_bot_token_function_exists` is `true`.
- `public_cannot_execute_revoke_telegram_bot_token` is `true`.
- `anon_cannot_execute_revoke_telegram_bot_token` is `true`.
- `auth_cannot_execute_revoke_telegram_bot_token` is `true`.
- `service_role_can_execute_revoke_telegram_bot_token` is `true`.
- `auth_can_select_telegram_token_secret_ref` remains `false`.
- `auth_cannot_select_full_telegram_sessions` remains `true`.
- `auth_has_no_broad_telegram_sessions_select_grant` remains `true`.
- `telegram_session_summaries_view_exists` remains `true`.
- `telegram_session_summaries_excludes_sensitive_columns` remains `true`.
- `telegram_session_summaries_has_expected_columns` remains `true`.

Current safety state after Phase 5Z:

- The Vault RPC/table foundation exists in Supabase.
- No BotFather token has been submitted.
- No Vault secret was intentionally created during the apply.
- No non-null `telegram_sessions.token_secret_ref` has been written.
- `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT` must remain disabled.
- `KYRA_TELEGRAM_CONNECT_GETME_ENABLED` must remain disabled.
- `telegram-connect` must not be deployed with live token persistence until the
  next backend wiring phase is reviewed and approved.
- `telegram-webhook` must remain non-live until webhook registration, secret
  verification, and command authorization are separately approved.
- Netlify publishing and Edge Function deployment remain separate approval
  gates.

## Phase 5AB Webhook Registration Readiness Audit

Phase 5AB is an audit-only checkpoint for the future Telegram webhook
registration step. It does not approve live webhook registration, Edge Function
deployment, runtime gate changes, schema/RLS changes, or Netlify publishing.

Current backend state:

- `telegram-connect` can validate auth, ownership, request shape, optional
  `getMe`, optional Vault-backed token storage, and optional session staging
  behind backend-only runtime gates.
- The latest staged connect path can update exactly one existing
  `telegram_sessions` row from `webhook_status=mocked` to
  `webhook_status=queued` and attach an opaque `token_secret_ref`.
- The valid connect response remains inert `not_configured`; it does not claim a
  live Telegram connection.
- `telegram-webhook` still only checks
  `X-Telegram-Bot-Api-Secret-Token` presence before body access, then returns
  inert `not_configured`.
- `telegram-webhook` does not parse Telegram update bodies, perform session
  lookup, resolve tokens, write database records, route commands, or call
  Telegram APIs.
- `resolveTelegramBotToken` exists in the backend-only secret-store boundary,
  but it is not wired into webhook registration or command handling.
- A pure `registerTelegramWebhookWithSetWebhook` helper exists with injected
  `fetch`, timeout handling, HTTPS webhook URL validation, webhook secret token
  validation, and sanitized tests.
- The `setWebhook` helper remains unused by runtime code and is not wired into
  `telegram-connect`.

Webhook registration blockers before any live `setWebhook` path:

- There is no approved runtime gate such as
  `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED`.
- There is no approved webhook URL source or deployment contract for the public
  Supabase Edge Function URL.
- There is no approved per-session webhook secret storage model yet.
- There is no schema field for `webhook_secret_ref`, `webhook_secret_hash`,
  `webhook_url`, `last_webhook_error`, or `last_webhook_error_at`.
- There is no session lookup contract for mapping a verified webhook secret to
  exactly one active Telegram session.
- There is no live command authorization model wired to Telegram chat/user IDs.
- There is no rollback or recoverable failure policy for a failed
  `setWebhook` call after token storage and session staging.
- Reconnect and duplicate-bot transfer behavior must remain unresolved for live
  activation until the explicit reconnect policy is approved.

Phase 5AB.3 wiring audit recommendation:

- Future runtime wiring should add
  `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED`, default off.
- The webhook registration gate must be inert unless
  `KYRA_TELEGRAM_CONNECT_GETME_ENABLED`,
  `KYRA_TELEGRAM_CONNECT_STORE_ENABLED`, and
  `KYRA_TELEGRAM_CONNECT_SESSION_WRITE_ENABLED` are also explicitly enabled.
- The webhook URL must come from a backend-only non-secret runtime setting, for
  example `KYRA_TELEGRAM_WEBHOOK_URL`, not from browser state or frontend
  `VITE_` configuration.
- The webhook URL setting should point to the deployed Supabase Edge Function
  URL for `telegram-webhook`; this requires separate Edge Function deployment
  approval.
- Webhook secret tokens must be generated server-side per connection/session.
  They must never come from browser input, localStorage, logs, API responses, or
  global frontend state.
- Webhook secret storage/lookup needs separate approval. Preferred design is a
  server-only hash or secret reference that lets `telegram-webhook` map a
  verified `X-Telegram-Bot-Api-Secret-Token` value to exactly one active
  session.
- Real activation order should remain:
  auth -> ownership -> `getMe` -> token store -> session queued ->
  `setWebhook` -> session active.
- `telegram_sessions.webhook_status=active` must remain impossible until
  Telegram confirms `setWebhook`, the webhook secret has a verified lookup path,
  and reconnect safety is approved.
- If `setWebhook` fails after token storage/session staging, return a sanitized
  failure, best-effort revoke the token ref if safe, and do not mark the session
  active.
- Failed registration must not break an existing active session or overwrite a
  prior active token ref.
- Do not deploy or enable any webhook registration gate until command handling,
  chat authorization, and webhook session lookup have their own reviewed plan.

Recommended future webhook registration architecture:

1. Keep `setWebhook` isolated in a pure Telegram API helper with injectable
   `fetch` and tests.
2. Keep the helper unwired until a separate runtime gate is approved.
3. Validate webhook URL, webhook secret token, and bot token before calling
   Telegram.
4. Use Telegram `secret_token` for
   `X-Telegram-Bot-Api-Secret-Token` verification.
5. Never log or return the raw BotFather token, resolved token, webhook secret,
   request body, `token_secret_ref`, owner ID, workspace ID, or raw Telegram
   response body.
6. If registration is attempted inside `telegram-connect`, it must run only
   after auth, ownership, `getMe`, token storage, and safe session staging
   succeed.
7. A failed registration must not leave a browser-visible token reference or a
   false `active` status.
8. Old active sessions must not be broken by reconnect unless the new token,
   token storage, webhook registration, and session activation all succeed.
9. `telegram_sessions.webhook_status=active` must not be written until Telegram
   confirms webhook registration and verification state is ready.
10. Webhook command processing must remain a later phase after secret
    verification, session lookup, and chat authorization are implemented.

Completed Phase 5AB.2 helper/test slice:

- Added a pure Telegram `setWebhook` helper with injected `fetch`, timeout, URL
  validation, secret-token validation, sanitized errors, and tests.
- The helper remains unused by `telegram-connect` runtime.
- Tests cover valid request shape, invalid token, invalid/non-HTTPS URL,
  invalid webhook secret, Telegram `401`/`404`, `429`, `5xx`, malformed JSON,
  network failure, timeout, and sensitive-value non-disclosure.
- No `.env.local` or secret values were read.
- No frontend token input was added.
- No Vault secret was resolved.
- No `telegram_sessions` write was added.
- No real Telegram webhook was registered or revoked.
- No Edge Function was deployed.
- No push or publish happened as part of the helper/test slice.

Recommended next implementation slice:

- Phase 5AB.5 should add only inert runtime contract wiring for webhook
  registration.
- Add a default-off gate parser for
  `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED`.
- Add dependency-contract types for future webhook URL provider, webhook secret
  generator, and webhook registration function.
- Add tests proving the webhook registration dependency is never called unless
  auth, ownership, `getMe`, token store, and session persistence have already
  succeeded.
- Keep `registerTelegramWebhookWithSetWebhook` unused by production
  dependencies unless a later live wiring phase is explicitly approved.
- Keep responses `not_configured`; do not return webhook URL, webhook secret,
  raw token, resolved token, `token_secret_ref`, owner ID, workspace ID, or raw
  Telegram body.
- Do not read `.env.local` or secret values.
- Do not add frontend token input.
- Do not access Vault beyond already-approved token store boundaries.
- Do not resolve real tokens for webhook registration.
- Do not write `webhook_status=active`.
- Do not register or revoke real Telegram webhooks.
- Do not deploy Edge Functions.
- Do not push or publish.

## Phase 5AC Current Local State After Webhook Registration Contract

Phase 5AC is a documentation-only state update. It does not change runtime
behavior, enable live Telegram connectivity, deploy Edge Functions, publish
Netlify, read environment secrets, apply schema/RLS changes, create/read Vault
secrets, or push local commits.

Current local implementation state:

- Local `main` has the inert webhook registration contract committed on top of
  the existing Phase 5 preparation stack.
- The latest local commit is `217e637 Wire inert Telegram webhook registration
  contract`.
- Local `main` is ahead of `origin/main` by 30 commits at the time this state
  note was written.
- Those commits remain intentionally unpushed until a separate push approval and
  Netlify credit/publishing decision.
- `telegram-connect/index.ts` still does not wire
  `registerTelegramWebhookWithSetWebhook` into production runtime
  dependencies.
- The new `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED` parser exists in the
  core contract layer, but the live runtime does not read or act on that gate
  yet.
- Future webhook registration dependencies are represented as injected
  contracts only: webhook URL provider, webhook secret generator, and webhook
  registration callback.
- A valid owner connect path still returns inert `501 not_configured` and does
  not claim a live Telegram connection.
- The setWebhook helper remains isolated in the Telegram API helper/test layer.

Security state:

- No `.env.local` or secret values were read.
- No BotFather token was submitted to a live runtime.
- No raw token is stored, logged, returned, or rendered by this state.
- No Vault secret was created, read, resolved, or revoked by this state.
- No Telegram API call is active from `telegram-connect` runtime.
- No real `setWebhook` or webhook revocation is performed.
- No `webhook_status=active` write exists in the connect runtime path.
- No schema/RLS change is included in this state update.
- No frontend token input is enabled.
- No Edge Function deployment or Netlify publish is included.

Phase 5AC verification baseline:

- `git diff --check` passed before the local contract commit.
- `npm run check:functions` passed before the local contract commit.
- `deno check supabase/functions/telegram-connect/index.ts
  supabase/functions/telegram-webhook/index.ts` passed before the local
  contract commit.
- `deno test` for Telegram connect/webhook tests passed with 92 tests before
  the local contract commit.
- `npm exec tsc -- --noEmit` passed before the local contract commit.
- `npm run build` passed before the local contract commit.

Recommended next checkpoint:

- Phase 5AD should be a final local readiness audit before deciding whether to
  keep holding the local stack, push while Netlify publishing is controlled, or
  proceed to a live runtime wiring phase.
- Phase 5AD should re-check local/remote commit state, expected changed files
  versus `origin/main`, full verification commands, and a security scan covering
  secret reads, Telegram API activation, Vault access, DB writes, frontend token
  input, request-body logging, and token/ref echo.
- Live runtime wiring should remain blocked until Phase 5AD confirms the local
  stack is clean and the user explicitly approves the next implementation slice.

## Phase 5AF Default-Off Webhook Registration Runtime Wiring

Phase 5AF wires the future webhook registration dependency boundary into
`telegram-connect` runtime behind a default-off backend gate. It does not enable
the gate, deploy Edge Functions, publish Netlify, read `.env.local`, create/read
real secrets, apply schema/RLS changes, or make Telegram live.

Runtime state:

- `telegram-connect/index.ts` can parse
  `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED`, default off.
- When the gate is off, runtime does not mount webhook registration
  dependencies, does not read `KYRA_TELEGRAM_WEBHOOK_URL`, does not generate a
  webhook secret, and does not call Telegram `setWebhook`.
- When the gate is explicitly true, runtime can mount:
  - backend-only webhook URL provider using `KYRA_TELEGRAM_WEBHOOK_URL`
  - per-request webhook secret generator
  - `registerTelegramWebhookWithSetWebhook` wrapper
- The helper remains dependent on the existing auth, ownership, `getMe`, token
  store, and session persistence order in `telegram-connect/core.ts`.
- A successful path still returns inert `not_configured` and must not write
  `webhook_status=active`.

Do not enable this gate yet:

- `telegram-webhook` still has no session lookup for a verified webhook secret.
- There is no approved storage location for webhook secret hash/reference.
- There is no command authorization model wired to Telegram chat/user IDs.
- Failed webhook registration recovery still needs a reviewed policy for stale
  queued sessions and token refs.
- Edge Function deployment and production smoke remain separate approval gates.

## Phase 5AG Webhook Receiver Session Lookup Plan

Phase 5AG is an audit and design checkpoint for the future
`telegram-webhook` receiver. It does not parse live Telegram updates, write
database records, change schema/RLS, access Vault, call Telegram APIs, deploy
Edge Functions, publish Netlify, or enable command processing.

Current receiver state:

- `telegram-webhook` checks `X-Telegram-Bot-Api-Secret-Token` before reading or
  parsing the request body.
- Missing webhook secret still returns a generic
  `webhook_verification_failed` response.
- The function remains inert and returns `not_configured` after header,
  content-type, and body-size guards pass.
- There is no Supabase client, service-role client, Vault access, Telegram API
  call, DB read, DB write, request body logging, or command processor in the
  current receiver.

Current data gap:

- `telegram_sessions` currently has safe demo metadata plus `token_secret_ref`,
  but no webhook secret hash/reference, webhook URL, Telegram user ID, Telegram
  chat ID, or command authorization fields.
- `telegram_session_summaries` exposes only safe metadata and must not expose
  token refs, webhook secrets, chat identifiers, raw payloads, owner IDs, or
  internal errors.
- Existing `approval_requests` and `activity_logs` can support later command
  output, but they should not be written by `telegram-webhook` until webhook
  verification, session lookup, and chat authorization are implemented and
  reviewed.

Recommended webhook receiver contract:

1. Verify webhook secret first.
   - Preserve the current ordering: reject missing or invalid
     `X-Telegram-Bot-Api-Secret-Token` before body read, body parse, command
     parsing, or logging.
   - Use constant-time comparison or an equivalent database-side lookup that
     avoids leaking whether a partial secret matched.
   - Never log the request body, webhook secret, token refs, chat IDs, owner IDs,
     workspace IDs, or raw lookup errors.

2. Resolve webhook secret to one active session.
   - Add a separately approved server-only lookup path that maps a verified
     webhook secret hash/reference to exactly one active `telegram_sessions`
     record.
   - The lookup must join:
     `telegram_sessions.agent_id -> agent_instances.id ->
     agent_instances.workspace_id -> workspaces.id`.
   - The internal result should include only the fields needed by the receiver:
     `session_id`, `agent_id`, `workspace_id`, `owner_user_id`, `bot_handle`,
     and `webhook_status`.
   - Public responses must not include `owner_user_id`, `workspace_id`,
     `token_secret_ref`, webhook secret material, raw DB errors, or raw Telegram
     payloads.

3. Authorize the Telegram chat before command handling.
   - Personal agents may accept commands only from the owner-linked Telegram
     user/chat.
   - Community or project agents require an explicit allowlist/admin role policy
     before any command is accepted.
   - Unknown chats should no-op or receive a safe denial response without
     writing command records.
   - Read-only commands must be separated from write, approval, wallet, admin,
     or onchain commands.

4. Keep command processing staged.
   - The first live receiver slice should parse only the minimal safe Telegram
     update shape after verification and session authorization succeed.
   - Read-only commands such as status/help should be implemented before write
     or approval commands.
   - Write or approval commands should create reviewed Kyra intent/approval
     records only; they must not execute wallet or onchain actions directly.

Recommended future error contract:

- `401 webhook_verification_failed`: missing or invalid webhook secret, rejected
  before body access.
- `404 session_not_found`: verified secret does not map to exactly one active
  Telegram session.
- `403 chat_not_authorized`: session exists but Telegram user/chat is not
  authorized for the agent.
- `400 invalid_update`: verified and authorized request has an unsupported or
  malformed Telegram update shape.
- `501 not_configured`: receiver contract is present but command processing is
  intentionally disabled.
- `500 server_error`: unexpected lookup or processing failure, sanitized.

Schema/RLS decisions that need separate approval:

- Add a server-only webhook secret hash/reference storage model, either on
  `telegram_sessions` or in a private companion table.
- Add a Telegram chat authorization model for owner-linked personal chats and
  community/project allowlists.
- Add verifier coverage proving browser roles cannot read webhook secrets, chat
  identifiers, owner IDs, workspace IDs, or raw Telegram payloads.
- Keep all webhook receiver lookup and authorization reads behind Edge Function
  service-role execution or a narrow server-only RPC boundary.

Safe next implementation slice:

- Add pure tests/helpers for webhook session lookup result handling.
- Add pure tests/helpers for chat authorization decisions.
- Add minimal Telegram update shape validators that are not called before
  webhook verification.
- Keep runtime inert: no DB reads, DB writes, Vault access, Telegram API calls,
  command writes, body logging, deploy, or production enablement.

### Phase 5AG.2 Inert Contract State

Phase 5AG.2 adds pure webhook receiver contracts and tests only. It does not
enable real Telegram webhook processing, parse request bodies, perform DB
lookups, write DB records, access Vault, call Telegram APIs, deploy Edge
Functions, publish Netlify, or enable command processing.

Current code state:

- `telegram-webhook/index.ts` remains a thin inert entrypoint.
- `telegram-webhook/core.ts` now contains pure helpers for:
  - existing method, content-type, body-size, and webhook secret header guards
  - active webhook session result handling
  - sanitized future session lookup failures
  - personal agent chat authorization
  - community/project chat authorization
  - read-only versus write/approval command separation
- Missing `X-Telegram-Bot-Api-Secret-Token` still rejects before any body
  access.
- Valid inert requests still return `not_configured`.
- The new helpers are not wired to a real Supabase lookup, command parser,
  Telegram reply sender, Vault resolver, or DB writer.

Test coverage added:

- Missing webhook secret rejects before body access.
- Inert valid webhook path returns `not_configured` without reading body.
- Unsupported content type and oversized content length reject before body read.
- Missing or inactive session lookup results map to sanitized
  `session_not_found`.
- Unexpected session lookup failures map to sanitized `server_error`.
- Personal owner-linked Telegram user/chat is authorized.
- Unknown personal chats are denied without echoing chat/user IDs.
- Community members are limited to read-only commands.
- Community admins can pass write/approval authorization.
- Optional public community access is read-only only.
- Missing Telegram chat identity maps to `invalid_update`.

Verification baseline after Phase 5AG.2:

- `npm run check:functions` passed.
- `deno check supabase/functions/telegram-connect/index.ts
  supabase/functions/telegram-webhook/index.ts` passed.
- `deno test` for Telegram connect and webhook tests passed with `103 passed |
  0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Runtime scan of `telegram-webhook/index.ts` and `telegram-webhook/core.ts`
  found no Telegram API calls, Vault access, service-role use, DB writes,
  `request.json`, console logging, BotFather token handling, token ref access,
  or `.env.local` reads.

Remaining blockers before live webhook processing:

- No approved schema/RLS for webhook secret hash/reference lookup.
- No approved schema/RLS for Telegram chat authorization storage.
- No runtime session lookup from webhook secret to active `telegram_sessions`.
- No Telegram update parser.
- No command processor.
- No Telegram reply sender.
- No Edge Function deployment or production smoke for real Telegram webhooks.

## Phase 5AH Webhook Secret And Chat Auth Schema Plan

Phase 5AH is a schema/RLS audit and design checkpoint. It does not edit
`schema.sql`, apply SQL in Supabase, change RLS/grants, create secrets, read
secrets, write database rows, wire real webhook lookup, deploy Edge Functions,
publish Netlify, or enable command processing.

Current schema/RLS findings:

- `telegram_sessions` currently stores safe demo metadata plus
  `token_secret_ref`.
- `telegram_session_summaries` is the browser-facing Telegram metadata view and
  excludes `token_secret_ref`, `owner_user_id`, `workspace_id`, webhook secrets,
  chat identifiers, and raw Telegram payloads.
- Authenticated browser clients have select access only to safe
  `telegram_sessions` columns and do not have broad table select.
- The verifier already checks that authenticated clients cannot select
  `telegram_sessions.token_secret_ref` or broad-select `telegram_sessions`.
- There is no approved storage for webhook secret hash/reference.
- There is no approved storage for owner-linked Telegram user/chat identities or
  community/project allowlists.
- `telegram-webhook` has pure session/chat authorization contracts, but no real
  Supabase lookup is wired.

Recommended webhook secret storage:

- Do not store raw webhook secret tokens in public tables.
- Prefer a backend-only companion table instead of adding secret material to
  browser-readable `telegram_sessions`.
- Proposed private table: `public.telegram_webhook_secrets`.
- Proposed fields:
  - `webhook_secret_ref text primary key`
  - `webhook_secret_hash text not null`
  - `telegram_session_id uuid not null references public.telegram_sessions(id)`
  - `created_at timestamptz not null default now()`
  - `revoked_at timestamptz null`
- Do not store a redundant `agent_id`; derive it through `telegram_session_id`
  so session and agent identity cannot drift.
- Add a partial unique index so only one active webhook secret exists per
  Telegram session.
- The hash algorithm and secret generation format require separate approval
  before executable SQL is written.

Recommended chat authorization storage:

- This boundary is deferred from the webhook session-lookup schema slice.
- Keep Telegram chat/user identifiers out of public views and browser-readable
  tables.
- Proposed private table: `public.telegram_chat_authorizations`.
- Proposed fields:
  - `id uuid primary key default gen_random_uuid()`
  - `agent_id uuid not null references public.agent_instances(id)`
  - `telegram_user_id text null`
  - `telegram_chat_id text null`
  - `role text not null check (role in ('owner', 'admin', 'member'))`
  - `command_scope text not null check (command_scope in ('read_only',
    'approval', 'write'))`
  - `created_at timestamptz not null default now()`
  - `revoked_at timestamptz null`
- Require at least one of `telegram_user_id` or `telegram_chat_id`.
- Personal agents should have exactly one active owner-linked authorization per
  agent unless a separate transfer flow is approved.
- Community/project agents may use explicit allowlists or admin rows, but write
  and approval scopes must remain separate from read-only access.

Recommended lookup boundary:

- `telegram-webhook` should not directly expose private table data to responses.
- Prefer a narrow service-role-only RPC for receiver lookup after schema
  approval.
- Proposed lookup input: webhook secret hash/ref.
- Proposed internal result:
  - `session_id`
  - `agent_id`
  - `workspace_id`
  - `owner_user_id`
  - `bot_handle`
  - `webhook_status`
- Chat authorization policy fields must come from a separately approved lookup
  boundary and must not be added to the session lookup result implicitly.
- Public/API responses must never include webhook secret refs/hashes,
  `token_secret_ref`, owner IDs, workspace IDs, Telegram user/chat identifiers,
  raw DB errors, or raw Telegram payloads.

Recommended RLS/grants:

- For the current session-lookup slice, enable RLS on
  `telegram_webhook_secrets`.
- Revoke all privileges on `telegram_webhook_secrets` from `public`, `anon`,
  and `authenticated`.
- Grant only `select`, `insert`, and `update` on
  `telegram_webhook_secrets` to `service_role`.
- Revoke execute on `resolve_telegram_webhook_session(text)` from `public`,
  `anon`, and `authenticated`.
- Grant execute on `resolve_telegram_webhook_session(text)` only to
  `service_role`.
- Define chat authorization RLS/grants only in its separately approved slice.
- Keep `telegram_session_summaries` unchanged unless a separate browser-facing
  metadata need is approved.

Recommended verifier additions:

- Confirm `telegram_webhook_secrets` exists after approved SQL apply.
- Confirm `telegram_webhook_secrets` has the exact approved shape, RLS state,
  constraints, partial indexes, and grants.
- Confirm `public`, `anon`, and `authenticated` cannot select, insert, update,
  or delete rows in `telegram_webhook_secrets`.
- Confirm `service_role` has only the required direct table privileges.
- Confirm `resolve_telegram_webhook_session(text)` has the approved signature,
  output shape, security properties, owner, and execute grants.
- Treat chat authorization object-existence checks as deferred `false` values,
  not session-lookup apply failures.
- Confirm `telegram_session_summaries` still excludes `token_secret_ref`,
  webhook secret refs/hashes, owner IDs, workspace IDs, chat identifiers, and raw
  Telegram payloads.
- Confirm authenticated clients still cannot broad-select `telegram_sessions`.

Approval points before executable SQL:

- Approve exact table names and column names.
- Approve stable explicit constraint names.
- Approve webhook secret hash algorithm and secret reference format.
- Approve the expected privileged owner for the `security definer` RPC.
- Approve personal owner-linking flow.
- Approve community/project allowlist/admin policy scope.
- Approve RLS/grant statements.
- Approve verifier expected outputs.
- Approve whether SQL belongs in a draft file first or directly in a reviewed
  migration/apply packet.

Original Phase 5AI follow-up, now completed:

- Phase 5AI created an audit/draft-only SQL boundary for
  `telegram_webhook_secrets`, `telegram_chat_authorizations`, grants, and
  verifier checks.
- No executable SQL should be applied until that draft is reviewed and explicitly
  approved.

### Phase 5AI Draft SQL Boundary State

Phase 5AI adds a comment-only review artifact for the future webhook receiver
schema boundary:

- `supabase/telegram_webhook_receiver_schema_draft.sql`

The original draft captured proposed private tables, indexes, RLS/grants,
lookup RPCs, verifier checks, approval points, and rollout order for:

- `public.telegram_webhook_secrets`
- `public.telegram_chat_authorizations`
- `public.resolve_telegram_webhook_session(text)`
- optional `public.resolve_telegram_chat_authorization(uuid,text,text,text)`

Phase 5AK.2 later narrowed the active draft boundary to
`telegram_webhook_secrets` and `resolve_telegram_webhook_session(text)`.
Chat authorization objects remain listed only as explicitly deferred future
work.

This draft must remain non-executable until separately approved. It does not
edit `schema.sql`, apply SQL in Supabase, change RLS/grants, create/read secrets,
wire runtime DB lookup, deploy Edge Functions, publish Netlify, or enable command
processing.

### Phase 5AJ Webhook Verifier State

Phase 5AJ added guarded, verifier-only checks to
`supabase/verify_authenticated_demo_write_lockdown.sql`. The verifier change is
committed locally, but it has not been run against Supabase and does not apply
SQL, edit `schema.sql`, create private tables, create lookup RPCs, wire runtime
lookup, deploy Edge Functions, publish Netlify, or enable command processing.

Current verifier coverage:

- Authenticated clients cannot insert, update, or delete demo backend tables.
- Authenticated clients cannot broad-select `telegram_sessions`.
- Authenticated clients cannot select `telegram_sessions.token_secret_ref`.
- `telegram_session_summaries` exists, has the expected safe columns, and
  excludes `token_secret_ref`, `owner_user_id`, and `workspace_id`.
- Bot token Vault RPCs are checked for existence and execute grants across
  `public`, `anon`, `authenticated`, and `service_role`.
- A guarded CTE now resolves future webhook receiver objects:
  - `to_regclass('public.telegram_webhook_secrets')`
  - `to_regclass('public.telegram_chat_authorizations')`
  - `to_regprocedure('public.resolve_telegram_webhook_session(text)')`
  - `to_regprocedure('public.resolve_telegram_chat_authorization(uuid,text,text,text)')`
- Checks remain tolerant before schema apply:
  - object existence checks can be `false`
  - privilege checks must use `case when object is null then false else ... end`
  - verifier must not error when draft-only objects do not exist yet
- Private table existence checks are present:
  - `telegram_webhook_secrets_table_exists`
  - `telegram_chat_authorizations_table_exists`
- Browser-deny checks are present for both private tables:
  - `public`, `anon`, and `authenticated` cannot select
  - `anon` and `authenticated` cannot insert, update, or delete
- Service-role checks are present for both private tables:
  - `service_role` can select, insert, and update
- Webhook/chat lookup RPC execute checks are present:
  - `public`, `anon`, and `authenticated` cannot execute lookup RPCs
  - `service_role` can execute lookup RPCs
- Existing Telegram safety checks remain present:
  - `telegram_session_summaries_excludes_sensitive_columns` remains true
  - `telegram_session_summaries_has_expected_columns` remains true
  - `auth_has_no_broad_telegram_sessions_select_grant` remains true
  - `auth_can_select_telegram_token_secret_ref` remains false

Static review result:

- Verifier object names and RPC signatures match
  `supabase/telegram_webhook_receiver_schema_draft.sql`.
- The verifier contains no DDL, DML, secret read, Telegram API call, Vault
  access, or runtime behavior change.
- Before schema apply, missing future objects produce guarded `false` results
  instead of causing verifier errors.

Expected post-apply verifier state:

- Webhook private table existence booleans are true.
- Chat authorization private table existence booleans are true.
- Browser deny booleans are true.
- Service-role access booleans are true.
- Lookup RPC existence and service-role execute booleans are true after those
  RPCs are approved.
- Public/anon/authenticated execute-deny booleans are true.

Safe next slice:

- Run Phase 5AK audit-only to define the exact schema-apply preflight and
  rollback criteria.
- Do not apply SQL or require the private tables/RPCs to exist until schema,
  RLS/grants, and production verification are separately approved.

### Phase 5AK Webhook Schema Apply Preflight

Phase 5AK completed an audit-only review of the future webhook receiver schema
boundary. No SQL was applied, no executable webhook migration was created, and
no runtime, Edge Function, Telegram API, secret, deployment, or Netlify state
changed.

Current verdict:

- No-go for applying the full
  `supabase/telegram_webhook_receiver_schema_draft.sql` design.
- Go for docs and comment-only draft refinement before any executable SQL is
  considered.
- Webhook session lookup and chat authorization must use separate approval and
  rollout slices.

Audit findings and resolution status:

- Resolved in the Phase 5AK.2 draft: redundant
  `telegram_webhook_secrets.agent_id` was removed so agent resolution comes
  through `telegram_session_id`.
- Deferred with chat authorization: the identity matching rule must prevent one
  matching Telegram user or chat identifier from unintentionally broadening
  authorization.
- Deferred with chat authorization: the role/scope model must prevent a
  `member` row from receiving `write` or `approval` scope.
- Resolved in the Phase 5AK.2 draft: the future `security definer` session
  lookup RPC uses the proposed restricted search path
  `pg_catalog, public, pg_temp`.
- Resolved in the Phase 5AK.2 draft: the initial apply must fail on an existing
  table or function instead of silently accepting or replacing an incompatible
  object.
- The current verifier confirms object existence and privileges, but it does not
  yet prove RLS state, required columns and constraints, partial unique indexes,
  or RPC security-definer/search-path properties.
- A rollback policy and destructive-action guard are documented, but an exact
  reviewed rollback artifact does not exist yet.

Split rollout decision:

1. Refine and approve only the webhook session lookup boundary:
   `telegram_webhook_secrets` plus `resolve_telegram_webhook_session(text)`.
2. Keep `telegram_chat_authorizations` and
   `resolve_telegram_chat_authorization(uuid,text,text,text)` deferred until the
   identity matching rule and role/scope matrix are separately approved.
3. Extend verifier coverage before converting either slice into executable SQL.
4. Keep `telegram-webhook` inert until the approved lookup slice is applied,
   verified, tested through an adapter, and separately approved for deployment.

Required preflight before any executable webhook schema apply:

- Confirm the target project and capture the current verifier output.
- Confirm webhook runtime and deployment gates remain disabled.
- Confirm no live webhook registration or command-processing path depends on
  the proposed objects.
- Review exact table columns, constraints, indexes, RLS state, grants, RPC
  signatures, `security definer` setting, and restricted search path.
- Require explicit checks that similarly named existing tables, indexes, or
  functions do not have an incompatible shape.
- Prepare expected post-apply verifier values before applying.
- Prepare a reviewed rollback artifact before applying.
- Apply only one approved slice inside a transaction.
- Run the verifier immediately after apply and stop before runtime wiring if any
  expected value is false.

Abort criteria:

- Abort if any browser role can read or write a private webhook table.
- Abort if `public`, `anon`, or `authenticated` can execute a private lookup
  RPC.
- Abort if `service_role` lacks the minimum required table or RPC privileges.
- Abort if RLS is disabled on a private webhook table.
- Abort if an existing object has an unexpected structure or privilege state.
- Abort if the webhook session lookup can return more than one active session
  for one presented secret hash.
- Abort if a secret hash, secret reference, Telegram chat/user ID, owner ID,
  workspace ID, token ref, raw DB error, or raw Telegram payload can reach a
  browser-readable view, response, or log.
- Abort if rollback readiness is not confirmed before apply.

Rollback policy:

- Rollback must be reviewed and approved separately from the forward migration.
- Use transaction rollback for any failure during the initial apply.
- Post-commit rollback is allowed only while webhook runtime remains disabled
  and the newly introduced tables contain no required production data.
- Revoke backend access and disable dependent runtime gates before removing any
  applied object.
- Drop RPCs before tables, use exact signatures and object names, and do not use
  `CASCADE`.
- Capture verifier output before and after rollback.
- If data exists or runtime has been enabled, use a forward-fix migration
  instead of destructive rollback.

Phase 5AK.2 follow-up:

- Phase 5AK.2 refined the comment-only webhook schema draft for the
  session-lookup slice only.
- Do not create executable SQL, apply schema/RLS/grants, wire runtime lookup,
  enable webhook processing, deploy, publish, or push without separate approval.

### Phase 5AK.2 Session Lookup Draft State

The comment-only webhook schema draft is now limited to the session-lookup
slice:

- `public.telegram_webhook_secrets`
- `public.resolve_telegram_webhook_session(text)`

The refined draft removes redundant `telegram_webhook_secrets.agent_id`, uses
`telegram_session_id` as the single source for agent resolution, requires a
restricted RPC search path, rejects silent `if not exists` or
`create or replace` behavior for the initial apply, and documents a
non-`CASCADE` rollback boundary.

`telegram_chat_authorizations` and
`resolve_telegram_chat_authorization(uuid,text,text,text)` remain explicitly
deferred. Their absence must not block an approved session-lookup-only rollout.

### Phase 5AK.3 Session Lookup Verifier Contract

Phase 5AK.3 completed an audit-only verifier coverage design. It did not edit
the verifier, schema draft, runtime, Edge Functions, schema/RLS, secrets,
deployment, or Netlify state.

Required guarded verifier results for `telegram_webhook_secrets`:

- `telegram_webhook_secrets_table_exists` is true after approved apply.
- The table has exactly these columns:
  - `webhook_secret_ref text not null`
  - `webhook_secret_hash text not null`
  - `telegram_session_id uuid not null`
  - `created_at timestamptz not null`
  - `revoked_at timestamptz null`
- No `agent_id` column exists.
- RLS is enabled and no browser-readable policy exists.
- The primary key is on `webhook_secret_ref`.
- The foreign key targets `public.telegram_sessions(id)` with
  `ON DELETE CASCADE`.
- Stable, explicitly named constraints prove non-empty trimmed secret refs and
  hashes.
- `telegram_webhook_secrets_active_session_key` is unique, valid, ready, uses
  `telegram_session_id`, and has predicate `revoked_at IS NULL`.
- `telegram_webhook_secrets_active_hash_key` is unique, valid, ready, uses
  `webhook_secret_hash`, and has predicate `revoked_at IS NULL`.
- `public`, `anon`, and `authenticated` have no direct table privileges.
- `service_role` has `select`, `insert`, and `update`, but not `delete`,
  `truncate`, `references`, or `trigger`.

Required guarded verifier results for
`resolve_telegram_webhook_session(text)`:

- The exact function signature exists.
- The function language is SQL, volatility is stable, and
  `security definer` is enabled.
- The configured search path is restricted to the approved equivalent of
  `pg_catalog, public, pg_temp`.
- The function owner matches the separately approved privileged migration role.
- The result contract contains only `session_id`, `agent_id`, `workspace_id`,
  `owner_user_id`, `bot_handle`, and `webhook_status`.
- `public`, `anon`, and `authenticated` cannot execute the RPC.
- `service_role` can execute the RPC.

Recommended PostgreSQL catalogs for verifier implementation:

- `information_schema.columns` for exact columns, data types, nullability, and
  absence of `agent_id`.
- `pg_class.relrowsecurity` and `pg_policies` for RLS and policy state.
- `pg_constraint`, `pg_attribute`, and `pg_get_constraintdef(...)` for primary
  key, foreign key, delete behavior, and named checks.
- `pg_index`, `pg_class`, `pg_attribute`, and `pg_get_expr(...)` for index
  uniqueness, validity, readiness, key columns, and partial predicates.
- `pg_proc`, `pg_language`, `pg_get_userbyid(...)`, and function argument/output
  metadata for RPC language, volatility, security-definer state, owner, search
  path, and result contract.
- `has_table_privilege(...)`, `has_function_privilege(...)`, and ACL inspection
  for role privilege boundaries.

Deferred check interpretation:

- `telegram_chat_authorizations_table_exists` and
  `resolve_telegram_chat_authorization_function_exists` should remain false
  until their separate rollout is approved.
- All chat authorization privilege checks remain informational and must not be
  included in the session-lookup apply success gate.

Blockers before verifier-only implementation:

- Add stable explicit names for the primary key, foreign key, and non-empty
  checks in the comment-only schema draft.
- Confirm the expected privileged owner for the future `security definer` RPC.
  The expected role may be `postgres` in the target project, but it must be
  confirmed rather than assumed.
- Define normalized comparisons for index predicates and function search-path
  configuration so harmless PostgreSQL formatting differences do not create
  false verifier failures.

Historical next slice, now completed:

- Phase 5AK.4 refined the comment-only schema draft with explicit constraint
  names and an RPC owner approval placeholder.
- The verifier remained unchanged until that draft-only slice was reviewed.

### Phase 5AK.6 Session Lookup Verifier Closeout

Phase 5AK.4 and Phase 5AK.5 completed the approved draft and verifier-only work
for the future Telegram webhook session-lookup boundary:

- The comment-only schema draft now has stable explicit names for the webhook
  secret table constraints and partial unique indexes.
- Phase 5AK initially kept the future security-definer RPC owner as an approval
  placeholder instead of assuming a target-project role. Phase 5AL.1 later
  replaced that design with a narrower security-invoker contract.
- Commit `af0bbe8` extends
  `supabase/verify_authenticated_demo_write_lockdown.sql` with guarded,
  read-only checks for `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)`.
- The verifier checks exact columns, absence of redundant `agent_id`, RLS and
  policy state, named constraints, partial indexes, role privileges, RPC
  language and volatility, RPC security mode, search-path configuration, result
  contract, and execute grants.
- Missing future objects produce guarded false or null results instead of
  causing the verifier query to fail.

The verifier implementation remains local validation tooling only:

- No executable webhook schema migration exists.
- No SQL from the comment-only draft has been applied to Supabase.
- The expanded verifier has not been executed against the target database
  because no local `psql` or Supabase CLI runtime was available and database
  execution was outside the approved scope.
- No schema, RLS, grant, Vault, secret, Edge Function runtime, Telegram API,
  webhook registration, deploy, or production behavior changed.

Decisions that remained open at the Phase 5AK closeout:

- Approve the opaque `webhook_secret_ref` format and lifecycle.
- Approve the webhook secret hash algorithm, normalization rules, and
  backend-only hashing boundary. Phase 5AL.1 later approved the draft contract
  for this item.
- Review the exact forward migration and exact non-`CASCADE` rollback together.
- Approve schema, RLS, grants, and the controlled Supabase SQL apply separately.

Phase 5AK is closed at the draft-and-verifier readiness boundary. It does not
approve schema apply or live webhook behavior.

Next safest slice:

- Phase 5AL should be audit/plan only for the exact forward migration and
  rollback design covering only `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)`.
- Keep chat authorization schema, runtime lookup wiring, Telegram update
  parsing, command processing, reply sending, deployment, and production
  enablement deferred.

### Phase 5AL.2 Session Lookup Security Contract Closeout

Phase 5AL completed the audit and approved draft/verifier refinement for the
future webhook session-lookup migration. Commit `b5ed09d` contains the reviewed
contract changes only. It did not create an executable migration or apply SQL.

Approved security contract:

- `public.resolve_telegram_webhook_session(text)` should be `SECURITY INVOKER`,
  not `SECURITY DEFINER`.
- Only `service_role` may execute the lookup RPC.
- The RPC uses an empty `search_path` and fully qualified relation names.
- The function owner is not used as a runtime privilege boundary.
- The raw webhook secret is generated from 32 cryptographically random bytes
  encoded as 64 lowercase hexadecimal characters.
- Store only the lowercase hexadecimal SHA-256 digest of the exact UTF-8 bytes
  received from the Telegram verification header.
- Hashing belongs in an approved backend-only Edge Function boundary.
- Never store, return, or log the raw webhook secret.
- `webhook_secret_hash` must satisfy the named exact-format constraint for
  `^[0-9a-f]{64}$`.
- At Phase 5AL.2, `webhook_secret_ref` remained an opaque backend-only
  reference whose exact format and lifecycle still required separate approval.
  Phase 5AM.1 later defines the draft/verifier contract for that reference.
- Revoke all table privileges from `public`, `anon`, `authenticated`, and
  `service_role` before granting only `select`, `insert`, and `update` to
  `service_role`.
- Revoke all function privileges from `public`, `anon`, `authenticated`, and
  `service_role` before granting execute only to `service_role`.

Exact forward migration order for a future reviewed artifact:

1. Confirm the target project, capture verifier baseline, confirm runtime gates
   remain disabled, and abort if either target object already exists.
2. Begin one transaction.
3. Create `public.telegram_webhook_secrets` with the five approved named
   constraints.
4. Create the two approved partial unique indexes.
5. Enable RLS and create no browser-readable policy.
6. Revoke all table privileges from all runtime roles, then grant the minimum
   three privileges to `service_role`.
7. Create the stable SQL security-invoker lookup RPC with empty `search_path`
   and fully qualified relations.
8. Revoke all function privileges from all runtime roles, then grant execute
   only to `service_role`.
9. Commit the transaction.
10. Run the verifier immediately and stop before runtime wiring if any required
    result is false.

Exact rollback order for a future reviewed artifact:

1. Confirm webhook runtime remains disabled and the private table contains no
   required production data.
2. Begin one transaction.
3. Revoke execute on the exact RPC signature.
4. Drop the exact RPC signature without `CASCADE`.
5. Revoke all privileges on the private table.
6. Drop the exact private table without `CASCADE`.
7. Commit the transaction.
8. Run the verifier and capture the post-rollback state.

Current boundary:

- The schema draft remains comment-only.
- The verifier remains read-only and guarded when future objects are absent.
- No executable session-lookup migration or rollback artifact exists yet.
- No SQL has been applied to Supabase.
- No webhook secret has been created, hashed, stored, read, returned, or logged.
- No runtime lookup, Telegram update parsing, command handling, reply sending,
  Edge Function deployment, Netlify publish, or production enablement occurred.

Required approvals before executable migration artifacts:

- Confirm the Phase 5AM.1 `webhook_secret_ref` format and lifecycle remain
  accepted for the target project.
- Review the exact executable forward migration and rollback artifacts together.
- Confirm target-project baseline and expected verifier results.
- Approve schema, RLS, grants, and controlled Supabase SQL apply separately.

Next safest slice:

- Phase 5AM should remain audit/plan only for the opaque
  `webhook_secret_ref` lifecycle and exact executable migration/rollback packet.
- Do not apply SQL, wire runtime lookup, deploy, publish, or enable live webhook
  behavior without separate explicit approval.

### Phase 5AM.1 Webhook Secret Ref Contract

Phase 5AM.1 refines the draft/verifier contract for webhook secret references
only. It does not create executable SQL, apply schema/RLS/grants, wire runtime
lookup, store secrets, call Telegram, deploy, publish, or enable live webhook
behavior.

Approved `webhook_secret_ref` format:

- `webhook:telegram:<uuid-v4>`
- Example: `webhook:telegram:550e8400-e29b-41d4-a716-446655440000`
- The reference is generated backend-only.
- The reference is not a secret, but it remains backend-only operational
  metadata.
- It must not be returned to browser clients, stored in frontend state or
  localStorage, written to public views, activity logs, API responses, or
  request logs.

Approved lifecycle:

- Create one `webhook_secret_ref` with each active webhook secret row.
- Do not reuse a reference after revocation.
- Revoke by setting `revoked_at`; do not delete rows during normal reconnect or
  failed registration cleanup.
- Maintain one active webhook secret per Telegram session through the approved
  partial unique index.
- Failed registration must revoke the newly created webhook secret row and must
  not activate the Telegram session.

Draft/verifier refinement:

- Add named constraint `telegram_webhook_secrets_ref_format_check`.
- Verify `webhook_secret_ref` matches the exact `webhook:telegram:<uuid-v4>`
  pattern.
- Keep `webhook_secret_hash` as exact lowercase SHA-256 hex.
- The lookup RPC should compare exact hashes:
  `secrets.webhook_secret_hash = p_webhook_secret_hash`.
- The lookup RPC should not trim, normalize, log, return, or expose presented
  hash values.

Runtime blocker before webhook secret storage wiring:

- Closed in Phase 5AN.1: `persistTelegramSession` now returns the updated
  `telegram_session_id` as an internal `telegramSessionId`.
- The returned session id is validated as a UUID before the future webhook
  registration dependency can use it.
- The public `telegram-connect` response remains unchanged and must not expose
  `telegramSessionId`, `tokenSecretRef`, owner IDs, workspace IDs, raw webhook
  URL, raw webhook secret, or raw BotFather token.
- Future webhook secret storage now has a clean `telegram_session_id` source,
  but the secret table/RPC migration must still be approved separately before
  any real webhook secret persistence is wired.

Phase 5AN.1 closeout:

- Added a pure internal contract where session persistence returns
  `{ telegramSessionId }`.
- Passed `telegramSessionId` into the future `registerTelegramWebhook`
  dependency only after token validation, token secret storage, and session
  persistence succeed.
- Added tests for valid internal propagation, invalid persisted session id
  sanitization, adapter return value, and unexpected updated-row rejection.
- Kept runtime behavior inert: successful gated paths still return
  `not_configured`.
- No schema/RLS change, no SQL apply, no `.env.local` read, no real secret read,
  no Netlify deploy, and no push was part of this slice.

Next safest slice:

- Phase 5AN.2 should remain docs-only closeout for the session id return
  contract.
- After that, Phase 5AO should be audit-only for webhook secret persistence
  finalization after a future successful `setWebhook`.

### Phase 5AO Webhook Secret Persistence Finalization Audit

Phase 5AO is an audit/docs-only checkpoint for the future step that stores the
Telegram webhook verification secret hash and activates a staged Telegram
session after Telegram confirms `setWebhook`. It does not apply SQL, change
schema/RLS/grants, read or create real secrets, call Telegram, deploy Edge
Functions, publish Netlify, or enable live Telegram behavior.

Current findings:

- `telegram-connect` now has an internal `telegramSessionId` from the session
  persistence adapter.
- The current staged session write only moves the eligible demo row from
  `webhook_status=mocked` to `webhook_status=queued` and stores the opaque
  `token_secret_ref`.
- The future `registerTelegramWebhook` dependency receives enough internal
  context to register a webhook, but it does not store a webhook secret row or
  activate the session.
- `registerTelegramWebhookWithSetWebhook` can call Telegram only through the
  gated runtime path and is already tested with injected `fetch`; it still must
  remain disabled until the storage/finalization contract is approved.
- `telegram_webhook_receiver_schema_draft.sql` defines the intended private
  `telegram_webhook_secrets` table and lookup RPC shape, but that draft remains
  non-executable and must not be applied without separate approval.
- `telegram-webhook` still has no live lookup from a verified webhook secret to
  an active session.

Recommended finalization order:

1. Complete auth, ownership, `getMe`, token secret storage, and session staging.
2. Generate a raw webhook secret in backend memory only.
3. Hash the exact raw webhook secret bytes with SHA-256 lowercase hex.
4. Generate an opaque backend-only `webhook_secret_ref` using the approved
   `webhook:telegram:<uuid-v4>` format.
5. Insert a private `telegram_webhook_secrets` row for the staged
   `telegramSessionId` before calling Telegram. The row must store only
   `webhook_secret_ref`, `webhook_secret_hash`, `telegram_session_id`,
   `created_at`, and `revoked_at`.
6. Call Telegram `setWebhook` with the raw webhook secret in memory only.
7. Mark `telegram_sessions.webhook_status=active` only after Telegram confirms
   `setWebhook`.
8. Return the existing inert/sanitized public response shape until a separate
   product milestone approves live UI claims.

Why the secret row is created before `setWebhook`:

- Telegram may deliver updates immediately after a successful `setWebhook`.
- The receiver lookup must already be able to map the verified secret hash to
  the staged session.
- The lookup RPC still filters on `telegram_sessions.webhook_status='active'`,
  so the pre-created secret row is not usable by inbound webhooks until the
  session activation update succeeds.

Required backend adapter boundaries:

```text
storeTelegramWebhookSecret({ telegramSessionId, webhookSecretHash }) -> {
  webhookSecretRef
}
activateTelegramSession({ telegramSessionId }) -> void
revokeTelegramWebhookSecret({ webhookSecretRef }) -> void
```

The returned `webhookSecretRef` is opaque backend metadata only.

- Optional later:
  `recordTelegramWebhookRegistrationFailure({ telegramSessionId, reasonCode }) -> void`
  if failure metadata columns are approved.

Adapter rules:

- Raw webhook secret must never cross into SQL, logs, API responses, public
  views, activity logs, localStorage, frontend state, or test snapshots that look
  like production data.
- SQL adapters receive only `telegramSessionId`, `webhookSecretHash`, and
  `webhookSecretRef`.
- `activateTelegramSession` must require the expected queued session id and must
  reject missing, already-active, ambiguous, or mismatched rows.
- `revokeTelegramWebhookSecret` should set `revoked_at`, not delete the row.
- Any unexpected DB/RPC error must be sanitized to a generic server error or
  `webhook_registration_failed` response without raw DB text.

Failure behavior:

- If webhook secret row creation fails: revoke the token ref if safe, do not call
  Telegram, do not activate the session, return sanitized failure.
- If `setWebhook` fails: revoke the newly created webhook secret row, revoke the
  newly stored token ref if safe, do not activate the session, return sanitized
  failure.
- If session activation fails after `setWebhook` succeeds: treat as a blocker
  requiring an explicit recovery plan before live enablement, because Telegram
  may already deliver updates. Do not enable the runtime gate until this
  recovery path is implemented and tested.
- Failed reconnect must not revoke or overwrite an existing active session
  unless an explicit transfer/reconnect flow has succeeded end to end.

Security checks for the future implementation:

- No raw BotFather token or raw webhook secret in DB/API/logs.
- No `webhook_secret_ref` or `webhook_secret_hash` in browser-facing responses
  or public views.
- No `telegram_sessions.webhook_status=active` write before Telegram confirms
  `setWebhook`.
- No command processing until webhook verification, session lookup, and chat
  authorization are all active and tested.
- No live gate enablement until Edge Functions are deployed and production smoke
  checks are approved.

Phase 5AO go/no-go:

- Go for a next docs-only or pure-helper slice that defines hash/ref helpers and
  adapter contracts without DB writes.
- No-go for executable SQL, real webhook secret storage, live `setWebhook`,
  session activation writes, Edge Function deploy, Netlify publish, or runtime
  gate enablement.

Phase 5AO.1 closeout:

- Added pure helper coverage for webhook secret token generation, SHA-256 hash
  generation, approved `webhook_secret_ref` generation, strict validators, and
  sanitized store-input shape.
- The helper creates a 64-character lowercase-hex raw webhook secret token from
  32 random bytes for the future `setWebhook` boundary.
- The helper hashes only the exact webhook secret token string and returns a
  lowercase SHA-256 hex digest for future private storage.
- The store-input helper includes only `telegramSessionId`,
  `webhookSecretHash`, and `webhookSecretRef`; it excludes the raw webhook
  secret token.
- The helper remains unwired from `telegram-connect` runtime. There is still no
  DB write, no SQL apply, no Telegram API call, no Vault read, no frontend
  input, no deploy, and no push in this slice.
- Tests cover deterministic generation, strict lower-case formats, approved ref
  format, raw-secret exclusion from store input, invalid session/hash/ref
  rejection, and deterministic SHA-256 output.

Next safest slice:

- Phase 5AP should be audit-only for an inert webhook-secret persistence adapter
  contract that can handle store/revoke/activate results without real DB writes.
- It should not add SQL apply, real DB writes, Telegram API calls, Vault reads,
  frontend input, deploys, pushes, or runtime gate enablement.

### Phase 5AP Webhook Secret Adapter Contract Closeout

Phase 5AP added pure result contracts for the future webhook secret persistence
and session activation path. It does not add Supabase client writes, SQL apply,
Telegram calls, Vault reads, runtime wiring, frontend input, deploys, or pushes.

Completed pure contracts:

- `assertStoreTelegramWebhookSecretResult` validates the returned
  `webhookSecretRef` and can enforce that it matches the expected generated ref.
- `assertRevokeTelegramWebhookSecretResult` requires explicit
  `{ revoked: true }`.
- `assertActivateTelegramSessionResult` requires explicit `{ activated: true }`
  and the exact expected `telegramSessionId`.
- `sanitizeTelegramWebhookSecretPersistenceError` hides raw webhook refs, hashes,
  DB/RPC text, and session ids behind a generic persistence failure.
- `sanitizeTelegramSessionActivationError` hides raw activation internals behind
  a generic activation failure.

Security result:

- The adapter contract still has no real DB write and no Supabase client.
- It does not import or call Telegram APIs.
- It does not read `.env.local`, runtime env values, Vault secrets, or token
  refs.
- It does not expose raw webhook secret tokens, webhook secret refs/hashes, or
  session ids in sanitized error messages.

Next safest slice:

- Phase 5AQ should be audit-only for where these pure helper contracts could be
  wired in `telegram-connect` after schema/RLS and webhook secret storage are
  explicitly approved.
- No runtime wiring, DB writes, SQL apply, Telegram calls, deploys, pushes, or
  gate enablement should happen in that audit.

### Phase 5AQ Runtime Wiring Readiness Audit

Phase 5AQ audits where the webhook secret helper and adapter contracts should
fit into `telegram-connect` later. It does not wire runtime behavior, apply SQL,
write DB rows, call Telegram, read Vault, read `.env.local`, deploy, publish, or
enable live gates.

Current runtime findings:

- `handleTelegramConnectRequest` already enforces the correct front half of the
  flow: auth, ownership, optional `getMe`, token secret storage, and session
  staging.
- `telegramSessionId` is now available after session staging and is validated
  before webhook registration can run.
- `registerTelegramWebhook` in `index.ts` is currently a thin wrapper around
  `registerTelegramWebhookWithSetWebhook`.
- The current wrapper calls Telegram but does not store a webhook secret hash,
  create a backend-only `webhookSecretRef`, revoke webhook secret rows, or
  activate a session.
- The pure helper layer now has the pieces needed for a future finalization
  orchestrator, but those helpers are intentionally unwired.

Recommended future wiring shape:

```text
prepareWebhookSecretMaterial()
storeTelegramWebhookSecret()
registerTelegramWebhookWithSetWebhook()
activateTelegramSession()
```

This should be wrapped by a single future finalization dependency, not scattered
across `handleTelegramConnectRequest`:

```text
finalizeTelegramWebhookRegistration({
  telegramSessionId,
  botToken,
  webhookUrl,
  webhookSecretMaterial
}) -> {
  registered: true
}
```

Why use a finalization dependency:

- Keeps raw webhook secret token handling inside one backend-only boundary.
- Keeps SQL-facing adapters limited to `telegramSessionId`,
  `webhookSecretHash`, and `webhookSecretRef`.
- Keeps rollback order testable without calling Telegram or writing DB rows in
  core request tests.
- Prevents `handleTelegramConnectRequest` from growing direct knowledge of
  private tables or activation SQL.

Required future dependency gates:

- `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED` must remain default-off.
- A future storage/finalization gate should not enable unless token storage and
  session write gates are also explicitly enabled.
- A future runtime must require the approved webhook secret table/RPC migration
  and verifier to pass before the gate is enabled.
- Edge Function deployment and production smoke must be separate approvals.

Recommended rollback order:

- If webhook secret store fails: revoke newly stored bot token ref if safe,
  leave session queued or recoverable, do not call Telegram, do not activate.
- If `setWebhook` fails: revoke newly stored webhook secret ref, revoke newly
  stored bot token ref if safe, do not activate.
- If activation fails after `setWebhook` succeeds: treat as a live-blocking
  recovery case. Do not enable the runtime gate until there is a tested recovery
  path that either deactivates the Telegram webhook or retries activation
  safely.

What must not be wired yet:

- No SQL adapter for `telegram_webhook_secrets`.
- No activation write to `telegram_sessions.webhook_status=active`.
- No `finalizeTelegramWebhookRegistration` runtime dependency.
- No real `setWebhook` gate enablement.
- No browser-visible connection success copy.
- No webhook receiver command processing.

Next safest slice:

- Phase 5AQ.1 can add a pure finalization-order helper/test that accepts
  injected functions and proves call order plus rollback behavior without real
  DB writes, Telegram calls, env reads, or runtime wiring.
- It must remain unused by `telegram-connect/index.ts` until schema/RLS and
  runtime gate approvals are explicit.

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
