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

Current storage findings:

- The repo does not currently implement Supabase Vault in executable code.
- The repo has `pgcrypto`, but `pgcrypto` alone is not a complete per-agent
  token storage design because it does not define key management, secret
  resolution, or access boundaries.
- `telegram_sessions.token_secret_ref` already exists and is currently written
  as `null` for demo sessions.
- `authenticated` users currently have `select` access to
  `public.telegram_sessions`.
- Dashboard code currently fetches Telegram sessions with
  `telegram_sessions?select=*`.
- Public agent profile views do not expose `token_secret_ref`.

Important risk before real token storage:

- A real `token_secret_ref` is not the raw BotFather token, but it is still
  sensitive backend metadata.
- With the current `select=*` dashboard query and broad authenticated table
  select, a browser session could receive `token_secret_ref` once it becomes
  non-null.
- This must be fixed before any real secret reference is written.

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
   - Update dashboard reads to use the safe view/RPC instead of
     `telegram_sessions?select=*`.

2. Fallback: use column-level grants on `telegram_sessions`.
   - Revoke broad authenticated `select`.
   - Grant authenticated users select only on safe columns.
   - Keep `token_secret_ref` service-role/server-only.
   - This is acceptable but more brittle than a dedicated safe view/RPC.

Required future approvals:

- Enable or apply Supabase Vault.
- Add Vault-backed store/resolve/revoke RPCs.
- Add a safe Telegram session metadata view/RPC.
- Change grants/RLS around `telegram_sessions`.
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
- Dashboard still uses `telegram_sessions?select=*`, so real secret references
  must not be written yet.
- Authenticated table access for `telegram_sessions` is still broad enough that
  a non-null `token_secret_ref` could reach the browser unless a safe view/RPC
  or column-level grant change is approved first.

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
- Real storage wiring must happen only after safe Telegram session metadata
  exposure is approved.

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
- Do not change dashboard queries.
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
- Dashboard reads still use `telegram_sessions?select=*`.
- Authenticated users currently have broad enough read access to
  `telegram_sessions` that a non-null `token_secret_ref` could reach browser
  code.
- Public agent profile views do not currently expose `token_secret_ref`.
- The isolated getMe helper and mocked secret-store adapter are not wired into
  the live `telegram-connect` runtime.

Blocking issue before real metadata writes:

- `token_secret_ref` is sensitive backend metadata even though it is not the raw
  BotFather token.
- No real connect flow may write a non-null `token_secret_ref` until frontend
  reads are moved away from `telegram_sessions?select=*` and schema/RLS exposure
  is narrowed.
- The safe exposure boundary must be approved before any real persistence,
  reconnect, webhook registration, or active Telegram session state.

Recommended safe exposure model:

1. Preferred: add a safe view or RPC for browser-facing Telegram session
   metadata.
   - Safe fields: `id`, `agent_id`, `bot_handle`, `webhook_status`,
     `created_at`, and `last_event_at`.
   - Excluded fields: `token_secret_ref`, webhook secrets, chat identifiers,
     raw webhook payloads, internal error details, `owner_user_id`,
     `workspace_id`, and raw DB errors.
   - Dashboard code should use this safe view/RPC instead of
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

1. Document and approve the safe metadata exposure boundary.
2. Add safe view/RPC or column grants with separate schema/RLS approval.
3. Update dashboard reads away from `telegram_sessions?select=*`.
4. Add tests that prove browser-facing reads cannot include `token_secret_ref`.
5. Add persistence adapter tests with mocked DB writes only.
6. Wire real metadata writes in `telegram-connect` after token validation and
   secret storage are separately approved.
7. Add reconnect/duplicate bot tests before webhook registration becomes live.

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
- Do not change dashboard queries until the safe view/RPC or grant plan is
  approved.
- Do not write non-null `telegram_sessions.token_secret_ref`.
- Do not persist Telegram bot identity.
- Do not wire real secret storage into runtime.
- Do not call real Telegram `getMe` from runtime.
- Do not register or revoke webhooks.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

## Phase 5L Safe Telegram Metadata Exposure Plan

Phase 5L defines how browser-facing Telegram session metadata should be exposed
before real Telegram persistence is enabled. It does not change schema/RLS,
dashboard queries, Edge Functions, token handling, Vault access, Telegram API
calls, deploys, pushes, or production behavior.

Current exposure findings:

- `telegram_sessions` includes `token_secret_ref`.
- RLS limits `telegram_sessions` reads to workspace owners through the existing
  owner policy.
- Authenticated users currently have broad table-level select on
  `telegram_sessions`.
- Dashboard currently fetches Telegram session rows with
  `telegram_sessions?select=*`.
- Public agent profile reads use `public_agent_profiles` and do not expose
  `token_secret_ref`.
- The TypeScript database type model currently covers `Tables`; browser-facing
  view typing will need either a `Views` section or a local safe row type.

Why this must be fixed before real connect:

- `token_secret_ref` is not the raw BotFather token, but it is still sensitive
  backend metadata.
- Owner-only RLS is not enough for this field because the browser should not
  receive any token reference at all.
- A non-null `token_secret_ref` must not be written until broad table reads and
  `select=*` dashboard reads are removed from the browser path.

Preferred safe exposure approach:

1. Create a browser-facing safe view such as
   `public.telegram_session_summaries`.
2. Use `with (security_invoker = true)` so existing RLS still applies.
3. Revoke broad authenticated select on `telegram_sessions`.
4. Grant authenticated select only on safe `telegram_sessions` columns required
   by the view.
5. Grant authenticated select on the safe view.
6. Update dashboard reads to use the safe view and explicit column selection.
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

Non-applied SQL direction for future approval:

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

Dashboard query target after approval:

```ts
telegram_session_summaries?select=id,agent_id,bot_handle,webhook_status,created_at,last_event_at&agent_id=in.(...)
```

Do not keep this browser query after safe exposure work:

```ts
telegram_sessions?select=*
```

TypeScript impact:

- Add a safe row type for `telegram_session_summaries`.
- Prefer adding `KyraDatabase["public"]["Views"]` typing if more views will be
  used later.
- A local `TelegramSessionSummaryRow` interface is acceptable for the first
  narrow dashboard change if generated view typing is not available.
- Do not reuse `SupabaseTableRow<"telegram_sessions">` for browser-facing
  metadata after the safe view exists, because that table type includes
  `token_secret_ref`.

Verification plan for implementation later:

- `rg "telegram_sessions\\?select=\\*" src`
- `rg "token_secret_ref" src`
- `npm exec tsc -- --noEmit`
- `npm run build`
- Static SQL review confirms authenticated users do not have broad
  `telegram_sessions` table select.
- Static SQL review confirms the safe view excludes `token_secret_ref`.
- Browser/dashboard smoke confirms Telegram demo metadata still renders.

Approval points before implementation:

- Schema/RLS approval for grants and safe view.
- Frontend approval to switch the dashboard query to the safe view.
- Type model approval if `KyraDatabase` gains a `Views` section.
- Production rollout approval before applying SQL to a live Supabase project.

Files likely touched later:

- `docs/telegram-integration-plan.md`
- `supabase/schema.sql` or a future migration file
- `src/types/database.ts`
- `src/services/supabaseDashboardService.ts`

Must not be touched yet:

- Do not change schema/RLS.
- Do not apply SQL.
- Do not update dashboard runtime queries.
- Do not write real `token_secret_ref` values.
- Do not wire token storage.
- Do not call Telegram.
- Do not deploy Edge Functions.
- Do not push or publish production changes.

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
