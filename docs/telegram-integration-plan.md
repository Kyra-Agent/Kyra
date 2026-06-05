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
- Historical note: earlier drafts mentioned approving a privileged owner for a
  `security definer` RPC. That is superseded by Phase 5AL.2; the current
  session-lookup contract is `SECURITY INVOKER`, service-role-only execute, and
  an empty search path.
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
- Historical note: Phase 5AK.2 still discussed a future `security definer`
  lookup RPC with a restricted search path. Phase 5AL.2 supersedes that design:
  the current lookup RPC contract is `SECURITY INVOKER` with an empty
  `search_path` and fully qualified relation names.
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
  signatures, `security invoker` setting, and empty search path.
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
  `security invoker` is enabled.
- The configured search path is empty and all relation references are fully
  qualified.
- The function owner is not used as a runtime privilege boundary.
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
- Historical blocker superseded by Phase 5AL.2: the lookup RPC is now
  `SECURITY INVOKER`, so no privileged function-owner boundary should be
  approved for runtime access.
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

### Phase 5AQ.1 Finalization Contract Closeout

Phase 5AQ.1 added a pure finalization-order contract for webhook registration.
It remains unwired from `telegram-connect` runtime and does not add SQL apply,
real DB writes, Telegram API calls, Vault reads, env reads, deploys, pushes, or
gate enablement.

Completed pure behavior:

- `finalizeTelegramWebhookRegistration` validates `telegramSessionId`, raw
  webhook secret token shape, webhook secret hash, and webhook secret ref before
  sequencing injected dependencies.
- Success order is fixed as:
  `storeTelegramWebhookSecret -> registerTelegramWebhook -> activateTelegramSession`.
- Store failure is sanitized and prevents Telegram registration, activation, and
  webhook-secret revoke.
- Registration failure revokes the stored webhook secret ref on a best-effort
  basis, hides rollback internals, and returns a sanitized registration failure.
- Activation failure is sanitized and does not attempt to revoke the webhook
  secret because Telegram may already be configured.
- Tests cover success order, store failure, registration failure rollback,
  rollback failure hiding, activation failure sanitization, and sensitive value
  non-disclosure.

Next safest slice:

- Phase 5AR should be audit-only for executable SQL readiness: compare the
  webhook secret table/RPC draft, verifier expectations, and rollback needs
  before any SQL apply is considered.
- No SQL apply, Supabase dashboard action, runtime wiring, deploy, push, or gate
  enablement belongs in that audit.

### Phase 5AR SQL Readiness Audit

Phase 5AR audits whether the webhook session-lookup SQL design is ready to move
toward a reviewed executable packet later. It does not create executable SQL,
apply SQL in Supabase, modify schema/RLS/grants, run Supabase dashboard actions,
wire runtime adapters, deploy Edge Functions, publish Netlify, or push commits.

Current SQL artifacts:

- `supabase/telegram_webhook_receiver_schema_draft.sql` remains comment-only and
  marked `DRAFT ONLY - DO NOT APPLY`.
- `supabase/verify_authenticated_demo_write_lockdown.sql` contains guarded,
  read-only verifier checks for the future webhook secret table and lookup RPC.
- No reviewed executable forward migration exists yet.
- No reviewed rollback artifact exists yet.
- No schema/RLS/grant change has been applied through this Phase 5 flow.

Readiness findings:

- The current draft and verifier agree on `SECURITY INVOKER`, not
  `SECURITY DEFINER`, for `resolve_telegram_webhook_session(text)`.
- The current draft and verifier agree on an empty `search_path` plus fully
  qualified relation names.
- The private table shape is narrowly scoped to:
  `webhook_secret_ref`, `webhook_secret_hash`, `telegram_session_id`,
  `created_at`, and `revoked_at`.
- The draft intentionally excludes redundant `agent_id` from
  `telegram_webhook_secrets`.
- The draft and verifier agree on exact lowercase SHA-256 hash comparison:
  `secrets.webhook_secret_hash = p_webhook_secret_hash`, without trimming or
  normalizing presented hashes.
- The verifier already checks role boundaries for table access and RPC execute
  grants.
- Older documentation references to `security definer` were historical and are
  now explicitly superseded by the Phase 5AL.2 security-invoker contract.

Remaining blockers before executable SQL:

- A forward migration file has not been created.
- A non-`CASCADE` rollback file has not been created.
- The target Supabase baseline must be captured before any apply.
- The expected verifier output after apply must be reviewed as a checklist.
- The exact apply and rollback files must be reviewed together.
- Runtime gates must remain disabled before, during, and after SQL apply.
- Applying SQL in Supabase still requires a separate explicit apply approval and
  should not be bundled with local code commits.

Recommended forward SQL packet shape later:

- One transaction.
- Abort if `public.telegram_webhook_secrets` already exists.
- Abort if `public.resolve_telegram_webhook_session(text)` already exists.
- Create the private table with the approved named constraints.
- Create both partial unique indexes.
- Enable RLS and create no browser-readable policy.
- Revoke table privileges from all relevant runtime roles first, then grant only
  `select`, `insert`, and `update` to `service_role`.
- Create the stable SQL `SECURITY INVOKER` lookup RPC with empty search path.
- Revoke function privileges from all relevant runtime roles first, then grant
  execute only to `service_role`.
- Commit, run verifier, and stop before runtime wiring if any required verifier
  value is false.

Recommended rollback packet shape later:

- Confirm runtime gates remain disabled and the table contains no required
  production data.
- Revoke execute on the exact RPC signature.
- Drop the exact RPC signature without `CASCADE`.
- Revoke private table privileges.
- Drop the exact private table without `CASCADE`.
- Run verifier after rollback and capture the result.

Phase 5AR go/no-go:

- Go for creating reviewed local forward/rollback SQL files in a later slice,
  as repo artifacts only.
- No-go for applying SQL, changing Supabase state, wiring runtime DB adapters,
  deploying functions, enabling gates, or publishing Netlify.

Next safest slice:

- Phase 5AR.1 can create local reviewed SQL packet files only:
  a forward migration draft and a rollback draft for
  `telegram_webhook_secrets` plus `resolve_telegram_webhook_session(text)`.
- The files must remain unapplied, must be verified by static checks, and must
  not modify `schema.sql` until a separate generated-schema update is approved.

### Phase 5AR.1 SQL Review Packet Closeout

Phase 5AR.1 adds local review-only SQL packet files for the future Telegram
webhook receiver lookup:

- `supabase/telegram_webhook_receiver_forward_review.sql`
- `supabase/telegram_webhook_receiver_rollback_review.sql`

Current state:

- The SQL packet is committed as repo documentation/review material only.
- No SQL was applied to Supabase.
- No schema/RLS state was changed in the remote project.
- `schema.sql` was not modified.
- Runtime gates remain disabled.
- No Edge Function was deployed.
- No Netlify publish/unlock was triggered.
- No secrets, tokens, or environment values were read or included.

Forward packet summary:

- Creates `public.telegram_webhook_secrets`.
- Enables RLS on the private webhook secret lookup table.
- Grants table access only to `service_role`.
- Creates `public.resolve_telegram_webhook_session(text)` as stable SQL
  `SECURITY INVOKER` with empty search path.
- Grants RPC execute only to `service_role`.
- Does not create chat authorization tables or command processing objects.

Rollback packet summary:

- Refuses rollback if `public.telegram_webhook_secrets` contains rows.
- Revokes RPC privileges before dropping the exact RPC signature.
- Revokes table privileges before dropping the exact private table.
- Avoids broad destructive rollback behavior.

Required approval before applying this packet later:

- Confirm target Supabase project and branch.
- Re-run and capture the baseline verifier output immediately before apply.
- Approve the exact forward SQL file.
- Approve the exact rollback SQL file.
- Confirm runtime gates remain disabled during apply.
- Confirm the post-apply verifier output before any runtime wiring.

Next safest slice:

- Phase 5AS should remain audit/docs-only and define the operator apply
  checklist for this SQL packet, including pre-apply screenshots/results,
  post-apply verifier expectations, rollback decision points, and the
  no-runtime-wiring stop condition.

### Phase 5AS SQL Apply Operator Checklist

Phase 5AS is docs-only. It defines the manual operator checklist for a future
Supabase SQL apply of the webhook receiver packet. It does not approve applying
SQL, does not change remote schema/RLS, and does not enable runtime behavior.

Current readiness findings:

- `supabase/telegram_webhook_receiver_forward_review.sql` is the reviewed
  forward packet.
- `supabase/telegram_webhook_receiver_rollback_review.sql` is the reviewed
  rollback packet.
- `supabase/verify_authenticated_demo_write_lockdown.sql` already contains
  guarded checks for `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)`.
- The verifier also contains future chat authorization checks, but the current
  forward packet intentionally does not create chat authorization objects.
- Runtime code must keep webhook receiver DB lookup disabled until a separate
  runtime wiring phase is approved.

Pre-apply checklist for a later approved window:

1. Confirm the exact Supabase project and branch are the intended target.
2. Confirm Netlify publish/deploy remains intentionally separate from SQL apply.
3. Confirm no Edge Function deploy is happening in the same window.
4. Confirm runtime gates remain disabled before SQL apply.
5. Confirm no real Telegram webhook traffic depends on the new table/RPC yet.
6. Review the exact forward and rollback SQL files in full.
7. Run `supabase/verify_authenticated_demo_write_lockdown.sql` and capture the
   baseline output before applying SQL.
8. Confirm baseline still shows browser-safe Telegram session visibility:
   `auth_can_select_telegram_token_secret_ref` must be `false`, and
   `auth_cannot_select_full_telegram_sessions` must be `true`.
9. Confirm baseline shows `telegram_webhook_secrets_table_exists` as `false`.
10. Confirm baseline shows `resolve_telegram_webhook_session_function_exists`
    as `false`.
11. Stop before apply if any existing browser-role Telegram privilege regresses.

Apply checklist for a later approved window:

1. Copy only `supabase/telegram_webhook_receiver_forward_review.sql`.
2. Do not combine it with runtime wiring, Edge Function deploy, or Netlify
   publish.
3. Do not add chat authorization SQL in the same apply.
4. Do not insert real webhook secret rows during schema apply.
5. Do not paste or log raw webhook secrets, BotFather tokens, or environment
   values.
6. Apply the forward SQL once.
7. If the forward SQL aborts because objects already exist, stop and audit the
   target project before any retry.

Post-apply verifier expectations:

- `telegram_webhook_secrets_table_exists` is `true`.
- `telegram_webhook_secrets_is_regular_table` is `true`.
- `telegram_webhook_secrets_has_expected_columns` is `true`.
- `telegram_webhook_secrets_excludes_agent_id` is `true`.
- `telegram_webhook_secrets_rls_enabled` is `true`.
- `telegram_webhook_secrets_has_no_policies` is `true`.
- `telegram_webhook_secrets_primary_key_is_expected` is `true`.
- `telegram_webhook_secrets_session_foreign_key_is_expected` is `true`.
- `telegram_webhook_secrets_ref_not_blank_check_is_expected` is `true`.
- `telegram_webhook_secrets_ref_format_check_is_expected` is `true`.
- `telegram_webhook_secrets_hash_not_blank_check_is_expected` is `true`.
- `telegram_webhook_secrets_hash_format_check_is_expected` is `true`.
- `telegram_webhook_secrets_active_session_index_is_expected` is `true`.
- `telegram_webhook_secrets_active_hash_index_is_expected` is `true`.
- `public_has_no_direct_telegram_webhook_secrets_privileges` is `true`.
- `anon_has_no_direct_telegram_webhook_secrets_privileges` is `true`.
- `auth_has_no_direct_telegram_webhook_secrets_privileges` is `true`.
- `service_role_can_select_telegram_webhook_secrets` is `true`.
- `service_role_can_insert_telegram_webhook_secrets` is `true`.
- `service_role_can_update_telegram_webhook_secrets` is `true`.
- `service_role_cannot_delete_telegram_webhook_secrets` is `true`.
- `service_role_cannot_truncate_telegram_webhook_secrets` is `true`.
- `service_role_cannot_reference_telegram_webhook_secrets` is `true`.
- `service_role_cannot_trigger_telegram_webhook_secrets` is `true`.
- `resolve_telegram_webhook_session_function_exists` is `true`.
- `resolve_telegram_webhook_session_uses_sql_language` is `true`.
- `resolve_telegram_webhook_session_is_stable` is `true`.
- `resolve_telegram_webhook_session_is_security_invoker` is `true`.
- `resolve_telegram_webhook_session_has_empty_search_path` is `true`.
- `resolve_telegram_webhook_session_has_expected_result_contract` is `true`.
- `resolve_telegram_webhook_session_uses_exact_hash_match` is `true`.
- `public_cannot_execute_resolve_telegram_webhook_session` is `true`.
- `anon_cannot_execute_resolve_telegram_webhook_session` is `true`.
- `auth_cannot_execute_resolve_telegram_webhook_session` is `true`.
- `service_role_can_execute_resolve_telegram_webhook_session` is `true`.

Expected not-yet-implemented verifier values after this packet:

- `telegram_chat_authorizations_table_exists` should remain `false`.
- `resolve_telegram_chat_authorization_function_exists` should remain `false`.

Rollback decision points:

- Use rollback only if the forward packet was applied in the same controlled
  window and no production webhook rows are required.
- Do not run rollback if `public.telegram_webhook_secrets` contains rows; use a
  reviewed forward fix instead.
- Do not use rollback to hide unknown target-project drift.
- After rollback, run the verifier again and confirm webhook receiver object
  existence checks return to `false`.

No-runtime-wiring stop condition:

- Even after a clean SQL apply, stop before enabling webhook receiver DB lookup.
- Do not deploy `telegram-webhook` with live lookup enabled in the same step.
- Do not register real Telegram webhooks in the same step.
- Do not insert real webhook secrets until the runtime wiring phase has its own
  audit, tests, and explicit approval.

### Phase 5AT Webhook Runtime Lookup Preflight

Phase 5AT audits the next safe runtime slice after the SQL packet and operator
checklist. It does not implement live lookup, does not read secrets, does not
apply SQL, and does not deploy Edge Functions.

Current runtime findings:

- `telegram-webhook` still returns inert `501 not_configured` for the valid
  skeleton path.
- The webhook handler checks
  `X-Telegram-Bot-Api-Secret-Token` before content-type, body-size, or body
  parsing.
- The handler still does not parse or log the request body.
- `assertActiveTelegramWebhookSession(...)` already models the safe
  `session_not_found` behavior for missing or inactive sessions.
- `assertTelegramWebhookChatAuthorized(...)` already models personal and
  community chat authorization without database access.
- No current webhook runtime code calls
  `public.resolve_telegram_webhook_session(text)`.

Recommended next implementation slice:

- Add a pure webhook session lookup adapter contract in the
  `telegram-webhook` core/test layer.
- Keep the default runtime response as `not_configured`.
- Accept only a hashed webhook secret lookup input in the adapter boundary.
- Treat null lookup result as `404 session_not_found`.
- Treat duplicate lookup rows as a sanitized `500 server_error`.
- Treat unexpected RPC errors as sanitized `500 server_error`.
- Validate returned session shape before allowing any future body parsing.
- Ensure returned errors never expose `webhook_secret_hash`, `owner_user_id`,
  `workspace_id`, raw RPC details, BotFather tokens, or token refs.

Runtime gating rule:

- The live RPC lookup must remain disabled by default.
- A later runtime phase must require an explicit backend-only feature gate before
  any call to `resolve_telegram_webhook_session(text)`.
- If the gate is off, the handler must keep returning inert `not_configured`
  after header/content-length validation.
- If the gate is on in a future phase, request order must remain:
  method -> webhook secret header presence -> content-type -> content-length ->
  secret hash -> session lookup -> active-session validation -> body parsing.

Files likely touched later:

- `supabase/functions/telegram-webhook/core.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`
- Possibly a new `supabase/functions/telegram-webhook/session-lookup.ts`
  if the adapter grows beyond a small pure helper.

What not to touch in Phase 5AT:

- No Supabase SQL apply.
- No `schema.sql` generated update.
- No direct DB reads or writes in live runtime.
- No service-role client wiring.
- No Vault access.
- No real Telegram API calls.
- No webhook registration.
- No command processing.
- No Edge Function deploy.
- No Netlify publish/unlock.

Go/no-go:

- Go for docs-only planning or pure adapter contract tests.
- No-go for live RPC calls until SQL apply, verifier capture, runtime gate
  design, and deployment window are separately approved.

### Phase 5AT.1 Webhook Lookup Contract Closeout

Phase 5AT.1 adds pure webhook session lookup contract helpers and tests only.
It does not wire live RPC lookup and does not change runtime behavior.

Implemented files:

- `supabase/functions/telegram-webhook/core.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`

Implemented contract:

- `assertTelegramWebhookSecretHash(...)` accepts only lowercase SHA-256 hex
  webhook secret hashes.
- `assertTelegramWebhookSessionLookupResult(...)` maps future injected RPC
  results into the internal webhook session record shape.
- Missing lookup rows map to `404 session_not_found`.
- Inactive session rows map to `404 session_not_found`.
- Duplicate rows map to sanitized `500 server_error`.
- Non-array lookup data maps to sanitized `500 server_error`.
- Unexpected lookup errors map to sanitized `500 server_error`.
- Invalid row shapes map to sanitized `500 server_error`.

Runtime status:

- `telegram-webhook` still returns inert `501 not_configured` on the valid
  skeleton path.
- The handler still verifies the Telegram secret header before body access.
- The handler still does not read, parse, or log request bodies.
- The new helpers are exported for tests and future approved adapter wiring, but
  are not called by the live handler yet.

Security confirmation:

- No `.env.local` or secret values were read.
- No `Deno.env` usage was added.
- No Supabase client or service-role client was added.
- No DB read/write was added.
- No Vault access was added.
- No Telegram API call was added.
- No webhook registration was added.
- No token refs or raw token values are returned by runtime code.
- No Edge Function deploy, Netlify publish, or push happened in this slice.

### Phase 5AU Telegram Update Parser Preflight

Phase 5AU prepares a pure Telegram Update parser contract. It does not wire
request-body parsing into the live webhook handler and does not enable command
processing.

Current findings:

- `telegram-webhook` has no Telegram Update parser.
- The live handler still does not call `request.json()`, `request.text()`, or
  any other request-body reader.
- Webhook verification, future session lookup, and chat authorization must all
  complete before a future runtime boundary may parse and route a command.
- The existing chat authorization helper already distinguishes `read_only`,
  `write`, and `approval`, but no command parser currently assigns those kinds.

Recommended first parser scope:

- Implement a pure helper that accepts an already-parsed `unknown` value.
- Do not let the helper accept `Request`, raw JSON text, headers, or secrets.
- Accept only Telegram `message` updates containing a text command.
- Extract only:
  - safe integer `update_id`
  - safe integer `message.message_id`
  - Telegram user ID from `message.from.id`
  - Telegram chat ID from `message.chat.id`
  - normalized allowlisted command name
  - command kind
- Allow only the read-only commands `/help` and `/status` in the first slice.
- Allow the Telegram group form `/help@bot_username` and
  `/status@bot_username`, while discarding the bot username from the parsed
  command result.
- Reject command arguments, free-form text, edited messages, callback queries,
  channel posts, and unknown commands.
- Never return the original message text or bot username.

Proposed pure result contract:

```ts
interface TelegramWebhookParsedCommand {
  updateId: string;
  messageId: string;
  telegramUserId: string;
  telegramChatId: string;
  command: "help" | "status";
  commandKind: "read_only";
}
```

Error contract:

- Missing or malformed update shape returns `400 invalid_update`.
- Missing user/chat identity returns `400 invalid_update`.
- Non-command text, unsupported update kinds, unknown commands, or command
  arguments return `422 unsupported_update`.
- Errors must be generic and must not echo message text, usernames, user IDs,
  chat IDs, or raw update content.

Tests required:

- Parse `/help` and `/status`.
- Parse `/help@bot_username` without returning the username.
- Reject unknown commands and command arguments.
- Reject non-command text.
- Reject edited messages, callback queries, and channel posts.
- Reject missing or unsafe integer IDs.
- Confirm errors do not expose raw message text, Telegram IDs, or usernames.
- Confirm the live handler still returns inert `not_configured` without reading
  the body.

What not to touch in Phase 5AU:

- No `request.json()` or other body access in `handleTelegramWebhookRequest`.
- No live RPC lookup.
- No DB read/write or service-role client.
- No chat authorization DB objects.
- No Telegram API calls or replies.
- No command execution, approval creation, wallet action, or activity logging.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push.

### Phase 5AU.1 Telegram Update Parser Contract Closeout

Phase 5AU.1 adds a pure Telegram Update parser and tests. The parser is not
wired into the live webhook handler.

Implemented files:

- `supabase/functions/telegram-webhook/update-parser.ts`
- `supabase/functions/telegram-webhook/update-parser_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

Implemented parser behavior:

- Accepts an already-parsed `unknown` value only.
- Does not accept or read a `Request`.
- Accepts only Telegram `message` updates.
- Accepts only `/help` and `/status`.
- Classifies both supported commands as `read_only`.
- Rejects unknown commands, command arguments, whitespace-suffixed commands,
  non-command text, edited messages, callback queries, and channel posts.
- Requires safe integer update, message, user, and chat IDs.
- Accepts a group command suffix only when it matches the explicitly provided
  expected bot username.
- Discards the matched bot username from the parsed result.
- Returns generic `invalid_update` or `unsupported_update` errors without raw
  update values.

Verification result:

- `npm run check:functions` passed.
- Deno checks passed.
- Telegram connect and webhook Deno tests passed: `139 passed`, `0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Deno format check passed.
- `git diff --check` passed.

Runtime and security status:

- `handleTelegramWebhookRequest` remains unchanged in behavior.
- Valid inert webhook requests still return `501 not_configured`.
- Missing webhook secret still rejects before any body access.
- No request-body parsing or logging was added.
- No env reads, Supabase client, service-role client, DB read/write, Vault
  access, Telegram API call, reply sending, or command execution was added.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push happened.

Next safest slice:

- Phase 5AV should audit/design a pure read-only command response contract for
  `/help` and `/status`. It must return only static or explicitly supplied safe
  metadata, remain disconnected from Telegram API reply sending, and avoid DB
  writes or command execution.

### Phase 5AV Read-Only Command Response Preflight

Phase 5AV prepares a pure response builder for the allowlisted `/help` and
`/status` commands. It does not send Telegram messages and does not wire command
processing into the live webhook handler.

Current findings:

- The update parser can produce only `help` or `status` with
  `commandKind=read_only`.
- There is no response builder or Telegram reply sender.
- Dynamic agent metadata is not required for the first safe response contract.
- Using dynamic names, IDs, logs, approvals, balances, or wallet state would
  create unnecessary disclosure and sanitization risk.

Recommended first response scope:

- Accept only a parsed `help` or `status` command.
- Return a plain-text response plan only.
- Keep response text static and bounded.
- Do not use Telegram Markdown or HTML parse modes.
- Do not include links, usernames, user/chat IDs, agent/workspace IDs, token
  refs, secrets, balances, approval details, logs, or message text.
- Do not accept arbitrary strings or metadata in the first response builder.

Proposed response contract:

```ts
interface TelegramReadOnlyCommandResponse {
  command: "help" | "status";
  text: string;
}
```

Proposed static messages:

- `/help`: list only `/help` and `/status`, and state that write, approval,
  wallet, and onchain actions are disabled.
- `/status`: state that the verified Telegram session is active, command access
  is read-only, and wallet/onchain actions are disabled.

Required caller preconditions for future runtime wiring:

- Webhook secret verification succeeded.
- Active session lookup succeeded.
- Update parsing succeeded.
- Chat authorization succeeded for a read-only command.
- The response builder must not be callable as proof that Telegram reply sending
  is enabled.

Tests required:

- `/help` returns only the allowlisted commands and disabled-action notice.
- `/status` returns only static active/read-only/disabled state.
- Both responses are bounded plain text.
- Neither response contains Telegram IDs, usernames, token/ref terminology,
  approval details, balances, raw update text, URLs, Markdown, or HTML.
- Unknown commands cannot reach the builder.
- The live handler remains inert and does not send a reply.

What not to touch in Phase 5AV:

- No Telegram API `sendMessage` helper.
- No reply sending or response delivery.
- No dynamic status lookup.
- No DB read/write, Vault access, service-role client, or env read.
- No command execution, approval creation, wallet action, or activity logging.
- No handler body parsing or runtime wiring.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push.

### Phase 5AV.1 Read-Only Command Response Contract Closeout

Phase 5AV.1 adds a pure, static read-only response builder and tests. It is not
wired into the live webhook handler and does not send Telegram messages.

Implemented files:

- `supabase/functions/telegram-webhook/read-only-response.ts`
- `supabase/functions/telegram-webhook/read-only-response_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

Implemented behavior:

- Accepts only `help` or `status`.
- Returns only `command` and bounded plain-text `text`.
- `/help` lists only `/help` and `/status`.
- `/status` states the active-session caller precondition, read-only access, and
  disabled write/approval/wallet/onchain actions.
- Does not accept dynamic strings, metadata, IDs, or status payloads.
- Unsupported commands return generic `422 unsupported_update` without echoing
  command text.

Verification result:

- `npm run check:functions` passed.
- Deno checks passed.
- Telegram connect and webhook Deno tests passed: `142 passed`, `0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Deno format check passed.
- `git diff --check` passed.

Runtime and security status:

- `handleTelegramWebhookRequest` remains inert and returns
  `501 not_configured` for the valid skeleton path.
- No request body read/parse/logging was added.
- No Telegram reply sender, `sendMessage`, Telegram API call, DB read/write,
  service-role client, Vault access, env read, or command execution was added.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push happened.

Next safest slice:

- Phase 5AW should audit/design a pure verified read-only command pipeline that
  composes update parsing, chat authorization, and static response building in
  the required order. It must not accept `Request`, perform session lookup,
  send replies, or be wired into the live handler.

### Phase 5AW Verified Read-Only Pipeline Preflight

Phase 5AW prepares a pure pipeline that composes the existing parser, chat
authorization contract, and static response builder. It does not verify webhook
headers or sessions itself and is not wired into the live handler.

Required future caller preconditions:

- Telegram webhook secret verification succeeded.
- Active webhook session lookup succeeded.
- The caller supplies the expected bot username from the verified active
  session.
- The caller supplies an already-resolved chat authorization policy.

Required pure pipeline order:

1. Parse the already-parsed unknown Telegram Update value.
2. Validate any group command target against the expected bot username.
3. Authorize the parsed Telegram user/chat identity for `read_only`.
4. Build the static read-only response only after authorization succeeds.
5. Return a backend-only response plan without user/chat IDs or policy details.

Proposed input contract:

```ts
interface TelegramVerifiedReadOnlyPipelineInput {
  update: unknown;
  expectedBotUsername?: string | null;
  chatPolicy: TelegramWebhookChatAuthorizationPolicy;
}
```

Proposed result contract:

```ts
interface TelegramVerifiedReadOnlyPipelineResult {
  command: "help" | "status";
  commandKind: "read_only";
  authorizationRole: "owner" | "admin" | "member" | "public_read_only";
  response: TelegramReadOnlyCommandResponse;
}
```

Security requirements:

- The result must not contain Telegram user/chat IDs, update/message IDs, bot
  username, owner/workspace IDs, policy contents, raw update text, secrets,
  token refs, or DB errors.
- Unauthorized chats must fail before a response plan is returned.
- Invalid/unsupported updates must fail before chat authorization.
- Public community access may receive only `read_only` commands.
- The pipeline must not accept `Request`, headers, raw JSON text, Supabase
  clients, Telegram clients, or arbitrary response text.

Tests required:

- Owner-authorized personal `/help` succeeds.
- Community member `/status` succeeds as read-only.
- Community public read-only access succeeds.
- Unknown personal chat returns `403 chat_not_authorized`.
- Missing chat identity returns `400 invalid_update`.
- Unsupported command returns `422 unsupported_update`.
- Mismatched bot username returns `422 unsupported_update`.
- Result shape excludes all identity and policy fields.
- Live handler remains inert and does not call the pipeline.

What not to touch in Phase 5AW:

- No live handler wiring or request body parsing.
- No webhook/session lookup or service-role client.
- No chat authorization DB objects or lookup.
- No Telegram reply sender/API call.
- No DB read/write, Vault access, env read, or logging.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push.

### Phase 5AW.1 Verified Read-Only Pipeline Contract Closeout

Phase 5AW.1 adds a pure verified read-only pipeline and tests. It is not wired
into the live webhook handler.

Implemented files:

- `supabase/functions/telegram-webhook/read-only-pipeline.ts`
- `supabase/functions/telegram-webhook/read-only-pipeline_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

Implemented behavior:

- Composes update parsing, target-bot validation, chat authorization, and static
  response building in that order.
- Authorizes only the parser-produced `read_only` command kind.
- Returns only command, command kind, authorization role, and static response.
- Excludes Telegram user/chat IDs, update/message IDs, policy details, bot
  username, and raw update content from the result.
- Unsupported updates fail before authorization.
- Unauthorized chats fail before a response plan is returned.

Verification result:

- `npm run check:functions` passed.
- Deno checks passed.
- Telegram connect and webhook Deno tests passed: `150 passed`, `0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Deno format check passed.
- `git diff --check` passed.

Runtime and security status:

- `handleTelegramWebhookRequest` remains inert and does not call the pipeline.
- No request body parsing/logging, live session lookup, reply sending, DB
  read/write, service-role client, Vault access, env read, Telegram API call, or
  command execution was added.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push happened.

### Phase 5AX Telegram Update Idempotency Preflight

Phase 5AX identifies the next required production-safety boundary: Telegram may
retry the same update, so live command processing must atomically deduplicate
updates before any response delivery or future write command.

Current findings:

- The parser extracts a safe integer `update_id`, but the pipeline intentionally
  does not return it.
- There is no private processed-update table or atomic claim RPC.
- `activity_logs` is not an idempotency store and has no uniqueness contract for
  Telegram session plus update ID.
- The live webhook handler is inert, so duplicate processing cannot happen yet.

Recommended future persistence model:

- Add a private table such as `public.telegram_processed_updates`.
- Use a unique key on `(telegram_session_id, telegram_update_id)`.
- Store only safe operational metadata:
  - `telegram_session_id`
  - `telegram_update_id`
  - processing status
  - created/completed timestamps
  - optional expiry timestamp for retention
- Never store raw Telegram payloads, message text, user/chat IDs, bot tokens,
  webhook secrets, token refs, or response text in the dedupe table.
- Enable RLS with no browser policies.
- Restrict table access and any claim RPC to `service_role`.

Recommended future atomic claim contract:

```ts
interface TelegramUpdateClaimResult {
  claimed: boolean;
  status: "claimed" | "duplicate";
}
```

- A first update atomically claims the session/update pair.
- A duplicate update returns a safe no-op result and must not rebuild or resend
  a response.
- Future runtime order must be parse -> target-bot validation -> chat
  authorization -> atomic claim -> response build -> response delivery.
- The initial read-only rollout may use at-most-once response delivery; users
  can reissue `/help` or `/status` if delivery fails.
- Write or approval commands require a separately reviewed recovery/lease model
  before they can ever be enabled.

Required future approvals:

- Schema/RLS/grant approval for the private dedupe table.
- Exact SQL forward and rollback review.
- Atomic claim RPC contract and privilege review.
- Retention policy approval.
- Verifier coverage and target-project baseline/post-apply results.
- Separate runtime wiring and deployment approval.

What can still be implemented without schema changes:

- Pure claim-result validators and sanitized error tests.
- Docs-only SQL design review.
- Tests proving duplicate results do not reach response building.

What not to touch yet:

- No dedupe table/RPC creation or SQL apply.
- No `activity_logs` reuse as an idempotency store.
- No live DB claim call.
- No request body parsing or live handler wiring.
- No reply sender, Telegram API call, deploy, Netlify publish/unlock, or push.

### Phase 5AX.1 Telegram Update Claim Contract Closeout

Phase 5AX.1 adds a pure validator for the future atomic update-claim RPC result.
It does not call a database or participate in the live webhook handler.

Implemented files:

- `supabase/functions/telegram-webhook/idempotency.ts`
- `supabase/functions/telegram-webhook/idempotency_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

Implemented behavior:

- Accepts only the exact safe result shapes:
  - `{ claimed: true, status: "claimed" }`
  - `{ claimed: false, status: "duplicate" }`
- Maps a duplicate result to a no-processing decision.
- Rejects inconsistent, malformed, or extra-field results.
- Sanitizes every unexpected validation failure to
  `500 server_error: Telegram update claim validation failed.`
- Does not return update IDs, session IDs, raw RPC results, raw errors, tokens,
  secrets, or other private values.

Verification result:

- `npm run check:functions` passed.
- Deno checks passed.
- Telegram connect and webhook Deno tests passed: `157 passed`, `0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Deno format check passed.
- `git diff --check` passed.

Runtime and security status:

- `handleTelegramWebhookRequest` remains inert and does not call the validator.
- The existing read-only pipeline remains unchanged and is not wired live.
- No DB/RPC call, DB read/write, schema/RLS change, service-role client, Vault
  access, env read, request body parsing/logging, Telegram API call, or reply
  delivery was added.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push happened.

### Phase 5AY Claim-Aware Read-Only Response Planning Preflight

Phase 5AY prepares a pure post-claim response-planning boundary. Its purpose is
to prove that duplicate updates cannot build or deliver a response before any
live persistence or handler wiring is approved.

Recommended pure contract:

```ts
type TelegramClaimedReadOnlyResponsePlan =
  | {
      status: "claimed";
      shouldDeliver: true;
      response: TelegramReadOnlyCommandResponse;
    }
  | {
      status: "duplicate";
      shouldDeliver: false;
    };
```

Recommended behavior:

- Validate the claim result before inspecting or building the response.
- Return a bounded duplicate no-op plan when the result is `duplicate`.
- Do not call the response builder for duplicate updates.
- Build a static read-only response only when the result is `claimed`.
- Preserve sanitized errors from the existing claim validator and response
  builder.
- Return no update ID, session ID, Telegram identity, policy, raw command text,
  raw claim result, or raw error.

Recommended tests:

- Claimed result builds one expected static response.
- Duplicate result returns a no-op plan and never calls the response builder.
- Invalid claim result fails before response building.
- Unsupported claimed command remains a sanitized `422 unsupported_update`.
- Result shapes contain only the approved bounded fields.

Files likely touched:

- `supabase/functions/telegram-webhook/claim-aware-response.ts`
- `supabase/functions/telegram-webhook/claim-aware-response_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

What not to touch in Phase 5AY:

- No existing read-only pipeline refactor or live handler wiring.
- No dedupe table/RPC, DB read/write, schema/RLS, or service-role client.
- No request body parsing/logging, Vault access, env read, Telegram API call,
  reply sender, or command execution.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push.

### Phase 5AY.1 Claim-Aware Read-Only Response Plan Closeout

Phase 5AY.1 adds a pure post-claim response planner and tests. It is not wired
into the existing read-only pipeline or live webhook handler.

Implemented files:

- `supabase/functions/telegram-webhook/claim-aware-response.ts`
- `supabase/functions/telegram-webhook/claim-aware-response_test.ts`
- `supabase/functions/telegram-webhook/index.ts` for exports only

Implemented behavior:

- Validates the claim result before inspecting the command.
- Returns a bounded `{ status: "duplicate", shouldDeliver: false }` no-op plan
  for duplicate updates.
- Proves duplicate updates do not invoke the static response builder by safely
  accepting an unsupported command on the duplicate path.
- Builds a static read-only response only for a valid claimed update.
- Rejects invalid claims before command handling and preserves the safe
  unsupported-command error contract.
- Excludes raw claim details, update IDs, session IDs, Telegram identities,
  policies, raw commands, and raw errors from returned plans.

Verification result:

- `npm run check:functions` passed.
- Deno checks passed.
- Telegram connect and webhook Deno tests passed: `162 passed`, `0 failed`.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- Deno format check passed.
- `git diff --check` passed.

Runtime and security status:

- `handleTelegramWebhookRequest` remains inert and does not call the planner.
- The existing read-only pipeline remains unchanged and is not wired live.
- No request body parsing/logging, DB/RPC call, DB read/write, schema/RLS
  change, service-role client, Vault access, env read, Telegram API call,
  outbound reply, or command execution was added.
- No SQL apply, Edge Function deploy, Netlify publish/unlock, or push happened.

### Phase 5AZ Read-Only Live Activation Gate

Phase 5AZ is the final prep-only checkpoint before any real Telegram webhook
behavior is allowed. It intentionally adds no runtime code. The remaining work
must be handled as a small number of explicit live-enablement approvals rather
than more inert helper phases.

Current repo readiness:

- Connect-side contracts exist for auth, ownership, token validation, secret
  storage, session persistence, webhook secret handling, webhook registration,
  rollback, and runtime gates.
- Webhook-side pure contracts exist for verification guards, active-session
  lookup results, chat authorization, update parsing, static read-only response
  building, update-claim validation, and duplicate-aware response planning.
- The live webhook handler still rejects missing verification before body
  access and otherwise returns `501 not_configured` without reading the body.
- No outbound Telegram reply sender exists.
- No private atomic update-claim table/RPC exists in repo schema.

Required approval gates before first live read-only smoke:

1. Database gate:
   - Approve exact forward and rollback SQL for webhook secret lookup, chat
     authorization, and atomic update claim.
   - Apply SQL separately and run baseline/post-apply privilege verifiers.
2. Runtime wiring gate:
   - Approve service-role-backed session/chat/claim adapters.
   - Approve body parsing only after webhook verification succeeds.
   - Preserve ordering: verify -> parse -> session lookup -> chat authorize ->
     atomic claim -> response build.
3. Outbound delivery gate:
   - Approve a bounded `sendMessage` adapter with strict timeout, sanitized
     errors, no token logging, and read-only static text only.
   - Preserve duplicate no-op behavior before any outbound call.
4. Deployment gate:
   - Approve Edge Function deployment separately from Netlify.
   - Run a controlled owner-only `/help` and `/status` smoke test.
5. Product gate:
   - Only after the smoke passes, approve replacing placeholder UI with a real
     connection state.

Explicit stop conditions:

- Do not wire or deploy live webhook processing while any database, runtime,
  outbound delivery, or deployment gate is unapproved.
- Do not enable write, approval, wallet, admin, or onchain Telegram commands in
  the first live rollout.
- Do not push, apply SQL, deploy Edge Functions, or publish/unlock Netlify as
  part of this prep-only checkpoint.

### Phase 5BA Database Gate Preflight

Phase 5BA audits the exact database boundary required before the first
owner-only read-only Telegram smoke. It does not modify schema/RLS/verifier SQL,
apply SQL, create rows, wire runtime DB access, deploy, or push.

Current findings:

- The repo already has a reviewed local session-lookup packet:
  - `supabase/telegram_webhook_receiver_forward_review.sql`
  - `supabase/telegram_webhook_receiver_rollback_review.sql`
- That packet creates only `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)`.
- `supabase/verify_authenticated_demo_write_lockdown.sql` already has detailed
  guarded checks for the session-lookup table/RPC.
- Chat authorization remains intentionally deferred. The verifier currently
  checks only its future object existence, basic browser-deny/service-role table
  privileges, and RPC execute grants; it does not yet prove exact columns,
  constraints, RLS state, matching semantics, or role/scope behavior.
- Atomic update idempotency has no table, RPC, SQL review packet, or verifier
  coverage yet.
- The target Supabase state is not inferred from local files. A fresh target
  baseline is mandatory before any later apply.

Database rollout decision:

1. Keep the existing webhook session-lookup packet as a standalone apply.
2. Prepare owner-only read-only chat authorization as a separate packet.
3. Prepare atomic Telegram update claim as a separate packet.
4. Apply and verify each packet in its own controlled window.
5. Stop before runtime wiring after every database apply.

Do not combine these packets. A combined apply would make rollback, verifier
interpretation, and privilege review unnecessarily broad.

#### Session Lookup Packet Decision

The existing session-lookup packet remains the recommended first database
packet. It must not be changed or applied as part of Phase 5BA.

Before a later approved apply:

- Confirm `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)` do not already exist.
- Capture the target verifier baseline immediately before apply.
- Review the existing forward and rollback packets together.
- Keep all webhook runtime and deployment gates disabled.
- Apply no chat authorization or idempotency objects in the same transaction.
- Run the verifier after apply and stop if any required result is false.

#### Owner-Only Read-Only Chat Authorization Decision

The first live smoke should not introduce community allowlists, public
read-only access, admin roles, write scope, or approval scope. Its database
authorization boundary should support exactly one active owner-linked
Telegram user/chat pair per agent.

Recommended future private table:

- `public.telegram_chat_authorizations`

Recommended initial columns:

- `id uuid primary key default gen_random_uuid()`
- `agent_id uuid not null references public.agent_instances(id) on delete cascade`
- `telegram_user_id text not null`
- `telegram_chat_id text not null`
- `role text not null default 'owner'`
- `command_scope text not null default 'read_only'`
- `created_at timestamptz not null default now()`
- `revoked_at timestamptz null`

Required initial constraints:

- `telegram_user_id` must be a canonical positive integer string.
- `telegram_chat_id` must be a canonical signed non-zero integer string.
- `role` must equal `owner`.
- `command_scope` must equal `read_only`.
- One active authorization row per agent.
- Exact matching must require both `telegram_user_id` and `telegram_chat_id` on
  the same active row. Independent user-or-chat matching is not allowed in the
  first live rollout.

Recommended future lookup RPC:

```sql
public.resolve_telegram_chat_authorization(
  p_agent_id uuid,
  p_telegram_user_id text,
  p_telegram_chat_id text,
  p_command_kind text
)
```

Required lookup behavior:

- Use exact input matching without trimming or implicit normalization.
- Return exactly one safe row only for an active owner pair and
  `p_command_kind = 'read_only'`.
- Return only bounded authorization metadata such as `authorized` and `role`.
- Never return Telegram user/chat IDs, agent/workspace/owner IDs, raw errors,
  secrets, refs, or policy rows.
- Unknown, revoked, mismatched, write, or approval requests must return no
  authorization result and map to a safe denial.

Required RLS/grant model:

- Enable RLS and create no browser-readable policy.
- Revoke all direct privileges from `public`, `anon`, and `authenticated`.
- Grant only the minimum `select`, `insert`, and `update` privileges required by
  the approved backend flow to `service_role`.
- Grant execute on the lookup RPC only to `service_role`.
- Use a stable SQL `SECURITY INVOKER` function with an empty search path and
  fully qualified relation names.

Community/project authorization, admin roles, public read-only access, and
write/approval scopes require a later schema expansion and separate approval.

#### Atomic Telegram Update Claim Decision

Recommended future private table:

- `public.telegram_processed_updates`

Recommended initial columns:

- `telegram_session_id uuid not null references public.telegram_sessions(id) on delete cascade`
- `telegram_update_id bigint not null`
- `created_at timestamptz not null default now()`

Required initial constraints:

- Primary key on `(telegram_session_id, telegram_update_id)`.
- `telegram_update_id >= 0`.
- No raw Telegram payload, message text, Telegram user/chat ID, command,
  response text, token, secret, secret ref, or error detail column.

Recommended future atomic claim RPC:

```sql
public.claim_telegram_update(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  claimed boolean,
  status text
)
```

Required claim behavior:

- Use one atomic `insert ... on conflict do nothing` boundary.
- Produce exactly one of:
  - `{ claimed: true, status: 'claimed' }`
  - `{ claimed: false, status: 'duplicate' }`
- Only return a result for an existing active Telegram session.
- An unknown or inactive session must not be reported as a duplicate.
- Never return session/update IDs or raw DB errors.
- Duplicate results must no-op before response building and outbound delivery.

Required RLS/grant model:

- Enable RLS and create no browser-readable policy.
- Revoke all direct privileges from `public`, `anon`, and `authenticated`.
- Grant only minimum `select` and `insert` access to `service_role`.
- Do not grant runtime `update`, `delete`, `truncate`, `references`, or trigger
  privileges.
- Grant execute on `claim_telegram_update(uuid,bigint)` only to `service_role`.
- Use a volatile SQL `SECURITY INVOKER` function with an empty search path and
  fully qualified relation names.
- Retention cleanup requires a separate maintenance design and must not broaden
  the webhook runtime role.

Required future verifier coverage:

- Exact object signatures, columns, nullability, constraints, indexes, RLS
  state, and absence of browser policies.
- No direct privileges for `public`, `anon`, or `authenticated`.
- Exact minimum direct privileges for `service_role`.
- Exact RPC language, volatility, security-invoker state, empty search path,
  result contract, and execute grants.
- Chat authorization lookup requires exact user-plus-chat pair matching and
  read-only command kind.
- Atomic claim uses `on conflict do nothing`, returns no IDs, and checks active
  session eligibility.
- Existing `telegram_session_summaries` and authenticated Telegram-session
  safety checks remain unchanged.

Files likely touched in later separately approved slices:

- A comment-only chat authorization schema draft.
- Chat authorization forward and rollback review packets.
- A comment-only atomic update claim schema draft.
- Atomic update claim forward and rollback review packets.
- `supabase/verify_authenticated_demo_write_lockdown.sql`.
- `supabase/schema.sql` only after a separately approved applied-schema sync.

Go/no-go:

- Go for separate local comment-only drafts and verifier-contract design.
- No-go for applying any SQL, editing `schema.sql`, changing RLS/grants,
  inserting authorization rows, wiring service-role adapters, parsing live
  webhook bodies, outbound Telegram calls, deployment, Netlify changes, or
  push.

### Phase 5BB And 5BC Database Draft Closeout

Phase 5BB and Phase 5BC add separate comment-only design artifacts:

- `supabase/telegram_chat_authorization_schema_draft.sql`
- `supabase/telegram_update_claim_schema_draft.sql`

Both files:

- Are fully comment-only and contain no executable SQL.
- Are explicitly marked `DRAFT ONLY - DO NOT APPLY`.
- Do not modify `schema.sql`, verifier SQL, schema/RLS/grants, or Supabase.
- Do not create tables, functions, policies, grants, rows, secrets, or runtime
  behavior.
- Do not wire service-role adapters, parse webhook bodies, call Telegram APIs,
  deliver replies, deploy, publish, or push.

Chat authorization draft decisions:

- First smoke is personal owner-only and read-only-only.
- Exact Telegram user and chat IDs must match on the same active row.
- One active owner authorization is allowed per agent.
- Community, public, admin, member, write, and approval behavior remains
  deferred.
- Future lookup result is bounded to authorization metadata and returns no
  Telegram IDs or private ownership/session fields.

Atomic update claim draft decisions:

- Composite `(telegram_session_id, telegram_update_id)` primary key is the
  atomic boundary.
- The claim RPC uses one insert-on-conflict operation and no pre-insert
  existence check.
- Unknown, inactive, or malformed input returns no result and must not be
  reported as duplicate.
- Runtime receives no update/delete/retention privilege.
- No Telegram payload, identity, command, response, token, secret, ref, or raw
  error is stored.

### Phase 5BD Database Verifier Extension Preflight

Phase 5BD prepares guarded read-only verifier coverage for the two new future
database slices. It does not approve applying their schema.

Current verifier findings:

- Chat authorization object references and basic privilege/execute checks
  already exist.
- Chat authorization exact shape, constraints, RLS/no-policy state, unique
  active-agent index, RPC security properties, result contract, and exact
  same-row matching are not yet verified.
- Atomic update claim objects have no verifier references or checks.
- The verifier is designed to tolerate unapplied future objects by returning
  guarded `false` values instead of raising object-not-found errors.

Required chat authorization verifier additions:

- Confirm regular table, exact columns/nullability, RLS enabled, and no policies.
- Confirm all stable named constraints and the active-agent partial unique
  index.
- Confirm `service_role` has only select/insert/update and lacks
  delete/truncate/references/trigger.
- Confirm lookup RPC is SQL, stable, `SECURITY INVOKER`, and has an empty search
  path.
- Confirm lookup RPC returns only `authorized boolean` and `role text`.
- Confirm function definition uses exact same-row agent/user/chat matching,
  owner role, read-only scope, read-only command kind, and active row.

Required atomic update claim verifier additions:

- Add guarded references for:
  - `public.telegram_processed_updates`
  - `public.claim_telegram_update(uuid,bigint)`
- Confirm regular table, exact three columns/nullability, RLS enabled, and no
  policies.
- Confirm composite primary key, session foreign key, and nonnegative update-ID
  constraint.
- Confirm no browser role has direct privileges.
- Confirm `service_role` has only select/insert and lacks
  update/delete/truncate/references/trigger.
- Confirm claim RPC is SQL, volatile, `SECURITY INVOKER`, and has an empty
  search path.
- Confirm claim RPC returns only `claimed boolean` and `status text`.
- Confirm function definition checks active session and nonnegative input, uses
  `ON CONFLICT ON CONSTRAINT telegram_processed_updates_pkey DO NOTHING`, and
  does not return session/update IDs.

Verifier safety rules:

- Keep the verifier as a single read-only query with no DDL or DML.
- Guard every future-object check so missing draft-only objects produce `false`
  rather than an error.
- Do not require draft-only object existence in the current production
  baseline.
- Preserve all existing demo-write lockdown, Telegram Vault, webhook session
  lookup, Telegram summary-view, and browser-safety checks.
- Do not run the verifier against Supabase without separate target-project and
  read-only audit approval.

Go/no-go:

- Go for a local guarded verifier-only extension after static review.
- No-go for editing `schema.sql`, creating executable forward/rollback packets,
  applying SQL, inserting rows, runtime DB wiring, request body parsing,
  Telegram API calls, deployment, Netlify changes, or push.

### Phase 5BD Database Verifier Extension Closeout

Phase 5BD extends `supabase/verify_authenticated_demo_write_lockdown.sql` with
guarded read-only checks for the future chat authorization and atomic update
claim objects.

Completed verifier coverage:

- Adds guarded references for `public.telegram_processed_updates` and
  `public.claim_telegram_update(uuid,bigint)`.
- Confirms exact table shape, RLS/no-policy state, named constraints, approved
  indexes, minimum role privileges, RPC security properties, result contracts,
  execute grants, and required function-definition behavior.
- Strengthens chat authorization checks for exact same-row agent/user/chat
  matching, owner/read-only/active requirements, and browser-role denial.
- Preserves existing demo-write lockdown, Telegram Vault, webhook receiver,
  summary-view, and browser-safety checks.
- Keeps missing future objects guarded so the verifier returns `false` for
  unapplied objects rather than raising object-not-found errors.

Verifier safety result:

- The verifier remains one read-only `WITH ... SELECT` statement.
- It contains no executable DDL or DML.
- Static structure checks, repository function checks, Deno checks/tests,
  TypeScript checks, build, and `git diff --check` passed locally.
- The expanded verifier has not been executed against Supabase.
- No schema/RLS/grant change, row write, secret access, runtime wiring, deploy,
  publish, or push occurred in this slice.

### Phase 5BE Forward And Rollback Packet Preflight

Phase 5BE defines how the two new database slices may later become local
review-only forward and rollback SQL packets. It does not create those packet
files, approve applying SQL, or modify remote database state.

Required future packet files:

- `supabase/telegram_chat_authorization_forward_review.sql`
- `supabase/telegram_chat_authorization_rollback_review.sql`
- `supabase/telegram_update_claim_forward_review.sql`
- `supabase/telegram_update_claim_rollback_review.sql`

Packet separation rule:

- Chat authorization and atomic update claim must remain separate packets.
- Neither packet may be combined with
  `supabase/telegram_webhook_receiver_forward_review.sql`.
- Each packet requires its own baseline, full-file review, rollback review,
  apply approval, post-apply verifier capture, and no-runtime-wiring stop.
- Recommended review/apply order is chat authorization first, then atomic
  update claim, while all webhook runtime gates remain disabled.

Required forward-packet contract:

- Mark the file `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL`.
- Use one transaction and abort if either exact future object already exists.
- Create only the table, constraints/indexes, RLS state, minimum grants, and
  exact RPC belonging to that packet.
- Revoke all relevant table/function privileges before granting the approved
  minimum to `service_role`.
- Create no browser-readable policies and grant no browser-role table or RPC
  access.
- Use SQL `SECURITY INVOKER`, an empty search path, and fully qualified relation
  names for both RPCs.
- Insert no authorization, claim, session, secret, token, or test rows.
- End with a verifier-required stop condition before any runtime wiring.

Required rollback-packet contract:

- Mark the file `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT APPROVAL`.
- Use one transaction and never use `CASCADE`.
- Refuse destructive rollback if the packet table contains any rows.
- Require all relevant Telegram runtime gates to remain disabled.
- Revoke execute before dropping the exact RPC signature.
- Revoke table privileges before dropping the exact table.
- Run the verifier after rollback and capture the expected absent-object state.
- If rows exist, runtime was enabled, or target drift is unknown, use a
  separately reviewed forward fix instead of rollback.

Chat authorization packet boundary:

- Creates only `public.telegram_chat_authorizations` and
  `public.resolve_telegram_chat_authorization(uuid,text,text,text)`.
- Preserves the owner-only, exact same-row user-plus-chat, read-only-only
  contract from the comment-only draft.
- Creates no authorization rows and does not define owner-linking runtime.
- Rollback must refuse to drop the table when any authorization row exists.

Atomic update claim packet boundary:

- Creates only `public.telegram_processed_updates` and
  `public.claim_telegram_update(uuid,bigint)`.
- Preserves the active-session, nonnegative update ID, composite-primary-key,
  and one atomic insert-on-conflict contract from the comment-only draft.
- Creates no claim rows and adds no retention/delete behavior.
- Rollback must refuse to drop the table when any processed-update row exists.

Required pre-apply approval and evidence for each packet:

1. Confirm the exact Supabase project and branch.
2. Confirm all Telegram runtime gates remain disabled.
3. Review the exact forward and rollback files together.
4. Run and capture the current read-only verifier baseline.
5. Confirm the packet objects are absent and existing browser-safety results
   remain true.
6. Approve the exact packet and a separate manual SQL apply window.
7. Run and capture the verifier immediately after apply.
8. Stop before runtime wiring if any required result is false.

Phase 5BE go/no-go:

- Go for creating the four separate local review-only packet files in later
  slices, one packet pair at a time, followed by static review.
- No-go for SQL apply, `schema.sql` edits, row insertion, service-role runtime
  adapters, request body parsing, Telegram API calls, reply delivery, Edge
  Function deploy, Netlify changes, or push.

Next safest slice:

- Phase 5BE.1 may create only the local chat authorization forward and rollback
  review packet files.
- The atomic update claim packet pair should wait until the chat authorization
  pair is reviewed and committed locally.

### Phase 5BE.1 Chat Authorization Review Packet Closeout

Phase 5BE.1 adds two local review-only SQL packet files:

- `supabase/telegram_chat_authorization_forward_review.sql`
- `supabase/telegram_chat_authorization_rollback_review.sql`

Current state:

- Both files are marked `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT
  APPROVAL`.
- The forward packet creates only the private chat authorization table and its
  exact owner-only read-only lookup RPC.
- The rollback packet refuses to drop the table when any authorization row
  exists and does not use `CASCADE`.
- The packet agrees with the comment-only draft and guarded verifier contract.
- Static packet checks, repository checks, Deno checks/tests, TypeScript
  checks, build, and `git diff --check` passed locally.
- No SQL was applied, no authorization row was created, `schema.sql` was not
  modified, and no runtime/deploy/publish/push occurred.

Still blocked before chat authorization SQL apply:

- Exact target-project and branch confirmation.
- Captured read-only verifier baseline.
- Full-file forward and rollback review together.
- Separate schema/RLS/grant and SQL apply approval.
- Post-apply verifier capture with every required chat authorization result
  true.
- Separate owner-linking and runtime lookup design/approval.

### Phase 5BE.2 Atomic Update Claim Review Packet Preflight

Phase 5BE.2 audits the local review-packet contract for future atomic Telegram
update claims. It does not create the packet files or approve SQL apply.

Readiness findings:

- `supabase/telegram_update_claim_schema_draft.sql` defines the exact table,
  constraint, privilege, and RPC contract.
- `supabase/verify_authenticated_demo_write_lockdown.sql` contains guarded
  checks for the future table and RPC.
- The runtime idempotency result validator and duplicate no-op response plan
  already exist as inert tested contracts.
- The live webhook handler remains inert and does not call the claim RPC.

Required future packet files:

- `supabase/telegram_update_claim_forward_review.sql`
- `supabase/telegram_update_claim_rollback_review.sql`

Required forward-packet behavior:

- Abort if `public.telegram_processed_updates` or
  `public.claim_telegram_update(uuid,bigint)` already exists.
- Create exactly the three-column private table, composite primary key, session
  foreign key, and nonnegative update-ID constraint.
- Create no extra indexes, status columns, payload columns, identity columns,
  response columns, retention behavior, or rows.
- Enable RLS with no browser-readable policies.
- Revoke all relevant table privileges before granting only select and insert
  to `service_role`.
- Create the volatile SQL `SECURITY INVOKER` claim RPC with an empty search
  path and fully qualified relation names.
- Use one atomic insert with
  `ON CONFLICT ON CONSTRAINT telegram_processed_updates_pkey DO NOTHING`.
- Perform no separate pre-insert processed-update lookup.
- Return only `claimed boolean` and `status text`.
- Revoke all relevant function privileges before granting execute only to
  `service_role`.

Required rollback-packet behavior:

- Refuse rollback if `public.telegram_processed_updates` contains any row.
- Require webhook runtime and claim adapter gates to remain disabled.
- Revoke execute before dropping the exact claim RPC signature.
- Revoke table privileges before dropping the exact table.
- Use no `CASCADE` and do not touch chat authorization or webhook receiver
  objects.
- Require a forward fix instead when claim rows exist, runtime was enabled, or
  target drift is unknown.

Concurrency and failure contract:

- One session/update pair can be claimed once through the composite primary
  key.
- Concurrent duplicate deliveries must produce one claimed result and bounded
  duplicate results for the rest.
- Unknown session, inactive session, negative update ID, or malformed RPC
  result must not be treated as duplicate.
- Duplicate must remain a no-op before response building and any future
  outbound Telegram call.

Phase 5BE.2 go/no-go:

- Go for creating only the two local atomic update claim review packet files,
  followed by static and repository verification.
- No-go for applying SQL, editing `schema.sql`, creating claim rows, adding a
  service-role claim adapter, wiring live webhook processing, calling Telegram,
  deploying, publishing Netlify, or pushing.

### Phase 5BE.2 Atomic Update Claim Review Packet Closeout

Phase 5BE.2 adds two local review-only SQL packet files:

- `supabase/telegram_update_claim_forward_review.sql`
- `supabase/telegram_update_claim_rollback_review.sql`

Current state:

- Both files are marked `REVIEW DRAFT - DO NOT APPLY WITHOUT EXPLICIT
  APPROVAL`.
- The forward packet creates only the minimal processed-update table and exact
  atomic claim RPC.
- The claim function contains exactly one processed-update insert, uses the
  approved primary-key conflict boundary, and performs no processed-update
  pre-read.
- The rollback packet refuses to drop the table when any claim row exists and
  does not use `CASCADE`.
- Static packet checks, repository checks, Deno checks/tests, TypeScript
  checks, build, and `git diff --check` passed locally.
- No SQL was applied, no claim row was created, `schema.sql` was not modified,
  and no runtime/deploy/publish/push occurred.

### Phase 5BF Database Apply Operator Checklist

Phase 5BF is documentation only. It defines two separate future manual SQL
apply windows for the chat authorization and atomic update claim packets. It
does not approve either apply window and does not change Supabase state.

Global pre-apply checklist:

1. Confirm the exact Supabase project and branch.
2. Confirm no Edge Function deploy, Netlify publish, or unrelated database
   change is included in the window.
3. Confirm all Telegram connect, webhook lookup, chat authorization, claim,
   command, and reply-delivery runtime gates remain disabled.
4. Review the exact forward and rollback files for only the packet being
   applied.
5. Run `supabase/verify_authenticated_demo_write_lockdown.sql` read-only and
   capture the full baseline.
6. Confirm existing browser-safety, webhook receiver, Vault, and Telegram
   summary-view results match the approved baseline.
7. Confirm the packet table and exact RPC signature are absent.
8. Confirm the packet rollback file is available and reviewed.
9. Stop if target-project drift, unexpected privileges, or unexpected objects
   are found.

Apply window 1: chat authorization packet:

1. Apply only `supabase/telegram_chat_authorization_forward_review.sql`.
2. Do not combine it with webhook receiver, atomic claim, owner-linking rows,
   runtime adapters, or deployment.
3. If the packet aborts because an object already exists, stop and audit
   instead of retrying or replacing the object.
4. Insert no chat authorization rows during schema apply.
5. Run and capture the verifier immediately after apply.

Required chat authorization post-apply results:

- `telegram_chat_authorizations_table_exists`
- `telegram_chat_authorizations_table_contract_is_expected`
- `telegram_chat_authorizations_constraints_are_expected`
- `telegram_chat_authorizations_active_agent_index_is_expected`
- `public_has_no_direct_telegram_chat_authorizations_privileges`
- `anon_has_no_direct_telegram_chat_authorizations_privileges`
- `auth_has_no_direct_telegram_chat_authorizations_privileges`
- `service_role_can_select_telegram_chat_authorizations`
- `service_role_can_insert_telegram_chat_authorizations`
- `service_role_can_update_telegram_chat_authorizations`
- `service_role_has_no_extra_telegram_chat_authorizations_privileges`
- `resolve_telegram_chat_authorization_function_exists`
- `resolve_telegram_chat_authorization_security_contract_is_expected`
- `resolve_telegram_chat_authorization_result_contract_is_expected`
- `resolve_telegram_chat_authorization_matching_contract_is_expected`
- `public_cannot_execute_resolve_telegram_chat_authorization`
- `anon_cannot_execute_resolve_telegram_chat_authorization`
- `auth_cannot_execute_resolve_telegram_chat_authorization`
- `service_role_can_execute_resolve_telegram_chat_authorization`

All required chat authorization results must be `true`. Atomic update claim
object-existence results must remain `false` until its separate apply window.
All unrelated verifier results must remain unchanged from the approved
baseline.

Apply window 2: atomic update claim packet:

1. Start only after the chat authorization apply result was captured and
   accepted, while runtime gates remain disabled.
2. Re-run and capture the verifier baseline for this second window.
3. Apply only `supabase/telegram_update_claim_forward_review.sql`.
4. Do not combine it with claim adapter wiring, webhook processing, response
   delivery, retention behavior, or deployment.
5. If the packet aborts because an object already exists, stop and audit
   instead of retrying or replacing the object.
6. Create no processed-update rows during schema apply.
7. Run and capture the verifier immediately after apply.

Required atomic update claim post-apply results:

- `telegram_processed_updates_table_exists`
- `telegram_processed_updates_table_contract_is_expected`
- `telegram_processed_updates_constraints_are_expected`
- `public_has_no_direct_telegram_processed_updates_privileges`
- `anon_has_no_direct_telegram_processed_updates_privileges`
- `auth_has_no_direct_telegram_processed_updates_privileges`
- `service_role_telegram_processed_updates_privileges_are_expected`
- `claim_telegram_update_function_exists`
- `claim_telegram_update_security_contract_is_expected`
- `claim_telegram_update_result_contract_is_expected`
- `claim_telegram_update_definition_contract_is_expected`
- `public_cannot_execute_claim_telegram_update`
- `anon_cannot_execute_claim_telegram_update`
- `auth_cannot_execute_claim_telegram_update`
- `service_role_can_execute_claim_telegram_update`

All required atomic update claim results and all previously accepted chat
authorization results must be `true`. All unrelated verifier results must
remain unchanged from the approved baseline.

Post-apply stop condition:

- Stop after verifier capture and review.
- Do not create owner-linking authorization rows.
- Do not create synthetic or real processed-update rows.
- Do not edit `schema.sql` until a separate applied-schema synchronization is
  approved.
- Do not wire service-role chat lookup or claim adapters.
- Do not parse live Telegram update bodies, deliver replies, deploy functions,
  publish Netlify, or enable runtime gates.

Rollback decision rules:

- Prefer transaction rollback for any failure during an initial packet apply.
- After commit, run rollback only when all relevant runtime gates remain
  disabled and the packet table contains zero rows.
- If both packets must be rolled back and both tables are empty, use reverse
  apply order: atomic update claim first, then chat authorization.
- Run the verifier after each rollback and capture the expected absent-object
  state.
- If any relevant row exists, runtime was enabled, or drift is uncertain, use
  a separately reviewed forward fix instead of destructive rollback.

Phase 5BF approval boundary:

- The local review artifacts and operator checklist are ready for full-file
  review.
- SQL apply remains blocked until the user explicitly approves the exact target
  project, exact packet, and manual apply window.
- Broad approval to continue local Phase 5 work does not authorize remote SQL
  apply, runtime enablement, deploy, publish, or push.

### Phase 5BJ Manual Apply State And Schema Sync Preflight

Phase 5BJ records the post-apply state after the two approved manual Supabase
SQL windows. It does not make another remote database change and does not enable
any Telegram runtime behavior.

Manual apply state:

- `supabase/telegram_chat_authorization_forward_review.sql` was applied manually
  in Supabase SQL Editor and returned success.
- `supabase/telegram_update_claim_forward_review.sql` was applied manually in
  Supabase SQL Editor and returned success.
- The operator captured verifier CSV exports after each manual apply.
- Runtime gates remain disabled: no Telegram API call, no webhook parsing, no
  reply delivery, no token input, no Edge Function deploy, and no Netlify deploy
  action was performed as part of these database applies.

Accepted verifier state:

- Chat authorization verifier results are all accepted as `true` for table
  existence, table contract, constraints, active-agent index, direct browser
  privilege denial, service-role-only table privileges, exact RPC existence,
  security contract, result contract, matching contract, browser-role execute
  denial, and service-role execute privilege.
- Atomic update claim verifier results are all accepted as `true` for processed
  update table existence, table contract, constraints, direct browser privilege
  denial, service-role-only privileges, exact RPC existence, security contract,
  result contract, atomic definition contract, browser-role execute denial, and
  service-role execute privilege.
- Existing Telegram session token safety results remain accepted, including no
  authenticated access to `token_secret_ref`, no broad authenticated
  `telegram_sessions` select grant, and service-role-only Vault token RPC
  access.
- Webhook receiver objects remain intentionally absent at this point:
  `telegram_webhook_secrets` and `resolve_telegram_webhook_session` are not part
  of the chat authorization or atomic update claim applies.

Repository drift after manual apply:

- The remote Supabase database now contains applied Telegram chat authorization
  and processed-update claim objects that are not yet represented in
  `supabase/schema.sql`.
- `supabase/schema.sql` still contains the earlier Telegram session and summary
  view baseline, but not:
  - `public.telegram_chat_authorizations`
  - `public.resolve_telegram_chat_authorization(uuid,text,text,text)`
  - `public.telegram_processed_updates`
  - `public.claim_telegram_update(uuid,bigint)`
- This drift is expected immediately after manual SQL apply, but should not
  remain unresolved before runtime wiring begins.

Recommended next boundary:

- Sync only the two already-applied object groups into `supabase/schema.sql`.
- Keep webhook receiver objects out of `schema.sql` until their own separately
  approved apply window succeeds.
- Keep the schema snapshot backend-only: no browser grants, no public policies,
  no token exposure, and no command-processing behavior.
- Run repository checks after the local schema sync, then commit locally.
- Do not push until the user explicitly accepts the schema-sync diff and the
  Netlify credit tradeoff.

What remains blocked:

- Real Telegram `getMe` or `setWebhook`.
- Edge Function deployment.
- Token input or token storage in the frontend.
- Creation, readback, or inspection of real secrets.
- Owner-linking authorization row creation.
- Live webhook parsing, chat authorization runtime lookup, processed-update
  claim adapter wiring, command execution, or reply delivery.
- Any additional schema/RLS/RPC object beyond the two already-applied packets.
- Netlify unlock, manual publish, or Git push without explicit approval.

### Phase 5BK Webhook Receiver Apply State

Phase 5BK records the manual Supabase apply for the webhook receiver session
lookup packet. It does not enable live Telegram webhook runtime behavior.

Manual apply state:

- `supabase/telegram_webhook_receiver_forward_review.sql` was applied manually
  in Supabase SQL Editor and returned success.
- The operator captured the post-apply verifier CSV from
  `supabase/verify_authenticated_demo_write_lockdown.sql`.
- No webhook secret row was created during the schema apply.
- No token, webhook secret, environment value, Telegram API request, Edge
  Function deploy, Netlify publish, or runtime gate enablement occurred in this
  phase.

Accepted verifier state:

- `telegram_webhook_secrets` exists as a regular private table with the expected
  columns, no `agent_id`, RLS enabled, no policies, expected primary key,
  expected session foreign key, expected ref/hash checks, and expected active
  partial unique indexes.
- `public`, `anon`, and `authenticated` cannot select, insert, update, or delete
  `telegram_webhook_secrets`.
- `service_role` can select, insert, and update `telegram_webhook_secrets`, and
  cannot delete, truncate, reference, or trigger it.
- `resolve_telegram_webhook_session(text)` exists, uses SQL, is stable,
  security-invoker, has an empty search path, has the expected result contract,
  uses exact hash matching, denies browser-role execution, and allows
  `service_role` execution.
- Previously accepted Vault token RPC, chat authorization, processed-update
  claim, Telegram session summary, and `token_secret_ref` safety checks remain
  accepted.

Repository sync decision:

- `supabase/schema.sql` should now include the webhook receiver objects because
  they are present in the remote Supabase database and passed verifier review.
- The schema snapshot must remain backend-only: no browser grants, no public
  policies, no raw webhook secret, no token exposure, and no runtime behavior.
- Runtime wiring remains blocked until a separate local adapter review and
  deployment decision.

Still blocked after Phase 5BK:

- Creating webhook secret rows.
- Enabling connect finalization, webhook lookup, chat authorization lookup,
  update claim adapter, command processing, reply delivery, or any Telegram API
  call.
- Deploying Edge Functions or publishing Netlify.
- Pushing local commits without explicit approval.

### Phase 5BL Webhook Session Lookup Runtime Preflight

Phase 5BL audits the next safe runtime boundary after the webhook receiver
schema and verifier passed. It does not wire the live webhook handler and does
not deploy Edge Functions.

Current runtime state:

- `telegram-webhook` still verifies method, `X-Telegram-Bot-Api-Secret-Token`,
  JSON content type, and `Content-Length`, then returns inert `501
  not_configured`.
- The live handler still does not read, parse, log, or process the request body.
- The live handler does not create a Supabase client, read service-role secrets,
  call RPCs, write database rows, call Telegram APIs, or deliver replies.
- Existing pure helpers already validate webhook session lookup result shape,
  sanitize lookup errors, parse supported read-only commands, enforce chat
  authorization policy, validate update claim results, and build static
  read-only responses.

Database readiness:

- `public.telegram_webhook_secrets` and
  `public.resolve_telegram_webhook_session(text)` are applied and verified.
- The lookup RPC accepts only the lowercase SHA-256 hash of the Telegram webhook
  secret header and returns active session metadata needed internally by the
  webhook runtime.
- Browser roles cannot read the private table or execute the lookup RPC.
- `service_role` can execute the lookup RPC and has only the reviewed direct
  table privileges.

Recommended next implementation slice:

- Add an inert, test-only/importable webhook session lookup adapter.
- The adapter should accept an injected RPC client and the raw verified webhook
  secret header value.
- The adapter should SHA-256 hash the header value in memory, call
  `resolve_telegram_webhook_session` with `{ p_webhook_secret_hash }`, and pass
  the RPC result through the existing sanitized result validator.
- The adapter must not log, return, persist, or expose the raw webhook secret,
  hash, owner ID, workspace ID, token reference, or raw RPC error.
- The live `telegram-webhook` handler should remain inert and should not call
  the adapter until a separate default-off runtime gate is approved.

Tests required for the next slice:

- Hash helper returns lowercase SHA-256 hex and rejects missing/blank input
  safely.
- Adapter calls only `resolve_telegram_webhook_session` with the hashed header.
- Active single-row RPC result maps through the existing validator.
- Missing rows return sanitized `404 session_not_found`.
- RPC errors, duplicate rows, or invalid row shape return sanitized
  `500 server_error` without leaking raw header, hash, owner/workspace IDs, or
  `token_secret_ref`.
- Live handler tests still prove missing secret rejects before any body read and
  valid inert requests still return `not_configured` without body read.

Still not allowed in Phase 5BL:

- Mounting the adapter into the live handler.
- Creating a service-role client in `telegram-webhook` runtime.
- Reading `.env.local` or secret values.
- Creating webhook secret rows.
- Parsing live request bodies, claiming updates, authorizing chats through DB,
  building replies from live updates, or delivering Telegram replies.
- Edge Function deploy, Netlify publish, or Git push.

### Phase 5BL.1 Webhook Session Lookup Adapter Closeout

Phase 5BL.1 adds a pure/importable webhook session lookup adapter for future
runtime wiring. It does not mount the adapter in the live handler.

Implemented local-only code:

- `telegram-webhook/session-lookup.ts` hashes a verified webhook secret header
  value with SHA-256 in memory and returns lowercase hexadecimal.
- The adapter calls only the injected `resolve_telegram_webhook_session` RPC
  client boundary with `{ p_webhook_secret_hash }`.
- The adapter passes RPC results through the existing sanitized session lookup
  validator.
- The adapter does not create a Supabase client, read environment values, write
  database rows, parse Telegram update bodies, call Telegram APIs, or deliver
  replies.
- `telegram-webhook/index.ts` exports the helper for tests and future approved
  wiring, but the live request handler remains inert.

Test coverage added:

- Deterministic lowercase SHA-256 hashing.
- Missing or blank header rejection as generic
  `webhook_verification_failed`.
- Exact RPC name and argument shape.
- Successful active session mapping.
- Missing row handling as sanitized `session_not_found`.
- RPC failure, duplicate rows, and invalid row shape as sanitized
  `server_error`.
- No response/error path exposes the raw webhook secret header, hash,
  `token_secret_ref`, owner ID, or workspace ID.

Runtime state after Phase 5BL.1:

- Valid live `telegram-webhook` requests still return `501 not_configured`
  without reading the body.
- Missing webhook secret headers still reject before any body read.
- No service-role client exists in `telegram-webhook`.
- No runtime DB read/write is active.
- No Edge Function deploy, Netlify publish, or Git push is part of this slice.

### Phase 5BM Webhook Lookup Runtime Gate Plan

Phase 5BM defines the default-off runtime gate needed before the webhook
session lookup adapter can ever be mounted in the live handler. It does not
mount the adapter or create a service-role client yet.

Recommended gate:

- `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED`
- Enabled only when the exact string is `true`.
- Missing, blank, `false`, `1`, `yes`, mixed-case, or any other value must be
  treated as disabled.
- The gate is backend-only Edge Function configuration. It must not be exposed
  through browser runtime config or frontend UI.

Default-off behavior:

- When disabled, `telegram-webhook` must keep the current inert behavior:
  header/content checks then `501 not_configured`, without reading the body.
- When disabled, no service-role key should be read, no Supabase client should
  be created, no RPC should be called, and no body parsing should happen.
- Runtime helpers may parse the gate and return an inert config object, but they
  must not perform side effects.

Future enabled behavior, not in this slice:

- Read `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only after the webhook
  secret header is present and the lookup gate is explicitly enabled.
- Create a service-role client only inside trusted Edge Function runtime.
- Hash the verified secret header and call
  `resolve_telegram_webhook_session(text)` through the already-tested adapter.
- Keep the handler response `not_configured` until body parsing, chat
  authorization lookup, idempotency claim, and reply delivery are separately
  approved.

Tests required before mounting:

- Gate parser defaults off and requires exact `true`.
- Runtime config does not call env readers or factories while disabled.
- Enabled config exposes only lazy dependency factories.
- Handler remains inert and body-safe when the gate is disabled.
- Security scan confirms no live service-role client or RPC call exists in the
  handler before the mounting slice.

Still blocked in Phase 5BM:

- Reading `.env.local` or secret values.
- Creating a service-role client in the live `telegram-webhook` handler.
- Calling `resolve_telegram_webhook_session` from the live handler.
- Parsing Telegram update bodies, claiming updates, authorizing chats through
  DB, building live replies, or delivering Telegram messages.
- Edge Function deploy, Netlify publish, or Git push.

### Phase 5BM.1 Webhook Lookup Runtime Gate Closeout

Phase 5BM.1 adds only the default-off webhook lookup gate parser and runtime
config helper. It does not mount lookup behavior in the live handler.

Implemented:

- `telegram-webhook/runtime-config.ts`
- `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED`
- `isTelegramWebhookLookupEnabled(value)` returns `true` only for the exact
  string `true`.
- `createTelegramWebhookLookupRuntimeConfig(readOptionalEnv)` reads only the
  gate key and returns `{ enabled: false }` or `{ enabled: true }`.
- `telegram-webhook/index.ts` exports the helper for tests and future approved
  wiring.

Tests added:

- Missing, blank, false-like, numeric, yes-like, mixed-case, and whitespace
  values are disabled.
- Exact `true` is enabled.
- Disabled config reads only the lookup gate key and exposes no service-role
  factory.
- Enabled config exposes only the enabled state.

Runtime state after Phase 5BM.1:

- The live `telegram-webhook` handler still does not call the config helper.
- No `Deno.env`, service-role client, RPC call, request body parsing, DB write,
  Telegram API call, reply delivery, Edge Function deploy, Netlify publish, or
  Git push is introduced by this slice.

### Phase 5BN Webhook Lookup Runtime Mount

Phase 5BN mounts the already-tested webhook session lookup adapter behind the
default-off `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED` gate. This is still not a
live Telegram command processor.

Runtime order:

- `OPTIONS` returns CORS `ok`.
- Non-`POST` requests reject before any lookup work.
- Missing `X-Telegram-Bot-Api-Secret-Token` rejects before body access, env
  access, RPC client creation, or lookup.
- `Content-Type` and `Content-Length` guards run before lookup.
- When the lookup gate is disabled, the handler keeps returning
  `501 not_configured` without reading the body, reading service env values,
  creating an RPC client, or calling the DB.
- When the lookup gate is enabled, the handler hashes the verified secret header
  through the adapter, calls `resolve_telegram_webhook_session(text)` through a
  backend-only service-role RPC boundary, then still returns `501
  not_configured` without parsing the Telegram update body.

Implementation notes:

- The gate remains exact-string only: only `true` enables lookup.
- Runtime dependencies are created lazily. `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` are read only when the gate is enabled and a
  guarded request reaches lookup.
- The webhook runtime uses a narrow server-side REST RPC client for
  `resolve_telegram_webhook_session(text)` instead of broad table access.
- No request body is parsed, no Telegram API is called, no Telegram message is
  sent, and no DB write is performed.
- Lookup failures are returned through sanitized error contracts and must never
  echo the raw webhook secret header, webhook hash, owner id, workspace id,
  `token_secret_ref`, or raw DB error payload.

Tests added:

- Disabled lookup gate ignores a supplied lookup dependency and keeps the
  response inert.
- Enabled lookup gate calls lookup after header/content/body-size guards and
  before any body access.
- Unsupported content type and oversized content length reject before lookup.
- Session miss returns sanitized `session_not_found` before body access.
- Runtime dependency creation reads only the lookup gate key while disabled.
- Enabled runtime dependency creation exposes lookup lazily without requiring
  service env values during creation.

Still blocked after Phase 5BN:

- Enabling `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED` in production.
- Deploying the Edge Function.
- Parsing Telegram update bodies in the live handler.
- Running chat authorization, idempotency claim, response planning, or reply
  delivery from the live handler.
- Calling Telegram API, including `sendMessage`.
- Reading `.env.local` or real secret values during local development.
- Netlify unlock/publish or Git push without explicit approval.

### Phase 5BO Webhook Body Parse Runtime Mount

Phase 5BO mounts the pure Telegram update parser behind a separate default-off
runtime gate. It still does not authorize chats through DB, claim updates,
build a live response, send Telegram messages, call Telegram API, write DB rows,
deploy Edge Functions, publish Netlify, or push Git commits.

Recommended gate:

- `KYRA_TELEGRAM_WEBHOOK_PARSE_ENABLED`
- Enabled only when the exact string is `true`.
- This gate is backend-only and must not be exposed through frontend config.

Runtime order:

- Run method, webhook secret header, content-type, and content-length guards.
- Run webhook session lookup only when
  `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED=true`.
- Parsing may run only after a successful active session lookup.
- If parsing is enabled without a lookup session, return a sanitized
  `500 server_error` before reading the body.
- Read the Telegram update body through a bounded streaming JSON helper, not
  through raw `request.json()`.
- Parse with the resolved session `bot_handle` as the expected bot username.
- After parsing succeeds, still return `501 not_configured`.

Security requirements:

- Disabled parse gate must not read the request body.
- Missing webhook secret, unsupported content type, and oversized
  `Content-Length` must reject before body access.
- The streaming body reader must enforce `maxTelegramWebhookBodyBytes` even when
  `Content-Length` is absent.
- Parser errors must not echo raw message text, Telegram user/chat IDs, bot
  usernames, webhook secret headers, hashes, owner IDs, workspace IDs, token
  refs, or raw DB errors.

Tests required:

- Parse gate defaults off and requires exact `true`.
- Runtime dependencies read only lookup and parse gate keys during creation.
- Disabled parse gate keeps handler body-safe.
- Parse gate enabled without lookup returns sanitized server error before body
  read.
- Parse gate enabled with lookup success reads and parses a valid read-only
  update, then still returns `not_configured`.
- Invalid JSON, unsupported updates, and over-limit streaming bodies return
  sanitized errors.

Still blocked after Phase 5BO:

- Enabling parse in production.
- Chat authorization DB lookup in live handler.
- Idempotency claim in live handler.
- Response planning or Telegram reply delivery.
- Telegram API calls.
- Edge Function deploy, Netlify publish, or Git push without explicit approval.

### Phase 5BP Chat Authorization Lookup Adapter

Phase 5BP prepares the backend-only adapter for the already-applied
`resolve_telegram_chat_authorization(uuid,text,text,text)` RPC. It does not
mount chat authorization in the live webhook handler yet.

Adapter contract:

- Input comes from an already-resolved webhook session and an already-parsed
  Telegram update.
- Call only `resolve_telegram_chat_authorization` with:
  - `p_agent_id`
  - `p_telegram_user_id`
  - `p_telegram_chat_id`
  - `p_command_kind`
- Return only bounded authorization metadata compatible with the webhook
  authorization model.
- Missing rows or `authorized=false` map to `403 chat_not_authorized`.
- Duplicate rows, invalid row shapes, RPC errors, and unexpected exceptions map
  to sanitized `500 server_error`.

Security requirements:

- The adapter must never return or log raw Telegram message text, raw DB errors,
  owner IDs, workspace IDs, token refs, webhook secret hashes, or raw webhook
  secret headers.
- The adapter must not use browser credentials.
- The adapter must not write DB rows.
- The live handler must not call the adapter until a separate default-off
  runtime gate/mount slice is approved and tested.

Tests required:

- Exact RPC function name and argument names.
- One authorized owner row maps to `{ authorized: true, role: "owner" }`.
- Empty rows and false authorization map to `403 chat_not_authorized`.
- Duplicate rows, invalid role, non-array data, RPC errors, and thrown adapter
  errors are sanitized.

Still blocked after Phase 5BP:

- Creating a live handler dependency for chat authorization.
- Calling chat authorization lookup from `handleTelegramWebhookRequest`.
- Enabling parse/authorization gates in production.
- Idempotency claim, response planning, Telegram reply delivery, Edge Function
  deploy, Netlify publish, or Git push without explicit approval.

### Phase 5BQ Chat Authorization Runtime Mount

Phase 5BQ mounts the chat authorization adapter behind a separate default-off
runtime gate. It still does not claim Telegram updates, plan live responses,
send Telegram replies, call Telegram API, write DB rows, deploy Edge Functions,
publish Netlify, or push Git commits.

Recommended gate:

- `KYRA_TELEGRAM_WEBHOOK_CHAT_AUTH_ENABLED`
- Enabled only when the exact string is `true`.
- This gate is backend-only and must not be exposed through frontend config.

Runtime order:

- Verify method, webhook secret header, content type, and body size headers.
- Resolve active webhook session only when lookup gate is enabled.
- Parse the bounded JSON update only when parse gate is enabled.
- Chat authorization may run only after both session lookup and update parsing
  succeed.
- Chat authorization calls only
  `resolve_telegram_chat_authorization(uuid,text,text,text)`.
- After authorization succeeds, the handler still returns `501 not_configured`.

Security requirements:

- Disabled authorization gate must not call the authorization adapter.
- Authorization gate enabled without a lookup session or parsed update must fail
  safely before doing the wrong step.
- Parse failures must prevent authorization lookup.
- Authorization errors must never echo Telegram user/chat IDs, owner IDs,
  workspace IDs, webhook secrets, webhook hashes, token refs, raw DB errors, or
  raw message text.

Tests required:

- Gate defaults off and requires exact `true`.
- Runtime dependencies read lookup, parse, and authorization gate keys.
- Disabled authorization gate ignores a supplied authorization dependency.
- Authorization enabled without parsed update returns sanitized server error.
- Valid lookup + parse + authorization still returns `not_configured`.
- Unauthorized chat maps to `403 chat_not_authorized`.
- Parse failure prevents authorization lookup.

Still blocked after Phase 5BQ:

- Enabling lookup/parse/chat authorization gates in production.
- Idempotency claim in the live handler.
- Response planning and Telegram reply delivery in the live handler.
- Telegram API calls, Edge Function deploy, Netlify publish, or Git push without
  explicit approval.

### Phase 5BR Telegram Update Claim Adapter

Phase 5BR prepares the backend-only adapter for the already-applied
`claim_telegram_update(uuid,bigint)` RPC. It does not mount idempotency claiming
in the live webhook handler yet.

Adapter contract:

- Input comes from an active webhook session and an already-parsed Telegram
  update.
- Call only `claim_telegram_update` with:
  - `p_telegram_session_id`
  - `p_telegram_update_id`
- Accept only the bounded result forms:
  - `{ claimed: true, status: "claimed" }`
  - `{ claimed: false, status: "duplicate" }`
- Return duplicate deliveries as a bounded no-op decision, not as an error.
- Empty rows map to `404 session_not_found`.
- Duplicate rows, invalid row shapes, RPC errors, and unexpected exceptions map
  to sanitized `500 server_error`.

Security requirements:

- The adapter must never return or log raw Telegram update bodies, raw DB
  errors, owner IDs, workspace IDs, Telegram chat/user IDs, token refs, webhook
  hashes, or webhook secret headers.
- The adapter must not use browser credentials.
- The adapter must not call Telegram API.
- The live handler must not call the adapter until a separate default-off
  runtime gate/mount slice is approved and tested.

Tests required:

- Exact RPC function name and argument names.
- Claimed and duplicate rows map to bounded claim results.
- Empty rows map to `session_not_found`.
- Duplicate rows, invalid result shape, non-array data, RPC errors, and thrown
  errors are sanitized.
- Invalid update IDs reject before RPC.

Still blocked after Phase 5BR:

- Creating a live handler dependency for update claim.
- Calling `claim_telegram_update` from `handleTelegramWebhookRequest`.
- Response planning, Telegram reply delivery, Edge Function deploy, Netlify
  publish, or Git push without explicit approval.

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

## Phase 5BS Combined - Webhook Claim Runtime Gate

Phase 5BS mounts the existing Telegram update idempotency claim adapter into the
webhook runtime behind a new default-off gate:

- `KYRA_TELEGRAM_WEBHOOK_CLAIM_ENABLED`

The gate must only enable on the exact string `true`. Any other value keeps the
runtime inert.

Runtime order:

1. Verify `X-Telegram-Bot-Api-Secret-Token`.
2. Validate JSON content type and body size headers.
3. Resolve the active Telegram webhook session when lookup is enabled.
4. Parse the Telegram update when parse is enabled.
5. Authorize the Telegram chat when chat authorization is enabled.
6. Claim the Telegram update idempotently only after the parsed update is
   authorized.
7. Return the existing `not_configured` response until response delivery is
   separately approved.

Security rules:

- Claiming must never run before chat authorization.
- Claiming must use only the injected `claim_telegram_update(uuid,bigint)` RPC
  client boundary.
- The webhook handler must not perform direct table `insert`, `upsert`, or
  `update` operations.
- Claim failures must return sanitized errors and must not expose update id,
  session id, agent id, workspace id, owner id, webhook secret, token refs, or
  raw DB errors.
- Duplicate claims remain a backend no-op for now; response delivery and
  duplicate-specific HTTP behavior require a separate approval.

Files touched:

- `supabase/functions/telegram-webhook/runtime-config.ts`
- `supabase/functions/telegram-webhook/runtime-config_test.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`
- `docs/telegram-integration-plan.md`

Verification required:

- `npm run check:functions`
- `deno check supabase/functions/telegram-connect/index.ts supabase/functions/telegram-webhook/index.ts`
- `deno test supabase/functions/telegram-connect supabase/functions/telegram-webhook`
- `npm exec tsc -- --noEmit`
- `npm run build`
- `git diff --check`

Still not included:

- No Telegram API response delivery.
- No `sendMessage`.
- No real BotFather token handling.
- No Vault read/write.
- No schema/RLS changes.
- No Edge Function deploy.
- No Netlify publish/unlock.

## Phase 5BT Combined - Telegram Response Delivery Contract

Phase 5BT adds an isolated Telegram response delivery helper for future
read-only replies. The helper is exported for tests and later wiring, but it is
not called from `handleTelegramWebhookRequest` yet.

Contract:

- Accept only a backend-resolved BotFather token at the delivery boundary.
- Accept only a validated Telegram chat id from the parsed update.
- Accept only a bounded `TelegramReadOnlyCommandResponse`.
- Build a `sendMessage` request with:
  - `chat_id`
  - `text`
  - `disable_web_page_preview: true`
- Return only `{ delivered: true }`.

Security rules:

- The helper must use injected `fetch` in tests and must not perform live
  network calls during local verification.
- The helper must not log the request, response, token, chat id, or Telegram
  error body.
- The bot token may appear only in the Telegram API URL inside the backend
  request boundary and must never appear in request body, API response, thrown
  error, docs examples with real values, or frontend state.
- Unauthorized, malformed, rate-limited, network, timeout, and Telegram 5xx
  failures must map to sanitized errors.
- `handleTelegramWebhookRequest` must remain unchanged in behavior and continue
  returning `not_configured`.

Files touched:

- `supabase/functions/telegram-webhook/response-delivery.ts`
- `supabase/functions/telegram-webhook/response-delivery_test.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `docs/telegram-integration-plan.md`

Still not included:

- No runtime response delivery gate.
- No webhook handler call to `sendMessage`.
- No token secret resolution.
- No Telegram API call during local tests.
- No schema/RLS changes.
- No Edge Function deploy.
- No Netlify publish/unlock.

## Phase 5BU Combined - Webhook Response Delivery Runtime Gate

Phase 5BU mounts read-only response planning and delivery orchestration into the
webhook handler behind a new default-off gate:

- `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED`

The handler still remains inert unless all prior gates are explicitly enabled
and a delivery dependency is injected. The default production dependency setup
does not resolve tokens and does not create a live delivery dependency yet.

Runtime order:

1. Verify webhook secret.
2. Resolve active webhook session.
3. Parse update.
4. Authorize chat.
5. Claim update idempotently.
6. Build a read-only response plan from the claim and parsed command.
7. Deliver only if the claim is new and delivery dependency is configured.

Duplicate update behavior:

- Duplicate claims return a bounded `duplicate` no-op response.
- Duplicate claims must not call delivery.

Security rules:

- Delivery must never run before claim success.
- Delivery must never run before chat authorization.
- The default runtime must not resolve BotFather tokens yet.
- Unexpected delivery dependency failures must map to sanitized Telegram
  unavailable errors.
- Handler responses must not expose token, chat id, session id, agent id,
  workspace id, owner id, or Telegram raw error bodies.

Files touched:

- `supabase/functions/telegram-webhook/runtime-config.ts`
- `supabase/functions/telegram-webhook/runtime-config_test.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`
- `supabase/functions/telegram-webhook/response-delivery.ts`
- `docs/telegram-integration-plan.md`

Still not included:

- No token secret resolution.
- No runtime `sendMessage` dependency from production env.
- No Edge Function deploy.
- No Netlify publish/unlock.
- No schema/RLS changes.

## Phase 5BV - Webhook Token Resolution Bridge Design

Phase 5BV defines the safest bridge between an authorized, claimed Telegram
webhook update and the backend-only BotFather token needed for response
delivery. This phase is documentation and design only.

Current findings:

- Response planning and delivery orchestration already exists behind
  `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED`.
- The default webhook runtime still cannot deliver a live Telegram response
  because no production delivery dependency is created.
- `telegram-connect/secret-store.ts` already contains a backend-only
  `resolveTelegramBotToken({ tokenSecretRef })` adapter contract for the
  `resolve_telegram_bot_token` RPC.
- `telegram-webhook` session lookup currently returns only safe session
  metadata and intentionally does not expose `token_secret_ref`.
- `token_secret_ref` must continue to be treated as sensitive backend metadata
  even though it is not the raw BotFather token.

Recommended architecture:

- Keep `token_secret_ref` out of browser-facing views, API responses, webhook
  responses, logs, and public session lookup payloads.
- Prefer a webhook-side token resolver adapter that accepts only the active
  Telegram session id after webhook verification, session lookup, body parsing,
  chat authorization, and idempotency claim have all succeeded.
- Preferred RPC shape for the live bridge:

```sql
public.resolve_telegram_delivery_token(
  p_telegram_session_id uuid
) returns text
```

- The RPC must be executable only by `service_role`.
- The RPC must resolve the active session to its private `token_secret_ref`
  internally, then resolve the raw BotFather token inside the trusted database
  or secret boundary.
- The raw BotFather token may exist only inside the Edge Function invocation
  memory long enough to call the injected Telegram delivery helper.
- The token resolver adapter must return only `{ botToken }` to the webhook
  runtime and must never return `token_secret_ref`, owner id, workspace id,
  webhook secret material, raw DB errors, or Vault internals.

Alternative architecture:

- Reuse `resolve_telegram_bot_token(p_token_secret_ref text)` from the webhook
  runtime only if a separately approved server-only path can obtain
  `token_secret_ref` without exposing it in public session lookup records.
- Avoid extending `resolve_telegram_webhook_session(text)` to return
  `token_secret_ref` unless this is explicitly approved, because it broadens the
  data carried by the webhook session lookup boundary.

Runtime order when later implemented:

1. Verify `X-Telegram-Bot-Api-Secret-Token`.
2. Resolve active webhook session.
3. Parse Telegram update.
4. Authorize Telegram chat.
5. Claim Telegram update idempotently.
6. Resolve delivery token using only the claimed active session id.
7. Deliver the bounded read-only response.
8. Drop the token from local scope immediately after delivery.

Security rules:

- Never resolve a token before webhook verification, chat authorization, and
  idempotency claim success.
- Never resolve a token for duplicate updates.
- Never log raw request body, raw token, resolved token, `token_secret_ref`,
  session id, owner id, workspace id, chat id, or raw Telegram response bodies.
- Never persist the raw token in public tables, frontend state, localStorage,
  activity logs, console logs, error messages, or test snapshots.
- Any token resolver failure must map to sanitized 503 or 500 behavior.
- A missing, inactive, revoked, or ambiguous session-token mapping must fail
  closed and must not attempt delivery.

Files likely touched later:

- `supabase/functions/telegram-webhook/token-resolver.ts`
- `supabase/functions/telegram-webhook/token-resolver_test.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`
- `supabase/functions/telegram-webhook/runtime-config.ts`
- `supabase/functions/telegram-webhook/runtime-config_test.ts`
- `docs/telegram-integration-plan.md`

Schema or RPC work likely needed later:

- Add or approve `public.resolve_telegram_delivery_token(uuid)`, or approve an
  equivalent backend-only token resolution boundary.
- Verify the function is executable only by `service_role`.
- Verify browser roles still cannot read `telegram_sessions.token_secret_ref`.
- Verify public summaries still exclude `token_secret_ref`, owner id, workspace
  id, webhook secret material, private chat ids, and raw token data.

Next safe implementation slices:

1. Add a pure webhook token resolver adapter contract and tests without wiring
   it into default runtime.
2. Add sanitized token resolver error mapping tests.
3. Add default-off runtime wiring that requires an injected token resolver and
   delivery dependency.
4. Only after separate approval, deploy the Edge Function with the relevant
   gates and manually smoke test with a disposable Telegram bot.

Still not included:

- No live token resolution.
- No Vault access.
- No raw BotFather token read/write.
- No schema/RLS migration.
- No Telegram API call.
- No Edge Function deploy.
- No Netlify publish/unlock.

## Phase 5BW - Webhook Token Resolver Adapter Contract

Phase 5BW adds a webhook-side token resolver adapter contract and tests without
mounting it into default runtime behavior.

Contract:

- `resolveTelegramDeliveryBotToken(input)` accepts:
  - `telegramSessionId`
  - injected `rpcClient`
- The adapter calls only:

```sql
public.resolve_telegram_delivery_token(
  p_telegram_session_id uuid
)
```

- The adapter returns only:

```ts
{ botToken: string }
```

Security rules:

- The adapter must reject malformed session ids before calling RPC.
- The adapter must validate the resolved token shape before returning it to the
  delivery boundary.
- RPC errors, invalid token responses, and unexpected runtime errors must be
  sanitized.
- Errors must not include raw token values, `token_secret_ref`, session id,
  owner id, workspace id, webhook secret material, Vault internals, or raw DB
  payloads.
- The adapter is not mounted into `createTelegramWebhookDependencies` yet.
- The webhook handler still cannot resolve a token unless a later gated runtime
  wiring phase injects the resolver and delivery dependency.

Files touched:

- `supabase/functions/telegram-webhook/token-resolver.ts`
- `supabase/functions/telegram-webhook/token-resolver_test.ts`
- `supabase/functions/telegram-webhook/index.ts`
- `docs/telegram-integration-plan.md`

Still not included:

- No default runtime token resolution.
- No live Vault access.
- No raw BotFather token read from production secrets.
- No Telegram API call.
- No schema/RLS migration.
- No Edge Function deploy.
- No Netlify publish/unlock.

## Phase 5BX - Default-Off Webhook Token Resolver Wiring

Phase 5BX wires the webhook token resolver adapter into
`createTelegramWebhookDependencies` behind the existing default-off delivery
gate:

- `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED`

Runtime dependency behavior:

- When lookup is disabled, runtime dependencies remain inert.
- When lookup, parse, chat auth, claim, and delivery gates are all enabled,
  `createTelegramWebhookDependencies` creates a delivery dependency.
- The delivery dependency resolves the raw BotFather token with:

```sql
public.resolve_telegram_delivery_token(
  p_telegram_session_id uuid
)
```

- The delivery dependency then passes the resolved token only to the Telegram
  `sendMessage` delivery helper.
- The token is not stored, logged, returned, or exposed to frontend state.
- Tests use injected RPC and Telegram fetch functions, so local verification
  does not call Supabase, Vault, or Telegram.

Safety order:

1. Webhook secret verification.
2. Session lookup.
3. JSON parse.
4. Chat authorization.
5. Idempotency claim.
6. Delivery token resolution.
7. Read-only Telegram response delivery.

Failure behavior:

- Duplicate claims skip token resolution and delivery.
- Token resolver failures return sanitized Telegram unavailable responses.
- Token resolver failures must not expose raw tokens, `token_secret_ref`, owner
  data, workspace data, session ids, webhook secret material, Vault internals,
  or raw DB payloads.
- Telegram delivery failures continue to use sanitized delivery errors.

Files touched:

- `supabase/functions/telegram-webhook/index.ts`
- `supabase/functions/telegram-webhook/index_test.ts`
- `docs/telegram-integration-plan.md`

Still not included:

- No Edge Function deploy.
- No Netlify publish/unlock.
- No local `.env.local` reads.
- No schema/RLS migration.
- No live Supabase, Vault, or Telegram API calls during verification.

## Phase 5BY - Production Enablement Readiness Checklist

Phase 5BY defines the production enablement checklist for the Telegram webhook
flow. This phase is documentation only and must not deploy, publish, unlock
Netlify, or read local secret values.

Current readiness:

- Webhook verification is implemented before body parsing.
- Session lookup is gated and uses the service-role RPC boundary.
- Update parsing is gated and restricted to read-only commands.
- Chat authorization is gated and must run before claim or delivery.
- Idempotency claim is gated and runs before response delivery.
- Response delivery is gated and skips duplicate updates.
- Delivery token resolution is gated through the delivery dependency and runs
  only after a claimed authorized update.
- Local tests use injected RPC and Telegram fetch functions.

Required pre-enable checks:

1. Confirm production schema contains all approved Telegram tables and RPCs.
2. Confirm verifier queries pass for:
   - `resolve_telegram_webhook_session(text)`
   - `resolve_telegram_chat_authorization(uuid,text,text,text)`
   - `claim_telegram_update(uuid,bigint)`
   - `resolve_telegram_delivery_token(uuid)`
   - `telegram_session_summaries` excluding sensitive fields
   - browser roles lacking access to `telegram_sessions.token_secret_ref`
3. Confirm a disposable Telegram bot is available for smoke testing.
4. Confirm the bot token is stored only through the approved Vault/RPC path.
5. Confirm the active session has:
   - active webhook status
   - valid webhook secret hash
   - active chat authorization row
   - token resolver mapping available only to service-role paths
6. Confirm Netlify publish credit impact before any frontend publish.
7. Confirm Edge Function deploy scope separately from static Netlify deploy.

Gate enablement order:

1. `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED=true`
2. `KYRA_TELEGRAM_WEBHOOK_PARSE_ENABLED=true`
3. `KYRA_TELEGRAM_WEBHOOK_CHAT_AUTH_ENABLED=true`
4. `KYRA_TELEGRAM_WEBHOOK_CLAIM_ENABLED=true`
5. `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED=true`

Do not enable delivery before lookup, parse, chat authorization, and claim are
all enabled and passing smoke checks.

Smoke test plan:

1. Deploy only the required Supabase Edge Function after explicit approval.
2. Use a disposable bot and a single owner-linked Telegram chat.
3. Register webhook with the approved secret token.
4. Send `/help` and `/status`.
5. Confirm one response per update.
6. Re-send or replay the same update payload to confirm duplicate no-op.
7. Send from an unknown chat and confirm safe denial or no-op.
8. Check logs for absence of:
   - raw BotFather token
   - resolved token
   - `token_secret_ref`
   - webhook secret header
   - Telegram chat/user ids
   - raw Telegram request/response body
9. Confirm no wallet, approval, or onchain execution behavior changed.

Rollback plan:

1. Set `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED` to disabled first.
2. If needed, disable claim, chat auth, parse, and lookup gates in reverse
   order.
3. Remove or revoke the Telegram webhook registration for the disposable bot.
4. Revoke the Telegram session webhook secret if the smoke session is not
   needed.
5. Revoke the stored BotFather token secret reference if the bot will not be
   reused.
6. Keep public UI copy in placeholder/safe mode until production smoke is
   explicitly accepted.

Hard stops:

- Stop if any verifier reports browser access to token refs, webhook secrets,
  private chat ids, owner ids, or workspace ids.
- Stop if any RPC is executable by `public`, `anon`, or `authenticated` when it
  should be service-role only.
- Stop if logs or API responses expose token, token ref, webhook secret, chat
  id, owner id, workspace id, raw DB error, or raw Telegram body.
- Stop if Telegram sends more than one response for one claimed update.
- Stop if unknown chats receive privileged behavior.

Still not included:

- No Edge Function deploy.
- No Netlify publish/unlock.
- No gate enablement.
- No `.env.local` read.
- No live secret read/write.
- No Telegram API call.
- No schema/RLS change.

## Phase 5CA - Pre-Push Release Bundle Note

This note records the local-only Phase 5 Telegram bundle before any push,
publish, or deploy decision.

Current local state:

- Working tree was clean at the start of this note.
- Local `main` was ahead of `origin/main` by 18 commits.
- The bundle has not been pushed yet.
- No Edge Function has been deployed by this bundle.
- No Netlify publish or unlock is part of this bundle.

Bundle scope:

- `docs/telegram-integration-plan.md`
- `supabase/schema.sql`
- `supabase/functions/telegram-webhook/*`
- No frontend files are part of this local bundle.

Functional summary:

- Webhook session lookup remains gated.
- Telegram update parsing remains gated.
- Chat authorization remains gated.
- Atomic update claiming remains gated.
- Read-only response delivery remains gated.
- Delivery token resolution remains gated.
- Production enablement remains documented as a separate checklist.

Explicit non-effects:

- Does not read `.env.local`.
- Does not create, read, or resolve live secrets.
- Does not call Telegram during local verification.
- Does not enable any runtime environment gate.
- Does not deploy Supabase Edge Functions.
- Does not publish or unlock Netlify.
- Does not make Telegram live by itself.

Before push checklist:

1. Run `git status --short`.
2. Run `git rev-list --left-right --count origin/main...HEAD`.
3. Run `git log --oneline origin/main..HEAD`.
4. Run `git diff --check origin/main...HEAD`.
5. Run `npm run check:functions`.
6. Run `deno check supabase/functions/telegram-connect/index.ts supabase/functions/telegram-webhook/index.ts`.
7. Run `deno test supabase/functions/telegram-connect supabase/functions/telegram-webhook`.
8. Run `npm exec tsc -- --noEmit`.
9. Run `npm run build`.

Push risk notes:

- Pushing to `main` can trigger Netlify auto publishing if Netlify is enabled.
- Netlify credits are limited, so push timing must be deliberate.
- Do not push unless the user explicitly approves a push.
- A git push still does not deploy Supabase Edge Functions unless that deploy is
  separately configured or manually triggered.

Post-push checks if push is later approved:

1. Confirm `origin/main` contains the expected Phase 5 commits.
2. Confirm Netlify behavior immediately after push.
3. Confirm no Supabase Edge Function deploy happened unexpectedly.
4. Keep runtime gates disabled until production smoke is approved.

Hard stops:

- Stop if the working tree becomes dirty unexpectedly.
- Stop if the pre-push diff includes files outside the expected bundle.
- Stop if verification fails.
- Stop if push approval is absent or ambiguous.
- Stop if Netlify status is unclear and a push could spend credits.

Still not included:

- No push.
- No deploy.
- No Netlify unlock/publish.
- No runtime gate enablement.
- No live Telegram API call.
- No live secret read/write.

## Phase 5CC - Local Production Readiness Audit

Phase 5CC is a local-only readiness audit for the current Telegram integration
bundle. It does not edit runtime code, apply SQL, push, deploy, publish, unlock
Netlify, read local secret files, read live secrets, or call Telegram.

Current git state during the audit:

- Working tree was clean.
- Local `main` was ahead of `origin/main` by 19 commits.
- The local bundle did not include frontend `src` changes.
- The local bundle was limited to Telegram docs, webhook function code/tests,
  and the schema snapshot.

Safe findings:

- `telegram-webhook` runtime gates remain default-off and require exact
  lowercase `true`.
- Webhook delivery still requires the earlier lookup, parse, chat
  authorization, and claim stages to have succeeded.
- Duplicate claimed updates return a no-op response before token resolution or
  Telegram delivery.
- Delivery token resolution is lazy and only mounted behind the delivery gate.
- `telegram-connect` runtime gates remain default-off and require exact
  lowercase `true`.
- Frontend BotFather token input remains gated by
  `VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT=true`; default behavior keeps
  the placeholder disabled.
- Existing frontend token submission clears transient token state after submit
  and sanitizes token-like response text.
- No `.env.local` or secret values were read during the audit.
- No live Supabase, Vault, or Telegram API calls were made during the audit.

Pre-live blocker:

- The local `supabase/schema.sql` snapshot does not yet include the token/Vault
  RPCs expected by the gated runtime paths:
  - `public.store_telegram_bot_token(uuid, uuid, text, text)`
  - `public.resolve_telegram_bot_token(text)`
  - `public.revoke_telegram_bot_token(text)`
  - `public.resolve_telegram_delivery_token(uuid)`
- Earlier manual Supabase verifier results recorded those RPCs as present and
  service-role only in the target project, so this is currently a repository
  snapshot drift issue rather than a local runtime failure while gates remain
  off.
- Do not enable `KYRA_TELEGRAM_CONNECT_STORE_ENABLED`,
  `KYRA_TELEGRAM_CONNECT_SESSION_WRITE_ENABLED`,
  `KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED`, or
  `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED` until the repo snapshot and
  production verifier state are reconciled.

Manual-only steps before live:

1. Explicitly approve any push to `main`, because Netlify credits are limited
   and auto publishing may run.
2. Explicitly approve any Supabase Edge Function deploy.
3. Explicitly approve any Supabase runtime gate enablement.
4. Confirm production schema verifier output for every Telegram table and RPC.
5. Confirm BotFather token storage through the approved Vault/RPC boundary.
6. Confirm active session, webhook secret, chat authorization, claim, and
   delivery token resolver state before smoke testing.
7. Smoke test only with a disposable Telegram bot and a single owner-linked
   chat.

Recommended next local-only boundary:

- Sync or document the remaining schema snapshot drift for token/Vault RPCs
  before any runtime gate enablement.
- Keep this as a separate local-only review slice: no SQL apply, no live secret,
  no Telegram API, no deploy, and no push unless explicitly approved.

## Phase 5CE - Schema Snapshot Drift Audit

Phase 5CE audits the remaining repository schema drift for Telegram live
readiness. It is audit/docs-only and does not change `supabase/schema.sql`, run
SQL, read secrets, deploy, publish, or push.

Current local state:

- Working tree was clean at the start of the audit.
- Local `main` was ahead of `origin/main` by 20 commits.
- `supabase/schema.sql` already contains the locally synced Telegram webhook
  receiver, chat authorization, and processed-update claim objects.
- Runtime gates remain disabled by default.

Objects already represented in `supabase/schema.sql`:

- `public.telegram_sessions`
- `public.telegram_session_summaries`
- `public.telegram_webhook_secrets`
- `public.resolve_telegram_webhook_session(text)`
- `public.telegram_chat_authorizations`
- `public.resolve_telegram_chat_authorization(uuid,text,text,text)`
- `public.telegram_processed_updates`
- `public.claim_telegram_update(uuid,bigint)`

Objects still missing from `supabase/schema.sql`:

- `public.telegram_bot_token_secrets`
- `public.store_telegram_bot_token(uuid, uuid, text, text)`
- `public.resolve_telegram_bot_token(text)`
- `public.revoke_telegram_bot_token(text)`
- `public.resolve_telegram_delivery_token(uuid)`

Local SQL artifact state:

- `supabase/telegram_vault_rpc_review_draft.sql` contains the previously
  reviewed Vault token metadata table and the store/resolve/revoke token RPCs.
- `supabase/telegram_vault_rpc_review_draft.sql` does not contain
  `public.resolve_telegram_delivery_token(uuid)`.
- No local Supabase SQL artifact currently defines
  `public.resolve_telegram_delivery_token(uuid)`.
- `supabase/verify_authenticated_demo_write_lockdown.sql` checks the
  store/resolve/revoke token RPCs, but the current local scan did not find a
  verifier check for `resolve_telegram_delivery_token(uuid)`.

Risk classification:

- This is not a live runtime issue while all Telegram gates remain disabled.
- It is a pre-live blocker for delivery gate enablement, because webhook
  delivery runtime expects `resolve_telegram_delivery_token(uuid)`.
- It is also a pre-push review risk if the repository is expected to represent
  the full manually applied production schema state.

Recommended next local-only slices:

1. Create a review-only SQL packet for
   `public.resolve_telegram_delivery_token(uuid)` that calls the existing
   backend-only token resolver boundary without exposing `token_secret_ref` to
   browser roles.
2. Add verifier checks for `resolve_telegram_delivery_token(uuid)`:
   - function exists
   - public cannot execute
   - anon cannot execute
   - authenticated cannot execute
   - service_role can execute
   - browser roles still cannot read `telegram_sessions.token_secret_ref`
   - public summaries still exclude sensitive fields
3. Only after the delivery-token RPC packet is reviewed and the production
   verifier state is accepted, sync `supabase/schema.sql` with:
   - `telegram_bot_token_secrets`
   - store/resolve/revoke token RPCs
   - delivery token resolver RPC
   - exact backend-only grants
4. Keep the sync as a local-only commit until push is explicitly approved.

Hard stops:

- Do not edit `supabase/schema.sql` until the delivery-token RPC contract and
  verifier checks are represented locally.
- Do not enable `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED`.
- Do not deploy `telegram-webhook`.
- Do not read `.env.local`, Vault secrets, or live BotFather tokens.
- Do not call Telegram.
- Do not push while Netlify credit impact is not explicitly accepted.

## Phase 5CF - Delivery Token Resolver SQL Review Packet

Phase 5CF creates local review artifacts for the webhook delivery token resolver
SQL boundary. It does not apply SQL, does not sync `supabase/schema.sql`, does
not read secrets, does not call Telegram, does not deploy, does not publish, and
does not push.

Files added:

- `supabase/telegram_delivery_token_resolver_forward_review.sql`
- `supabase/telegram_delivery_token_resolver_rollback_review.sql`

File updated:

- `supabase/verify_authenticated_demo_write_lockdown.sql`

Forward packet contract:

- Creates `public.resolve_telegram_delivery_token(uuid)`.
- Accepts only `p_telegram_session_id`.
- Resolves only sessions where `telegram_sessions.webhook_status = 'active'`.
- Reads `telegram_sessions.token_secret_ref` only inside the backend-only SQL
  boundary.
- Requires an active, non-revoked row in `public.telegram_bot_token_secrets`.
- Calls `public.resolve_telegram_bot_token(text)` inside the trusted boundary.
- Returns only the raw BotFather token to the service-role Edge Function call
  path.
- Does not expose `token_secret_ref`, webhook secrets, owner id, workspace id,
  chat ids, or Vault metadata to browser roles or webhook responses.

Grant contract:

- Revoke execute from `public`, `anon`, `authenticated`, and `service_role`.
- Grant execute only to `service_role`.
- Keep browser roles unable to select `telegram_sessions.token_secret_ref`.

Verifier additions:

- `resolve_telegram_delivery_token_function_exists`
- `public_cannot_execute_resolve_telegram_delivery_token`
- `anon_cannot_execute_resolve_telegram_delivery_token`
- `auth_cannot_execute_resolve_telegram_delivery_token`
- `service_role_can_execute_resolve_telegram_delivery_token`

Required before any approved apply:

1. Review the forward and rollback SQL packet in full.
2. Confirm the target Supabase project already has:
   - `public.telegram_sessions`
   - `public.telegram_bot_token_secrets`
   - `public.resolve_telegram_bot_token(text)`
3. Confirm the verifier still protects:
   - browser-role denial for token RPCs
   - browser-role denial for `telegram_sessions.token_secret_ref`
   - sensitive field exclusion from `telegram_session_summaries`
4. Approve the exact manual apply window separately.

Hard stops:

- Do not apply the SQL from the repository without explicit manual approval.
- Do not enable `KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED`.
- Do not deploy `telegram-webhook`.
- Do not read or create live secrets.
- Do not call Telegram.
- Do not sync `supabase/schema.sql` until the review packet is accepted and
  verifier expectations are clear.

## Phase 5CH - Local Schema Snapshot Sync

Phase 5CH syncs the repository schema snapshot with the already-reviewed
Telegram token/Vault and delivery-token resolver contracts. It is local-only:
no SQL is applied to Supabase, no secrets are read or created, no Telegram API
is called, no Edge Function is deployed, Netlify is not published, and no push
is performed.

Schema snapshot additions:

- `create extension if not exists supabase_vault cascade`
- `public.telegram_bot_token_secrets`
- `telegram_bot_token_secrets_active_bot_id_key`
- `public.store_telegram_bot_token(uuid, uuid, text, text)`
- `public.resolve_telegram_bot_token(text)`
- `public.revoke_telegram_bot_token(text)`
- `public.resolve_telegram_delivery_token(uuid)`
- RLS enablement for `public.telegram_bot_token_secrets`
- Backend-only table grants for `public.telegram_bot_token_secrets`
- Backend-only execute grants for the four token RPCs

Security contract preserved:

- Browser roles must not be able to read `telegram_bot_token_secrets`.
- Browser roles must not be able to execute token store, token resolve, token
  revoke, or delivery-token resolve RPCs.
- `telegram_sessions.token_secret_ref` stays out of broad authenticated table
  select and out of `telegram_session_summaries`.
- `resolve_telegram_delivery_token(uuid)` takes only the active Telegram
  session id and resolves `token_secret_ref` inside the backend-only boundary.
- `resolve_telegram_delivery_token(uuid)` must remain service-role only because
  it returns a raw BotFather token to the Edge Function delivery path.

Verification required after this local sync:

1. `git diff --check`
2. `npm run check:functions`
3. `deno check supabase/functions/telegram-connect/index.ts supabase/functions/telegram-webhook/index.ts`
4. `deno test supabase/functions/telegram-connect supabase/functions/telegram-webhook`
5. `npm exec tsc -- --noEmit`
6. `npm run build`
7. Static scan for unintended frontend token exposure, live Telegram calls
   during tests, and browser grants on token objects.

Still not included:

- No Supabase SQL apply.
- No production verifier run.
- No `.env.local` read.
- No Vault secret read/write.
- No BotFather token submission.
- No Telegram API call.
- No runtime gate enablement.
- No Edge Function deploy.
- No Netlify publish.
- No push.

## Phase 5CI - Production Delivery Token Resolver Apply Verification

On June 5, 2026, the reviewed delivery-token resolver packet was manually
applied to the target Supabase production project:

- `supabase/telegram_delivery_token_resolver_forward_review.sql`
- Supabase SQL Editor reported `Success. No rows returned.`

The complete production verifier was run immediately after the apply and
exported as:

- `Supabase Snippet Telegram Schema & Privilege Contract Validation.csv`

Verifier result:

- 140 contract fields were present.
- 131 contract fields were `true`.
- 9 contract fields were `false`, all representing expected-deny conditions:
  authenticated users cannot directly insert or mutate protected demo and
  Telegram records, and cannot select `telegram_sessions.token_secret_ref`.
- No verifier field was empty.

Delivery-token resolver checks all passed:

- `resolve_telegram_delivery_token_function_exists = true`
- `public_cannot_execute_resolve_telegram_delivery_token = true`
- `anon_cannot_execute_resolve_telegram_delivery_token = true`
- `auth_cannot_execute_resolve_telegram_delivery_token = true`
- `service_role_can_execute_resolve_telegram_delivery_token = true`

Security and runtime state after apply:

- The raw BotFather token remains accessible only through the backend-only
  service-role resolver boundary.
- Browser roles remain unable to execute the resolver or select
  `telegram_sessions.token_secret_ref`.
- No secret value was read, created, logged, returned, or included in the
  verifier evidence.
- No Telegram API call was made.
- No Edge Function was deployed.
- All Telegram runtime gates remain disabled.
- No Netlify publish or Git push was performed as part of this apply.

Remaining manual decision gates:

1. Approve a push of the local Phase 5 bundle to `main`; this may consume
   limited Netlify build credits.
2. Approve the exact Supabase Edge Function deployment window.
3. Approve runtime-gate enablement in dependency order and stop after each
   production smoke checkpoint.
4. Approve use of a disposable BotFather token and owner-linked Telegram chat
   for the first live smoke test.

## Phase 5CJ - Edge Function Gateway Auth Configuration

Phase 5CJ adds an explicit local Supabase Edge Function gateway-auth contract.
It does not deploy either function, enable runtime gates, read secrets, call
Telegram, publish Netlify, or push.

Configuration:

- `telegram-connect` sets `verify_jwt = true` because it is invoked by a
  signed-in dashboard user and must pass Supabase gateway authentication before
  the function performs its own session and ownership validation.
- `telegram-webhook` sets `verify_jwt = false` because Telegram does not send a
  Supabase JWT. The inert function rejects a missing
  `X-Telegram-Bot-Api-Secret-Token` before request-body access. Live parsing
  remains blocked until the backend session-lookup gate validates the hashed
  header against an active session.

Files:

- `supabase/config.toml`
- `scripts/check-functions.mjs`

Verification:

- `npm run check:functions` now fails if either Telegram function's
  `verify_jwt` setting is missing, duplicated, or changed from the approved
  contract.
- Functions not listed in this configuration keep Supabase's default JWT
  behavior.

Hard stops:

- Do not deploy either function until the exact production deployment window is
  approved.
- Do not enable webhook runtime gates during the initial deployment.
- Do not submit a BotFather token or register a webhook until the inert
  deployment smoke passes.

## Phase 5CK - Inert Edge Function Deployment Smoke

On June 5, 2026, the approved inert deployment window was completed for the
target Supabase production project. No Telegram runtime gate, secret, or live
integration behavior was enabled.

Deployment result:

- `telegram-connect` deployed as active version 1.
- `telegram-webhook` deployed as active version 1.
- `telegram-connect` retained `verify_jwt = true`.
- `telegram-webhook` retained `verify_jwt = false`.
- No other Edge Function was redeployed.

Production inert smoke result:

- A `telegram-connect` request without a Supabase JWT was rejected by the
  gateway with `401 UNAUTHORIZED_NO_AUTH_HEADER`.
- A `telegram-webhook` request without
  `X-Telegram-Bot-Api-Secret-Token` was rejected with the sanitized
  `401 webhook_verification_failed` response.
- A webhook request with a dummy header but without JSON content type was
  rejected by the content-type guard with sanitized `415
  unsupported_media_type`.
- A webhook request with a dummy header and an empty JSON object reached the
  inert handler and returned `501 not_configured`.

Security state after deployment:

- All Telegram connect and webhook runtime gates remain default-off.
- No BotFather token or real webhook secret was submitted, created, read,
  logged, or returned.
- No Telegram API call, `getMe`, `setWebhook`, or `sendMessage` occurred.
- No Telegram session, authorization, or processed-update row was written.
- No Netlify configuration or frontend behavior was changed.

Next manual approval boundary:

- Do not enable any runtime gate yet.
- Before the first live connection, approve a disposable BotFather bot,
  owner-linked chat identity, exact gate-enablement sequence, rollback
  checkpoints, and production smoke window.

## Phase 5CL - Post-Deploy Live Finalization Gap Audit

Phase 5CL audits the deployed inert functions before any runtime-gate
enablement. It does not change runtime code, secrets, production configuration,
database rows, Telegram state, or Netlify state.

Findings:

- The deployed inert functions passed their production smoke checks.
- The production `telegram-connect` runtime currently mounts
  `registerTelegramWebhookWithSetWebhook` directly behind the default-off
  webhook-registration gate.
- The runtime does not yet use the existing
  `finalizeTelegramWebhookRegistration` contract.
- Therefore, an enabled connect flow could call Telegram `setWebhook` without
  first persisting the hashed webhook secret and without activating the queued
  Telegram session afterward.
- `telegram-webhook` session lookup accepts only active sessions, so that
  incomplete flow would remain fail-closed but would leave a partially
  configured Telegram webhook.
- The database and pure helper layer already contain the intended private
  webhook-secret table, hash/ref helpers, finalization order, and service-role
  write grants.
- No production runtime adapter currently stores or revokes
  `telegram_webhook_secrets` rows or activates a queued `telegram_sessions`
  row.
- There is no approved runtime owner-linking flow that creates the first
  `telegram_chat_authorizations` row. A live read-only smoke cannot pass chat
  authorization until an exact owner-linked Telegram user/chat pair exists.

Required implementation order:

1. Add tested service-role persistence adapters for webhook-secret store,
   webhook-secret revoke, and queued-session activation.
2. Wire the existing finalization contract into `telegram-connect` behind the
   existing default-off webhook-registration gate.
3. Add a tested recovery path for activation failure after Telegram accepts
   `setWebhook`.
4. Define and approve the first owner-linking mechanism without logging or
   exposing raw Telegram update bodies.
5. Re-run local verification and redeploy inert/default-off code.
6. Only then approve a disposable bot, live runtime settings, and staged smoke
   test.

Go/no-go:

- Go for local-only persistence adapter and finalization wiring implementation
  with injected tests.
- No-go for enabling any Telegram runtime gate, submitting a BotFather token,
  registering a real webhook, or inserting an owner-linked chat authorization
  until the recovery and owner-linking gaps are closed.

## Phase 5CM - Webhook Finalization Persistence Wiring

Phase 5CM implements and tests the local production wiring required to finalize
a future Telegram connection safely. It remains behind the existing
default-off webhook-registration gate and has not been deployed.

Files added:

- `supabase/functions/telegram-connect/webhook-persistence.ts`
- `supabase/functions/telegram-connect/webhook-persistence_test.ts`
- `supabase/functions/telegram-connect/webhook-finalization-runtime.ts`
- `supabase/functions/telegram-connect/runtime-finalization_test.ts`

Files updated:

- `supabase/functions/telegram-connect/index.ts`
- `supabase/functions/telegram-connect/README.md`

Implemented behavior behind the disabled gate:

- Store only `webhook_secret_ref`, `webhook_secret_hash`, and
  `telegram_session_id` in `telegram_webhook_secrets`.
- Never pass the raw webhook secret token to the persistence adapter.
- Revoke a stored webhook secret only by setting `revoked_at` on the exact
  active ref.
- Activate only the exact `queued` Telegram session that already has a
  non-null token secret ref.
- Replace the production runtime's direct `setWebhook` dependency with the
  existing finalization sequence:
  `store webhook secret -> setWebhook -> activate queued session`.
- Revoke the newly stored webhook secret ref on a failed `setWebhook` attempt.

Security result:

- No raw BotFather token or raw webhook secret is stored, logged, returned, or
  added to test persistence payloads.
- Database mutations use the existing service-role client and existing private
  table grants.
- Browser roles and frontend code are unchanged.
- Runtime gates remain exact-`true`, default-off controls.
- Production still runs the previously deployed inert version because this
  local slice has not been pushed or redeployed.

Verification:

- `npm run check:functions` passed.
- Full Telegram Deno tests passed: 249 tests, 0 failures.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Static security scan found no logging, browser storage, `.env.local` access,
  request-body logging, or raw-secret persistence in the new runtime modules.

Remaining blockers before redeploy and gate enablement:

1. Implement a tested recovery path for session activation failure after
   Telegram accepts `setWebhook`.
2. Define and approve the first owner-linking mechanism for the exact Telegram
   user/chat pair.
3. Final review the complete local diff and redeploy only with all runtime gates
   still off.

## Phase 5CN - Activation-Failure Webhook Recovery

Phase 5CN closes the local recovery gap when Telegram accepts `setWebhook` but
the exact queued-session activation write fails. The implementation remains
behind the existing default-off webhook-registration gate and has not been
pushed, deployed, or enabled.

Implemented recovery order:

1. Store only the webhook secret hash and opaque ref.
2. Register the Telegram webhook.
3. Attempt to activate the exact queued, token-backed Telegram session.
4. If activation fails, make a best-effort Telegram `deleteWebhook` request with
   `drop_pending_updates=false`.
5. Make a best-effort revoke of the newly stored webhook secret ref.
6. Return the existing sanitized activation failure.

Fail-closed behavior:

- The Telegram cleanup request receives the BotFather token only as transient
  backend memory input.
- The `deleteWebhook` helper returns only `{ "deleted": true }` and never
  returns or logs the token, Telegram response body, or raw error details.
- Cleanup failure does not prevent webhook-secret revoke from being attempted.
- Cleanup and revoke internals remain hidden behind the original sanitized
  activation error.
- The failed session remains `queued` for audit or manual recovery. It is not
  marked active, deleted, or silently replaced.
- If Telegram cleanup fails but the secret revoke succeeds, incoming webhook
  requests still fail closed because the revoked secret hash cannot resolve an
  active session.

Tests added:

- Telegram `deleteWebhook` request shape, sanitized failure, and timeout.
- Core finalizer recovery order:
  `store -> setWebhook -> activate -> deleteWebhook -> revoke`.
- Recovery continues to revoke when `deleteWebhook` fails.
- Runtime finalization adapter mounts the cleanup dependency and does not expose
  BotFather token, webhook secret token, or session ID in errors.

Current remaining blockers before any gate enablement:

1. Define and approve the first owner-linking mechanism for the exact Telegram
   user/chat pair.
2. Final-review the complete local Telegram runtime diff.
3. Redeploy only with every Telegram runtime gate still default-off.
4. Separately approve disposable-bot live smoke and any later gate enablement.

## Phase 5CO - First Owner-Linking Bootstrap Audit

Phase 5CO defines the recommended first owner-linking mechanism without changing
schema/RLS, runtime code, frontend behavior, secrets, production configuration,
or Telegram state.

Current findings:

- `public.telegram_chat_authorizations` and
  `public.resolve_telegram_chat_authorization(uuid,text,text,text)` already
  enforce an exact active owner-linked Telegram user-plus-chat pair for
  read-only commands.
- Browser roles cannot read or write authorization rows. The existing lookup is
  service-role-only and returns only bounded authorization metadata.
- The receiver safely denies unknown chats, but there is no approved flow that
  creates the first authorization row.
- The normal read-only command parser cannot be reused for initial linking
  because an unlinked chat must be denied before normal command processing.
- No current UI, Edge Function, RPC, or table stores or consumes an owner-link
  challenge.

Rejected bootstrap models:

- Trust-on-first-message or first `/start`: an attacker or unintended chat could
  claim the agent before the owner.
- Telegram username matching: usernames are optional, mutable, and not a stable
  ownership proof.
- Automatically linking the first chat after webhook activation: webhook
  possession proves delivery to the bot, not ownership of the Kyra workspace.
- Long-lived reusable pairing codes or codes stored in browser storage: they
  broaden replay and disclosure risk.
- Manual direct authorization-row insertion as the product flow: acceptable
  only for a tightly controlled disposable-bot smoke, not normal onboarding.

Recommended product architecture:

1. Add a separate authenticated `telegram-link` Edge Function for issuing and
   revoking owner-link challenges. Keep BotFather token handling isolated in
   `telegram-connect`.
2. Require a valid Supabase session and the existing exact agent ownership
   validation before issuing a challenge.
3. Generate at least 256 bits of random challenge material. Return it once as a
   short-lived Telegram deep link or bounded pairing code, and store only its
   SHA-256 hash.
4. Bind the challenge to the exact agent, active Telegram session, and current
   workspace owner. Use a short TTL, recommended ten minutes, and allow only one
   active challenge per agent/session.
5. Add a narrow pre-authorization pairing path in `telegram-webhook` that
   accepts only a bounded `/start <challenge>` or `/link <challenge>` payload
   after webhook-secret and active-session verification.
6. Atomically claim the Telegram update, consume the challenge, revalidate the
   current workspace owner and active session, and insert exactly one
   read-only owner authorization row.
7. Return only a safe success or denial response. Never return challenge hashes,
   Telegram identities, agent/workspace/owner IDs, or raw DB errors.

Recommended future private challenge record:

- `id uuid primary key`
- `agent_id uuid not null`
- `telegram_session_id uuid not null`
- `issued_by_user_id uuid not null`
- `challenge_hash text not null`
- `expires_at timestamptz not null`
- `created_at timestamptz not null`
- `consumed_at timestamptz null`
- `revoked_at timestamptz null`

Required challenge rules:

- Never store the raw challenge.
- Never log, persist in localStorage/sessionStorage, or render the challenge
  after the one-time issue response.
- Require exact hash match, unexpired state, no prior consumption/revocation,
  active matching Telegram session, and unchanged current workspace ownership.
- Consume and create the authorization in one atomic service-role-only RPC.
- Reject if an active authorization already exists. Relink, transfer, and
  replacement require a separate explicit revoke flow.
- Rate-limit challenge issue and consume attempts. Unknown, expired, replayed,
  mismatched, or already-linked attempts must fail safely.

Recommended future execution order:

1. Pure challenge format, parser, and sanitized error contracts with tests.
2. Comment-only schema/RPC design and verifier plan.
3. Separate approval for challenge table, atomic consume RPC, grants, and
   rollback packet.
4. Apply and verify database packet while all Telegram runtime gates stay off.
5. Add inert `telegram-link` Edge Function skeleton and authenticated ownership
   checks.
6. Add default-off challenge issue and webhook consume runtime gates.
7. Add gated dashboard pairing UI that never handles a BotFather token.
8. Redeploy with every new gate off, then perform a separately approved
   disposable-bot smoke.

Decision and approval boundary:

- Recommended decision: approve dashboard-issued, one-time, hashed,
  short-lived pairing challenges as the product owner-linking model.
- A future schema/RLS/RPC packet requires explicit approval before any apply.
- A future `telegram-link` deployment, pairing UI, runtime-gate enablement,
  challenge creation, authorization-row creation, or live Telegram pairing
  requires separate explicit approval.
- Until then, owner-linking remains unavailable and all unknown Telegram chats
  must continue to fail closed.

## Phase 5CP - Pure Owner-Link Challenge Contracts

Phase 5CP implements the first owner-linking preparation slice as shared pure
contracts and tests. It does not add a deployable `telegram-link` Edge Function,
schema/RLS, database access, RPC calls, runtime wiring, UI behavior, secrets,
Telegram API calls, runtime gates, deployment, or production changes.

Files added:

- `supabase/functions/_shared/telegram-owner-link.ts`
- `supabase/functions/_shared/telegram-owner-link_test.ts`

Implemented contracts:

- Generate exactly 32 cryptographically random bytes represented as a
  64-character lowercase hexadecimal challenge.
- Hash the raw challenge with SHA-256 before any future persistence boundary.
- Set a maximum ten-minute challenge TTL.
- Build a one-time Telegram deep link containing only the normalized bot
  username and raw challenge.
- Build a future store input that contains only agent/session/owner IDs,
  challenge hash, and expiry. Extra raw challenge input is discarded.
- Parse and hash only exact `/start <challenge>` or `/link <challenge>`
  owner-link commands.
- Accept owner-link commands only from a private chat where the positive
  Telegram user ID exactly equals the positive chat ID.
- Support an optional exact target bot username while rejecting mismatches.
- Return consume input containing only Telegram update/user/chat IDs and the
  challenge hash. It excludes raw challenge, command text, bot username, and
  raw update data.
- Return fixed sanitized contract errors without exposing challenge material,
  Telegram payloads, owner data, token refs, or internal failures.

Security decisions:

- Owner-linking remains unavailable and unwired.
- The raw challenge exists only in transient issue/parser memory and the
  one-time deep-link response boundary.
- The raw challenge must never be stored, logged, rendered again, placed in
  browser storage, or included in a consume RPC input.
- Group/supergroup/channel linking is rejected. The first rollout is
  private-chat owner linking only.
- The shared folder has no `index.ts`, so this slice is not deployable as an
  Edge Function.
- No existing Telegram function imports this module yet.

Verification:

- Focused shared-contract tests passed: 9 tests, 0 failures.
- Full shared/connect/webhook Deno tests passed: 263 tests, 0 failures.
- `npm run check:functions` passed.
- `npm exec tsc -- --noEmit` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Static scan found no runtime logging, env access, `.env.local` access, browser
  storage, service-role client, DB/RPC call, Telegram API call, or token
  handling in the shared module.

Next safe slice:

1. Prepare a comment-only owner-link challenge schema/RPC design and verifier
   plan.
2. Keep it separate from executable SQL and do not apply schema/RLS.
3. Require separate explicit approval before any forward/rollback SQL packet,
   database apply, runtime wiring, UI, deploy, challenge issue, or live pairing.

## Phase 5CQ - Owner-Link Challenge Schema/RPC Draft

Phase 5CQ adds a comment-only schema/RPC design artifact:

- `supabase/telegram_owner_link_challenge_schema_draft.sql`

The draft contains no executable SQL and does not change `schema.sql`, verifier
SQL, schema/RLS, grants, runtime code, UI, secrets, Telegram state, deployment,
or production.

Designed future boundary:

- Private `public.telegram_owner_link_challenges` table storing only challenge
  hash and bounded lifecycle metadata.
- Service-role-only issue RPC that revalidates current workspace ownership and
  active Telegram session, caps TTL at ten minutes, revokes prior challenges,
  and issues exactly one active hash.
- Service-role-only atomic consume RPC that claims the Telegram update, consumes
  the challenge, revalidates current ownership/session, and creates the first
  exact private-chat read-only owner authorization in one transaction.
- Existing `telegram_chat_authorizations` and `telegram_processed_updates`
  remain the final authorization and replay guards.

Key security decisions:

- Raw challenge never enters SQL, DB rows, RPC arguments, logs, or errors.
- Issue and consume RPCs are designed as volatile `SECURITY INVOKER` functions
  with empty search paths and service-role-only execute.
- Browser roles receive no table or RPC access.
- Private-chat linking requires identical positive Telegram user/chat IDs.
- Relink, transfer, groups, community roles, write scope, and approval scope
  remain deferred.
- Any failure after consume begins must roll back update claim, challenge
  consumption, and authorization insert together.

Next safe slice:

1. Review the comment-only design and prepare verifier-only expectations.
2. Do not create executable forward/rollback SQL or apply schema/RLS without
   separate explicit approval.

## Phase 5CR - Owner-Link Challenge Standalone Verifier

Phase 5CR adds a standalone read-only verifier:

- `supabase/verify_telegram_owner_link_challenge_contract.sql`

The verifier does not create, alter, grant, revoke, insert, update, or delete.
It is guarded so the future owner-link challenge table and RPC checks return
`false`, rather than erroring, while those objects do not exist.

Verifier coverage:

- Exact future table existence, columns/defaults, RLS state, and absence of
  policies.
- Exact stable named constraint definitions, foreign-key columns/targets, and
  cascade behavior.
- Three active partial unique indexes, exact indexed columns, and exact
  active-row predicate.
- No direct table privileges for public/browser roles.
- Exact service-role table privileges: select, insert, and update only.
- Exact issue/consume RPC signatures.
- Volatile PL/pgSQL, `SECURITY INVOKER`, and empty search path.
- Bounded boolean/status result contracts.
- Required definition signals for ownership/session checks, advisory locking,
  TTL, replay claim, atomic consume, and owner authorization creation.
- No public/browser execute and service-role-only execute.
- Existing Telegram session summary excludes owner-link challenge fields.

Safety state:

- The verifier has not been run against Supabase.
- No schema/RLS, grant, RPC, row, runtime, UI, secret, deployment, or
  production state changed.
- Executable forward/rollback SQL and Supabase apply remain blocked pending
  separate explicit approval.

## Phase 5CS - Owner-Link Challenge SQL Review Packets

Phase 5CS adds local executable review packets only:

- `supabase/telegram_owner_link_challenge_forward_review.sql`
- `supabase/telegram_owner_link_challenge_rollback_review.sql`

Forward packet scope:

- Create `public.telegram_owner_link_challenges`.
- Create service-role-only issue and consume RPCs.
- Enforce hash-only challenge storage, active-session ownership validation,
  ten-minute maximum TTL, one active challenge per agent/session/hash, and no
  browser table access.
- Atomically claim Telegram updates, consume one challenge, and insert one
  owner/read-only authorization for exact private Telegram user/chat identity.
- Require the active Telegram session's `agent_id` to match the owner-link
  challenge `agent_id` during consume.

Rollback packet scope:

- Revoke/drop the exact owner-link RPC signatures.
- Drop `public.telegram_owner_link_challenges` only when it contains no rows.
- Avoid `CASCADE` and leave existing Telegram session, webhook, authorization,
  processed-update, and Vault objects untouched.

Safety state:

- The SQL packets were not run against Supabase.
- No schema/RLS, grant, RPC, row, runtime, UI, secret, deployment, Netlify, or
  production state changed.
- Supabase apply still requires a fresh target baseline, verifier review, and
  explicit apply approval.
- The verifier must reject implementations that omit exact agent/session,
  challenge-hash, current-owner, or active-authorization predicates.

## Phase 5CT - Owner-Link Challenge Post-Apply State

The approved owner-link challenge SQL packet was applied manually to Supabase
and its required read-only verification completed successfully.

Verified production state:

- The forward packet completed with `Success. No rows returned`.
- The owner-link challenge contract verifier returned all 17 required checks
  as `true`.
- The authenticated demo-write lockdown verifier returned 131 allowed/required
  checks as `true` and the 9 expected browser-write denial checks as `false`.
- The owner-link challenge table and issue/consume RPCs remain service-role
  only. No browser role received direct table or RPC access.

Local follow-up:

- `supabase/schema.sql` now mirrors the already-applied owner-link challenge
  table, active unique indexes, RLS state, issue/consume RPCs, revokes, and
  service-role grants.

Safety state:

- No owner-link runtime adapter is wired into an Edge Function entrypoint.
- No challenge or authorization row was created.
- No runtime gate was enabled.
- No Edge Function or Netlify deploy was triggered.
- No live Telegram API, BotFather token, Vault secret, or secret value was
  accessed.

## Phase 5CU - Isolated Owner-Link RPC Adapters

Phase 5CU adds isolated, injected-client adapters and mocked tests for the
already-applied owner-link challenge RPCs:

- `telegram-connect/owner-link-challenge.ts` prepares the exact
  `issue_telegram_owner_link_challenge` hash-only RPC contract.
- `telegram-webhook/owner-link-consume.ts` prepares the exact
  `consume_telegram_owner_link_challenge` hash-only RPC contract.

Safety and response rules:

- Neither adapter is imported by an Edge Function entrypoint, so runtime
  behavior remains unchanged and owner-linking remains unavailable.
- Tests use only injected mock RPC clients. No real database, Supabase, Vault,
  Telegram API, token, or secret is accessed.
- Issue results expose only `{ issued: true, status: "issued" }`.
- Consume results expose only bounded linked, duplicate, or not-linked states.
- Empty consume rows fail closed as a safe not-linked no-op.
- Malformed/duplicate/extra-field rows and RPC failures return fixed sanitized
  errors without owner, workspace, session, Telegram identity, challenge hash,
  token reference, or raw database details.
- No raw challenge enters either adapter or RPC argument.

Verification:

- Deno checks passed for both existing entrypoints and both new adapters.
- Full shared/connect/webhook Deno tests passed: 275 tests, 0 failures.
- `npm run check:functions`, `npm exec tsc -- --noEmit`, and
  `npm run build` passed.
- `git diff --check` passed.
- Static scan confirmed no entrypoint import, env access, service-role client
  construction, Telegram API call, Vault access, logging, or token handling in
  either new adapter.

Deferred:

- Wiring either adapter into `telegram-connect/index.ts` or
  `telegram-webhook/index.ts`.
- Enabling an owner-link runtime gate.
- Issuing or consuming a real challenge.
- Creating a Telegram chat authorization row through live runtime.
- Edge Function deployment, push, or any production runtime change.

## Phase 5CV - Owner-Link Runtime Wiring Preflight

Phase 5CV audits the current runtime order and defines the next default-off
wiring boundary. This phase changes documentation only.

Current runtime findings:

- `telegram-connect` is responsible for BotFather token validation, secret
  storage, session persistence, and webhook registration. It should not also
  issue or return owner-link challenges.
- A separate authenticated `telegram-link` Edge Function is still the correct
  issue boundary because it can require a fresh Supabase session and exact
  workspace ownership without mixing pairing material into token handling.
- `telegram-webhook` currently verifies the webhook secret, resolves the active
  session, reads the request body once, parses only normal read-only commands,
  checks chat authorization, claims the update, and optionally delivers a
  response.
- The current normal parser accepts only `/help` and `/status`. It correctly
  rejects `/start <challenge>` and `/link <challenge>`.
- The current owner-link consume RPC already claims the Telegram update,
  consumes the challenge, revalidates ownership/session state, and creates the
  owner authorization atomically. The normal `claim_telegram_update` stage must
  not run again for an owner-link update.

Required issue-path design:

1. Add a separate `telegram-link` Edge Function with authenticated ownership
   validation and existing request-size/content-type/error protections.
2. Add an exact active-session lookup that selects only session ID, agent ID,
   bot handle, and webhook status. Never select or return `token_secret_ref`.
3. Generate the raw challenge only after authentication, ownership, and active
   session validation succeed.
4. Persist only the challenge hash through
   `issue_telegram_owner_link_challenge`.
5. Return the raw challenge exactly once inside a bounded Telegram deep link.
   Never return the hash, session/owner/workspace IDs, or raw RPC details.
6. Keep the issue path behind
   `KYRA_TELEGRAM_LINK_ISSUE_ENABLED`, defaulting off and enabling only for the
   exact string `true`.

Required webhook consume-path design:

1. Add a mutually exclusive owner-link branch after webhook-secret
   verification and active-session lookup, but before normal chat
   authorization.
2. Read the webhook body exactly once and route it to either owner-link parsing
   or the existing normal read-only parser. Never attempt a second body read.
3. The owner-link branch accepts only exact private-chat `/start <challenge>`
   or `/link <challenge>` input and passes only the hash and bounded Telegram
   identifiers to `consume_telegram_owner_link_challenge`.
4. Owner-link updates bypass normal chat authorization, normal update claim,
   and normal delivery because the consume RPC is the atomic authorization and
   replay boundary.
5. Linked, duplicate, expired, mismatched, and unknown challenges should return
   the same generic HTTP 200 acknowledgement to Telegram. This avoids a
   challenge-validity oracle and retry storms.
6. Keep the branch behind
   `KYRA_TELEGRAM_WEBHOOK_OWNER_LINK_CONSUME_ENABLED`, defaulting off and
   enabling only for the exact string `true`.
7. Enabling consume requires webhook session lookup to be enabled. It must not
   require normal chat authorization, claim, or delivery gates.

Tests required before any runtime wiring commit:

- Both new gates default off, ignore non-exact values, and read only their exact
  keys.
- Disabled gates never create service-role/RPC dependencies.
- Issue requires authenticated ownership and exactly one active matching
  Telegram session before challenge generation or RPC execution.
- Issue never returns challenge hash or private IDs and sanitizes empty,
  duplicate, malformed, RPC-error, and thrown-error results.
- Webhook secret/session verification completes before body access.
- The webhook body is read once only.
- Owner-link commands take the consume branch before normal chat authorization.
- Non-owner-link commands preserve the existing read-only pipeline unchanged.
- Owner-link consume never calls normal chat authorization, normal claim, token
  resolution, Telegram API delivery, or a second RPC after a terminal result.
- All consume outcomes return one generic acknowledgement without IDs, hashes,
  raw payload, or database details.

Remaining blockers before live owner-link gate enablement:

- No deployable `telegram-link` Edge Function exists yet.
- No exact active Telegram session lookup adapter exists for challenge issue.
- No single-read owner-link-versus-normal webhook dispatch contract exists.
- No approved durable rate-limit or abuse-control boundary exists for challenge
  issue and consume attempts. This must be resolved before general production
  enablement.
- No owner-link pairing UI exists.
- Neither new gate exists, and no Edge Function has been redeployed for this
  owner-link path.

Recommended next local implementation order:

1. Add an inert `telegram-link` Edge Function skeleton, default-off issue gate,
   active-session lookup adapter, and mocked tests. Do not deploy it.
2. Add a pure single-read webhook dispatch contract and mocked tests without
   wiring it into the webhook entrypoint.
3. Final-review both slices, then separately wire them behind default-off gates.
4. Design and approve durable abuse controls before any live gate enablement.

Safety state:

- No runtime entrypoint, gate, schema/RLS, environment value, secret, Vault
  object, Telegram API, database row, deployment, Netlify state, or production
  state changed in this preflight.

## Phase 5CW - Default-Off Owner-Link Issue Function

Phase 5CW adds a local-only `telegram-link` Edge Function for issuing an
owner-link challenge. The function is registered with Supabase gateway JWT
verification enabled but has not been deployed.

Runtime boundary:

- `KYRA_TELEGRAM_LINK_ISSUE_ENABLED` defaults off and enables only for the
  exact string `true`.
- While the gate is disabled, the handler returns `501 not_configured` without
  reading the request body, required runtime secrets, Supabase session,
  service-role client, database, or RPC.
- The enabled path requires a Bearer session, exact agent ownership, and
  exactly one active matching Telegram session before challenge generation.
- The active-session lookup selects only `id`, `agent_id`, `bot_handle`, and
  `webhook_status`. It never selects or returns `token_secret_ref`.
- The request body accepts only `{ agentId }`; additional fields, including
  `botToken`, are rejected.
- Only the challenge hash is sent to the existing service-role-only issue RPC.
  The raw challenge is returned once inside the bounded Telegram deep link and
  is never persisted or logged.
- Responses do not expose owner, workspace, agent, session, challenge-hash,
  token-reference, BotFather-token, or raw database-error details.
- No Telegram API, Vault, schema/RLS, frontend token input, or live database
  row behavior was added.

Files added or updated:

- `supabase/functions/telegram-link/index.ts`
- `supabase/functions/telegram-link/core.ts`
- `supabase/functions/telegram-link/runtime-config.ts`
- `supabase/functions/telegram-link/active-session-lookup.ts`
- Mocked Deno tests and local README under
  `supabase/functions/telegram-link/`
- `supabase/config.toml` with `functions.telegram-link.verify_jwt = true`
- `scripts/check-functions.mjs` with the new entrypoint and JWT contract

Verification:

- All 14 `telegram-link` tests passed when run by test file.
- Existing shared, `telegram-connect`, and `telegram-webhook` tests passed:
  275 tests, 0 failures.
- Deno checks, formatter check, `npm run check:functions`,
  `npm exec tsc -- --noEmit`, `npm run build`, and `git diff --check` passed.
- Deno 2.8.1 on Windows panics internally when multiple `telegram-link` test
  files are supplied to one `deno test` command. Each test file passes
  independently; this is recorded as a local runner limitation.
- Static review confirmed no Telegram API call, Vault access, request-body
  logging, token return, or secret-value read in the disabled runtime path.

Deferred and blocked:

- Do not deploy `telegram-link` or enable its issue gate yet.
- Do not create a real owner-link challenge or authorization row.
- Do not add owner-link UI or expose a live pairing claim.
- Do not enable owner linking until the webhook consume branch, durable
  rate-limit/abuse controls, deployment plan, and production smoke procedure
  are separately approved.
- No push, Edge Function deploy, Netlify action, or production runtime change
  occurred in this phase.

## Phase 5CX - Isolated Owner-Link Webhook Dispatch Contract

Phase 5CX adds a pure, local-only owner-link versus read-only webhook dispatch
contract:

- `supabase/functions/telegram-webhook/owner-link-dispatch.ts`
- `supabase/functions/telegram-webhook/owner-link-dispatch_test.ts`

Dispatch boundary:

- The dispatcher accepts an already-read update object. It has no `Request`
  access and cannot read the webhook body a second time.
- It is not imported or wired by `telegram-webhook/index.ts`, so current
  runtime behavior remains unchanged.
- When owner-link consume is disabled, every update stays on the existing
  read-only parser route and no owner-link parser or consume dependency runs.
- When enabled by an injected boolean, only narrow `/start` or `/link`
  candidates enter the owner-link route. Other commands preserve the existing
  read-only route.
- Owner-link candidates parse first, consume at most once through an injected
  dependency, and never call normal chat authorization, normal update claim,
  token resolution, or Telegram delivery from this contract.
- Linked, duplicate, not-linked, and invalid owner-link candidates return the
  same bounded acknowledgement. The acknowledgement exposes no challenge,
  hash, session ID, Telegram identity, raw update, or result detail.
- Unexpected parser, consume, and result-shape failures return one fixed
  sanitized server error.

Verification:

- All 7 isolated dispatch tests passed.
- Tests cover disabled routing, normal read-only preservation, narrow
  candidate detection, parse-before-consume order, one consume call, generic
  terminal acknowledgements, invalid-candidate acknowledgement, and sanitized
  failures.
- No runtime gate, entrypoint import, RPC client, database access, Telegram API
  call, Vault access, logging, schema/RLS change, deployment, or live row was
  added.

Deferred and blocked:

- Do not wire the dispatch contract into `telegram-webhook/index.ts` yet.
- A default-off owner-link consume runtime gate and single-read entrypoint
  wiring still require a separate final-reviewed slice.
- Durable rate-limit and abuse-control design remains required before either
  owner-link gate can be enabled in production.
- No push, Edge Function deploy, Netlify action, or production runtime change
  occurred in this phase.

## Phase 5CY - Default-Off Owner-Link Webhook Consume Wiring

Phase 5CY wires the isolated owner-link dispatch and consume adapter into the
local `telegram-webhook` entrypoint behind a new default-off runtime gate:

- `KYRA_TELEGRAM_WEBHOOK_OWNER_LINK_CONSUME_ENABLED`

Runtime order and fail-closed behavior:

1. Telegram webhook secret header verification remains first.
2. Content-type and body-size guards remain before session lookup.
3. Owner-link consume requires the existing active-session lookup gate and a
   successful session result before body access.
4. The webhook body is read once and passed to the isolated dispatch contract.
5. Owner-link candidates parse, hash, and call the existing service-role-only
   consume RPC at most once.
6. Owner-link terminal outcomes return one generic HTTP 200 acknowledgement
   and bypass normal chat authorization, normal update claim, token
   resolution, and Telegram API delivery.
7. Non-owner-link commands preserve the existing normal read-only route.

Gate and dependency safety:

- The consume gate defaults off and enables only for the exact string `true`.
- With lookup disabled, the runtime does not create the consume dependency or
  read required service-role environment values.
- With consume disabled, existing webhook behavior and body-read order remain
  unchanged.
- The owner-link response exposes no challenge, hash, Telegram identity,
  session ID, token ref, BotFather token, raw update, RPC result, or raw error.
- The owner-link branch does not resolve a delivery token or call Telegram.

Verification:

- Added mocked handler and runtime dependency tests for lookup-before-body,
  default-off/lazy setup, single owner-link consume, normal-pipeline bypass,
  invalid-candidate generic acknowledgement, normal read-only preservation,
  and exact mocked RPC order.
- No real Supabase RPC, database row, Telegram API, Vault secret, token, or
  environment secret was accessed during verification.

Deferred and blocked:

- Do not deploy `telegram-webhook` with this code or enable the owner-link
  consume gate yet.
- Durable rate-limit and abuse-control design remains required before live
  owner-link issue or consume.
- Deployment ordering must ensure the consume-capable webhook is deployed and
  smoke-tested default-off before either owner-link gate is enabled.
- No push, Edge Function deploy, Netlify action, gate enablement, or production
  runtime change occurred in this phase.

## Phase 5CZ - Owner-Link Durable Abuse-Control Design

Phase 5CZ audits the owner-link issue and consume paths and defines the durable
abuse-control boundary. This phase changes documentation only.

Current findings:

- `issue_telegram_owner_link_challenge` validates ownership, active session,
  TTL, and one active challenge, but an authenticated owner can currently
  revoke and reissue challenges repeatedly without a durable rate limit.
- Successful issue history already exists in
  `telegram_owner_link_challenges.created_at`, but there are no supporting
  historical-rate indexes or bounded issue result for a rate-limited state.
- `consume_telegram_owner_link_challenge` records a Telegram update only after
  it finds an eligible challenge. Invalid, expired, mismatched, and unknown
  challenge attempts therefore leave no durable attempt counter.
- Edge Function memory counters are not sufficient because instances are
  distributed, restartable, and independently scalable.
- Webhook-secret verification, short challenge TTL, hash-only storage, atomic
  consume, and generic acknowledgements reduce risk but do not replace durable
  rate limiting.

Recommended durable design:

### Issue Limit

- Enforce issue limits atomically inside
  `issue_telegram_owner_link_challenge`, after ownership/session validation and
  before revoking or inserting a challenge.
- Use successful challenge history to limit each owner-plus-agent and
  owner-plus-session scope. Recommended initial policy:
  - maximum 3 successful issues per 15 minutes per agent;
  - maximum 3 successful issues per 15 minutes per active session;
  - maximum 20 successful issues per 24 hours per owner.
- Add only the indexes required for bounded historical checks, such as owner
  plus creation time, agent plus creation time, and session plus creation time.
- Return a bounded `rate_limited` issue state. The Edge Function may map this
  to a sanitized `429` without returning counts, timestamps, IDs, or internal
  policy details.

### Consume Limit

- Add a compact service-role-only consume limiter table keyed by exact active
  Telegram session plus private Telegram user/chat identity.
- Store only bounded counter metadata: session ID, Telegram user/chat IDs,
  window start, attempt count, optional blocked-until time, and update time.
  Never store challenge, challenge hash, raw update, token, or payload.
- Atomically increment/check the limiter inside
  `consume_telegram_owner_link_challenge` before challenge lookup.
- Recommended initial policy:
  - maximum 5 owner-link candidates per 10 minutes per private identity;
  - temporary 30-minute block after the identity limit;
  - maximum 30 owner-link candidates per 10 minutes per active session to
    reduce distributed identity spam.
- A limited consume attempt must return the same generic not-linked/received
  behavior as an expired, mismatched, or unknown challenge. It must not expose
  whether the limit, challenge lookup, or authorization state caused the
  no-op.

### Retention And Operations

- Historical challenges and inactive limiter rows need an approved retention
  policy before live enablement.
- Prefer a narrow service-role maintenance RPC or separately approved
  scheduled cleanup. Do not grant browser roles delete access.
- Add observable aggregate counters without request payloads, challenge
  material, token values, or Telegram message text.
- Keep both owner-link gates disabled if limiter checks, cleanup, or verifier
  expectations are unavailable.

Required future approvals:

- Schema/RLS/grant approval for consume limiter storage and issue-history
  indexes.
- RPC contract approval for atomic issue and consume limiter behavior.
- Forward SQL, rollback SQL, and standalone verifier review.
- Manual Supabase apply and post-apply verification.
- Final default-off runtime adapter changes and mocked tests.
- Separate deploy approval, then separate gate-enablement and production smoke
  approval.

Safe work before schema approval:

- Add pure limiter decision/result contracts and mocked tests.
- Define sanitized `rate_limited` issue response behavior.
- Prepare comment-only SQL/verifier expectations for review.
- Keep current issue and consume gates default-off.

Safety state:

- No schema/RLS, RPC, grant, environment value, secret, database row, runtime
  gate, deployment, Netlify state, or production state changed in this audit.

## Phase 5DA - Pure Owner-Link Rate-Limit Contracts

Phase 5DA adds local pure decision and response contracts for the approved
initial owner-link abuse-control policy:

- `supabase/functions/_shared/telegram-owner-link-rate-limit.ts`
- `supabase/functions/_shared/telegram-owner-link-rate-limit_test.ts`

Contract behavior:

- Issue decisions accept already-counted successful issue totals for the
  current agent, active session, and owner windows.
- Consume decisions accept already-counted candidate totals for the private
  identity and active session windows plus an optional blocked-until time.
- Counts represent durable attempts recorded before the next attempt. A count
  equal to its maximum is denied.
- Every allowed decision exposes only `{ allowed: true, status: "allowed" }`.
- Every denied decision exposes only
  `{ allowed: false, status: "rate_limited" }`.
- Invalid counts, timestamps, or shapes fail closed with one fixed sanitized
  contract error.
- The future issue API rate-limit response is fixed and does not expose
  thresholds, remaining attempts, reset time, owner/session identity, or
  internal policy detail.

Safety boundary:

- The module is not imported by any Edge Function entrypoint.
- It performs no database/RPC access, environment read, logging, Telegram API
  call, Vault access, token handling, or runtime gate change.
- It does not implement an in-memory limiter and must not be treated as the
  durable enforcement layer.

Verification:

- All 8 isolated rate-limit tests passed.
- Tests lock exact initial thresholds, allow/deny boundaries, active and
  expired block behavior, identical denial decisions, fail-closed validation,
  and sanitized rate-limited response shape.

Deferred and blocked:

- Do not wire these contracts into issue or consume runtime before approved
  durable SQL/RPC enforcement exists.
- Schema/RLS/grant/RPC SQL, rollback, verifier, Supabase apply, deployment, and
  gate enablement remain separate approval points.
- No push, deploy, live database access, or production state change occurred.

## Phase 5DB - Durable Owner-Link Rate-Limit SQL Preflight

Phase 5DB audits the applied owner-link schema and locks the smallest durable
rate-limit SQL/RPC boundary before any executable SQL is prepared. This phase
changes documentation only.

Current schema findings:

- `telegram_owner_link_challenges` already retains every successful issue,
  including later-revoked challenges, and is sufficient as the durable issue
  history source.
- The table does not yet have historical lookup indexes on `agent_id`,
  `telegram_session_id`, or `issued_by_user_id` combined with `created_at`.
- `issue_telegram_owner_link_challenge` currently holds an agent-scoped
  advisory lock, but an owner-wide limit across multiple agents also requires
  one deterministic owner-scoped transaction lock.
- `consume_telegram_owner_link_challenge` currently resolves a valid challenge
  before claiming the Telegram update. Invalid or unknown owner-link
  candidates therefore cannot be counted or de-duplicated durably.
- Both RPCs are security-invoker, empty-search-path, service-role-only
  contracts. The limiter extension must preserve those properties.

Recommended minimal schema boundary:

- Do not add a separate issue-counter table. Add only bounded historical
  indexes to the existing challenge table:
  - `(agent_id, created_at desc)`;
  - `(telegram_session_id, created_at desc)`;
  - `(issued_by_user_id, created_at desc)`.
- Add one private `telegram_owner_link_consume_rate_limits` table containing
  only limiter state:
  - active Telegram session ID;
  - scope, limited to `session` or `identity`;
  - private Telegram user ID only for identity scope;
  - window start, attempt count, optional blocked-until time, and update time.
- Require exact scope/identity consistency, nonnegative bounded counts, valid
  timestamps, a Telegram-session foreign key, and unique bucket keys for
  session and identity scopes. The consume RPC must separately require that
  the referenced session is active before creating or updating a bucket.
- Enable RLS with no policies. Revoke all browser/public access. Grant
  `service_role` only the minimum `select`, `insert`, and `update` privileges;
  do not grant delete, truncate, references, or trigger.
- Never store a challenge, challenge hash, Telegram update body, command text,
  message text, token, secret, payload, owner ID, or workspace ID in the
  limiter table.

Issue RPC contract:

1. Validate the current owner, exact active session, challenge hash, and TTL as
   today.
2. Acquire owner-scoped then agent-scoped transaction advisory locks in one
   fixed order.
3. Count successful issue history inside the approved agent/session 15-minute
   windows and owner 24-hour window.
4. If any count is already at its maximum, return exactly one bounded
   `{ issued: false, status: "rate_limited" }` row before revoking or inserting
   a challenge.
5. Otherwise preserve the existing revoke-and-insert behavior and return only
   `{ issued: true, status: "issued" }`.

Consume RPC contract:

1. Reject malformed bounded arguments before any limiter write.
2. Resolve the exact active Telegram session without using the challenge hash.
3. Acquire session-scoped then identity-scoped transaction advisory locks in
   one fixed order.
4. Claim the Telegram update before limiter mutation. A duplicate update must
   return the existing bounded duplicate behavior and must not increment any
   bucket.
5. Atomically reset expired windows, increment the session and identity
   buckets, and set the fixed identity block when its threshold is reached.
6. If either limiter denies the attempt, commit the claim/counter state and
   return the same generic not-linked/no-row behavior as an unknown or expired
   challenge.
7. Only after limiter approval may the RPC look up, consume, and authorize the
   challenge. Any later unexpected failure must roll back the claim, limiter
   mutation, challenge consume, and authorization insert together.

Verifier and rollback expectations:

- A standalone read-only verifier must check the limiter table shape,
  constraints, RLS/no-policy state, exact grants, indexes, RPC volatility,
  security-invoker state, empty search path, lock ordering, bounded result
  contracts, and absence of browser execute privileges.
- The existing authenticated-write lockdown verifier must also prove browser
  roles cannot access the limiter table or execute either owner-link RPC.
- Forward SQL must stop on baseline drift and must replace both RPC definitions
  in the same reviewed transaction as the limiter schema/index changes.
- Rollback must restore the previously verified RPC definitions and remove
  limiter objects only under an explicitly reviewed empty/inactive condition.
  If limiter rows or enabled runtime gates exist, use a forward fix instead.
- Historical challenge retention must remain at least longer than the
  owner-wide 24-hour issue window. Limiter cleanup must not remove an active
  window or block.

Deferred implementation order:

1. Prepare comment-only schema/RPC and verifier expectations.
2. Review forward, rollback, privilege, concurrency, and retention contracts.
3. Obtain explicit schema/RLS/RPC approval.
4. Prepare executable forward/rollback/verifier SQL and review it again.
5. Apply manually in Supabase and run both verifiers.
6. Only after verified durable enforcement, update the default-off Edge
   adapters and tests to understand the bounded issue `rate_limited` result.
7. Keep owner-link runtime gates disabled until a separate deployment and
   enablement approval.

Safety state:

- No executable SQL, schema/RLS/RPC/grant change, Supabase apply, database row,
  environment value, secret, runtime wiring, gate, deploy, Netlify action, or
  push occurred in Phase 5DB.

## Phase 5DC - Comment-Only Durable Limiter SQL Contract

Phase 5DC adds one non-executable review artifact:

- `supabase/telegram_owner_link_rate_limit_schema_draft.sql`

The draft is intentionally comment-only and combines the low-risk preflight
work for:

- exact issue-history indexes;
- the private consume-limiter bucket table contract;
- issue and consume RPC replacement ordering;
- RLS, grants, and service-role-only boundaries;
- concurrency, fixed-window, and rollback risks;
- standalone verifier expectations;
- retention and operational constraints;
- future Edge adapter behavior after a verified SQL apply.

Important design decision:

- The compact consume bucket model is explicitly documented as a fixed-window
  model, not an exact sliding-window event log.
- Identity blocking reduces the highest-risk boundary burst. The
  session-defense boundary behavior still requires explicit review and
  concurrency tests before executable SQL approval.
- If strict sliding-window enforcement is required, the bucket design must be
  replaced and reviewed before any apply.

Safety verification requirement:

- Every nonblank line in the draft must begin with `--`.
- No part of the draft may be executed or applied.
- Executable SQL, schema/RLS/grant/RPC changes, Supabase apply, `schema.sql`
  mirroring, Edge adapter wiring, deployment, and runtime enablement remain
  separate manual approval points.

Safety state:

- No executable SQL, schema/RLS/RPC/grant change, Supabase apply, database row,
  environment value, secret, runtime wiring, gate, deploy, Netlify action, or
  push occurred in Phase 5DC.

## Phase 5DD - Durable Owner-Link Rate-Limit SQL Review Packet

Phase 5DD converts the approved comment-only contract into a local executable
SQL review packet. The packet is intentionally not applied and remains blocked
behind separate schema/RLS/RPC approval:

- `supabase/telegram_owner_link_rate_limit_forward_review.sql`
- `supabase/telegram_owner_link_rate_limit_rollback_review.sql`
- `supabase/verify_telegram_owner_link_rate_limit_contract.sql`

The existing authenticated-write lockdown verifier is also extended to cover
the proposed limiter table and the existing issue/consume RPC execute grants.

Forward packet scope:

- Stop on baseline drift before creating or replacing objects.
- Add only the three approved issue-history indexes and one private
  fixed-window consume-limiter table.
- Enable RLS with no policies and grant only `select`, `insert`, and `update`
  to `service_role`.
- Replace the issue RPC with deterministic owner-before-agent locking,
  bounded history checks, and a sanitized `rate_limited` result before any
  challenge revoke or insert.
- Replace the consume RPC with session-before-identity locking,
  update-claim-before-limit ordering, durable fixed-window counters, generic
  limiter denial, and challenge lookup only after limiter approval.
- Create no challenge, authorization, processed-update, limiter, token,
  secret, payload, or Telegram API state.

Rollback and verifier scope:

- Rollback restores the exact currently verified issue and consume RPC
  definitions, removes only the proposed indexes/table, refuses to continue
  when limiter rows exist, and never uses `CASCADE`.
- The standalone verifier is read-only and guarded before apply. It checks
  table shape, constraints, RLS/no-policy state, indexes, grants, RPC security
  and result contracts, lock/order markers, and exclusion from public views.
- `verify_authenticated_demo_write_lockdown.sql` additionally proves browser
  roles cannot access the limiter table or execute either owner-link RPC.

Local review results:

- Both read-only verifier files parse without modification.
- Forward and rollback packets parse after neutralizing only clauses that the
  local third-party parser does not support: RLS enablement, security-invoker,
  empty search path, and grant/revoke syntax.
- Rollback issue and consume RPC definitions exactly match the current
  `supabase/schema.sql` baseline.
- Static checks confirm owner-before-agent and session-before-identity lock
  ordering, claim-before-limit, limit-before-challenge, rate-limit-before-issue
  mutation, row locking, expiry compatibility, and authorization-after-
  challenge ordering.
- The comment-only Phase 5DC draft remains comment-only.
- `npm run check:functions` and `git diff --check` pass.

Manual apply blockers:

- Review and approve the fixed-window boundary behavior and parallel-call
  concurrency expectations.
- Confirm the target Supabase project still matches the expected baseline.
- Explicitly approve the forward, rollback, schema/RLS/grant, and RPC changes.
- Apply the forward packet manually, then run the standalone limiter verifier,
  owner-link challenge verifier, and authenticated-write lockdown verifier.
- Keep both owner-link runtime gates disabled and stop if any verifier result
  is false.

Safety state:

- No SQL was applied, no schema/RLS/RPC/grant or database row changed, and no
  environment value, secret, runtime gate, Edge Function, deployment,
  Netlify state, or production behavior changed in Phase 5DD.

## Phase 5DE - Durable Owner-Link Rate-Limit Apply Closeout

The approved durable owner-link rate-limit forward packet was applied manually
to Supabase. The apply completed successfully and created no limiter,
challenge, authorization, processed-update, token, secret, or payload rows.

Initial verifier review:

- The authenticated-write lockdown checks continued to show the expected
  browser-denial and service-role-only privilege boundaries.
- Three initial verifier checks returned false because the local verifier
  assumptions had drifted from valid PostgreSQL output and the approved RPC
  replacement:
  - PostgreSQL truncated two 66-character constraint names to its 63-character
    identifier limit.
  - The issue-history index verifier inspected the `DESC` property through an
    unreliable column-only index-definition form.
  - The existing challenge verifier expected positive validation predicates
    from the previous consume RPC instead of the equivalent new fail-fast
    negative predicates.

Verifier correction:

- The forward review packet and schema snapshot now use the exact persisted
  63-character constraint names.
- The rate-limit verifier checks full index definitions for `created_at desc`
  while still checking exact key columns.
- The owner-link challenge verifier recognizes the approved fail-fast input
  validation contract.
- These changes modify verifier/snapshot expectations only. No follow-up SQL
  mutation was required.

Verified apply result:

- The owner-link challenge verifier rerun returned all 17 required checks
  `true`.
- The durable owner-link rate-limit verifier rerun returned all 16 required
  checks `true`.
- The limiter table is private, RLS-enabled, has no policies, and exposes only
  the approved `select`, `insert`, and `update` privileges to `service_role`.
- Both issue and consume RPCs remain volatile, security-invoker,
  empty-search-path, and service-role-only contracts.
- Issue-history indexes, deterministic lock ordering, claim-before-limit,
  limit-before-challenge, generic denial, result contracts, and public-view
  exclusions are verified.
- `supabase/schema.sql` mirrors the verified applied table, indexes, RPCs,
  RLS state, revokes, and grants.

Remaining blocked work:

- Keep both owner-link issue and consume runtime gates disabled.
- Do not create a live owner-link challenge or authorization row yet.
- Do not deploy Edge Functions, enable gates, run a live Telegram smoke test,
  or push without the next explicit approval.
- The next safe implementation slice is the default-off Edge adapter update
  that understands the bounded issue `rate_limited` result while preserving
  generic consume behavior.

Safety state:

- The approved database apply changed only the reviewed durable limiter
  schema/index/RPC/grant boundary.
- No environment value or secret was read, no Telegram API call occurred, no
  runtime gate was enabled, and no Edge Function, Netlify, deploy, push, or
  production Telegram behavior changed in Phase 5DE.
