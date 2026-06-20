# Phase 7AS Official MCP Token Schema And RLS Blueprint

Date: 2026-06-20

Status: blueprint complete. No SQL is approved or applied.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7B-ownership-rls-write-path-audit.md`
- `docs/phase-7AD-sql-verifier-final-approval-packet.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AQ-owner-wallet-authority-blueprint.md`
- `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`

## Objective

Define the future SQL/RLS boundary for official Base MCP OAuth transactions,
wallet-authority bindings, encrypted credential references, consent packets,
sanitized audit events, and disconnect state before any executable SQL or
runtime token storage exists.

This phase is design-only. It does not create a migration, apply SQL, create
tables, grant privileges, store tokens, create OAuth routes, call official Base
MCP, initialize MCP sessions, show wallet prompts, sign, submit transactions,
deploy, or push.

## Current Decision

Phase 7D remains NO-GO. Phase 7C official Base MCP provider evidence is still
insufficient, so no Base Account connection, official OAuth, token storage,
MCP session, tool invocation, wallet prompt, signing, or transaction runtime is
approved.

## Future Schema Classes

Future executable SQL may propose these classes only after a separate
SQL/RLS approval packet:

| Class | Purpose | Browser-readable? |
| --- | --- | --- |
| OAuth transaction | one-time state, browser binding, PKCE reference, expiry, consumed state | no |
| Wallet authority binding | owner/workspace/agent/Base Account/provider/resource/scope link | owner-summary view only |
| OAuth credential | opaque encrypted token references and token-family lifecycle metadata | no |
| Consent packet | exact scope/resource/tool/value/expiry copy shown to owner | owner-summary view only |
| Token audit event | sanitized lifecycle, refresh, revocation, disconnect, and incident events | owner-summary view only |
| Disconnect tombstone | revocation result and blocked refresh/session state | owner-summary view only |

No public table or public view may expose these classes.

## Forbidden Columns

Future schema must never include browser-readable columns for:

- raw authorization code
- raw PKCE verifier
- raw OAuth state
- raw browser-binding nonce
- access token
- refresh token
- token endpoint response body
- provider error body
- MCP session secret
- raw MCP tool payload
- raw calldata
- wallet signature
- private key
- seed phrase
- Telegram bot token
- Telegram token secret reference
- Supabase service-role key
- provider API key

If encrypted token ciphertext or secret references are needed, they must live
behind a service-role-only backend boundary and must never be selected through
owner-facing views.

## Required Ownership Binding

Every future private row must bind to:

```text
owner_user_id
workspace_id
agent_id
provider_id
issuer
resource
scope_set_hash
consent_packet_version
```

Rows that can affect wallet authority must also bind to one Base Account
identity label or opaque provider account reference. The label must be safe for
owner display and must not be usable as a signing secret.

No row may be reusable across owners, workspaces, agents, providers,
resources, scopes, or Telegram sessions.

## RLS Policy Requirements

Future executable SQL must satisfy all of these rules:

- RLS enabled on every table.
- `anon` has no table or view access.
- `authenticated` has no direct `insert`, `update`, or `delete` grants.
- `authenticated` can select only from owner-summary views after RLS review.
- Owner reads must use `public.owns_workspace(workspace_id)` or a stricter
  equivalent owner join.
- Secret-bearing tables have no browser-readable policies.
- Service-role writes happen only through reviewed Edge Functions or RPC.
- Deletes are avoided for lifecycle rows; use revocation/tombstone timestamps
  unless a retention deletion has separate approval.
- Views must be `security_invoker = true`.
- Verifier SQL must return booleans only, never rows.

## Owner Summary Views

Future owner-facing views may expose only:

- binding status
- provider display name
- issuer label
- resource label
- scope labels
- consent packet version
- created timestamp
- expiry timestamp
- revoked timestamp
- disconnect status
- sanitized result code
- latest safe audit event kind

Owner-facing views must not expose credential refs, token family IDs, PKCE
refs, state hashes, nonce hashes, provider raw payloads, wallet payloads,
calldata, signatures, transaction raw data, Telegram token refs, or internal
request headers.

## Grant Lockdown

Future SQL must start with explicit revoke statements:

```text
revoke all privileges on every official_mcp_* table from public, anon, authenticated;
revoke all privileges on every official_mcp_* view from public, anon;
```

Only after RLS and view column review may `authenticated` receive select on
specific owner-summary views. Direct table writes by browser clients remain
forbidden.

## Integrity Constraints

Future executable SQL must include constraints for:

- one active binding per owner/workspace/agent/provider/resource/scope set
- one active OAuth transaction per owner/workspace/agent/provider at a time
- OAuth transaction expiry no longer than five minutes
- consumed OAuth transaction cannot become unconsumed
- revoked credential cannot be refreshed
- stale rotation version cannot become current
- token family reuse marks the family revoked
- consent packet version is immutable after approval
- disconnect tombstone blocks refresh and MCP session reuse

## Verifier Requirements

Any future SQL packet must include a boolean-only verifier with at least:

```text
tables_exist
rls_enabled
anon_denied
authenticated_direct_table_denied
authenticated_owner_views_limited
service_role_write_path_present
secret_columns_absent_from_views
security_invoker_views
unique_binding_constraints_present
oauth_transaction_ttl_constraint_present
revoked_credentials_cannot_refresh
token_family_reuse_revokes_family
boolean_only_output
```

Any false value keeps the target blocked.

## Public, Telegram, And LLM Boundary

Future official MCP schema must not be reachable from:

- public agent pages
- public profile APIs
- Telegram webhook commands
- Telegram natural-language messages
- Telegram connect/link functions
- LLM prompts
- analytics
- unauthenticated routes

Telegram may only receive sanitized refusal or owner-dashboard handoff copy.
It must never receive a token reference, wallet authority binding ID, consent
packet payload, provider payload, approval link, calldata, signature, or
transaction raw data.

## Approval Preconditions

Executable SQL may be drafted only after:

1. Phase 7C changes from NO-GO to GO.
2. The owner explicitly approves moving toward Phase 7D/7E.
3. Provider metadata, resource, issuer, scope, and tool authority are verified.
4. Phase 7AQ binding contract remains current.
5. Phase 7AR token lifecycle contract remains current.
6. SQL forward, rollback, and boolean verifier packets are written separately.
7. RLS policies and grants are reviewed before any target apply.
8. Target project, operator, apply window, rollback window, and gate-off proof
   are captured in a separate approval packet.

## Current Repository Boundary

The repository must remain in this state after Phase 7AS:

- no executable official MCP token schema
- no `official_mcp_credentials` table in `supabase/schema.sql`
- no official MCP OAuth start/callback Edge Function
- no official MCP token broker
- no official MCP refresh or revoke function
- no official MCP session or tool runtime
- no frontend token view
- no Telegram token authority path
- `walletExecution` remains `disabled`
- custom bridge still rejects `mcp.base.org`

## Verification

- `npm run check:phase-7as`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Future schema classes are explicit.
- Forbidden columns are explicit.
- Ownership binding and RLS policy requirements are explicit.
- Owner-summary view limits are explicit.
- Grant lockdown and verifier requirements are explicit.
- Public, Telegram, and LLM boundaries are explicit.
- No executable SQL, migration, table, token storage, OAuth route, MCP runtime,
  wallet prompt, signing, transaction, deploy, or push occurred.
