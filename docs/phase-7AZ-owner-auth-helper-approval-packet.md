# Phase 7AZ Owner Auth Helper Approval Packet

Date: 2026-06-20

Status: approval packet complete. Auth helper code is not approved.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7B-ownership-rls-write-path-audit.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AX-disabled-only-route-skeleton.md`
- `docs/phase-7AY-owner-authentication-boundary-packet.md`

## Objective

Define the exact code-bearing boundary for future local owner-authentication
and owner/workspace/agent ownership helpers.

This phase is documentation and verification only. It does not create auth
helpers, ownership helpers, Supabase clients, route imports, request parsing,
callback state, cookies, route configuration, provider calls, OAuth
processing, token handling, frontend wiring, Telegram wiring, wallet prompts,
signing, transactions, deploys, or pushes.

## Current Decision

Approval state: `ready_to_request_owner_auth_helper_approval`.

This means the helper API, error policy, dependency boundary, test matrix,
file boundary, rollback rules, and no-route-integration rule are defined well
enough for a separate explicit code-bearing approval.

It does not approve:

- helper implementation
- route integration
- Supabase function configuration
- provider contact
- OAuth processing
- token storage
- Base Account connection
- wallet prompts
- signing
- transactions
- deploy or push

Phase 7C remains NO-GO. Phase 7AX routes remain `disabled_safe`.

## Approval Result States

| State | Meaning |
| --- | --- |
| `blocked` | Helper API, errors, or test boundary is incomplete |
| `rejected` | Proposed helper trusts caller identity, leaks ownership, or opens route behavior |
| `ready_to_request_owner_auth_helper_approval` | Local helper-only scope is documented |
| `owner_approved_auth_helpers` | Owner explicitly approved local helper code and tests only |

No general continuation, prior phase approval, or route-skeleton approval may
be treated as `owner_approved_auth_helpers`.

## Future Allowed File Boundary

Only after separate `owner_approved_auth_helpers`, the local helper milestone
may add:

```text
supabase/functions/official-mcp-shared/owner-auth.ts
supabase/functions/official-mcp-shared/owner-auth_test.ts
supabase/functions/official-mcp-shared/ownership.ts
supabase/functions/official-mcp-shared/ownership_test.ts
scripts/check-official-mcp-owner-auth-boundary.mjs
```

The list is an approval boundary, not permission to create the files.

No existing route file, frontend file, Telegram file, schema, SQL review,
Supabase config, environment example, wallet provider, or deployment config may
change in the helper-only milestone.

## Helper Architecture

The future helpers must be pure dependency-bound modules.

They must not:

- read `Deno.env`
- import a Supabase client library
- create anon or service-role clients
- read request bodies or query parameters
- contact providers
- store sessions, state, cookies, tokens, or credentials
- log bearer authorization
- return raw database rows
- import route entry points

Client creation, environment access, and request parsing belong to separately
approved route dependency layers.

## Future Owner Auth API

The future `owner-auth.ts` may expose only reviewed equivalents of:

```ts
interface OfficialMcpOwnerAuthDependencies {
  getUser: (authorization: string) => Promise<unknown>;
}

interface OfficialMcpAuthenticatedOwner {
  ownerUserId: string;
}

function readOfficialMcpBearerAuthorization(request: Request): string;

async function authenticateOfficialMcpOwner(
  authorization: string,
  dependencies: OfficialMcpOwnerAuthDependencies,
): Promise<OfficialMcpAuthenticatedOwner>;
```

Required behavior:

- missing or malformed bearer produces fixed sanitized 401
- `getUser` rejection produces fixed sanitized 401
- missing, blank, or malformed user ID produces fixed sanitized 401
- returned binding contains only normalized `ownerUserId`
- authorization is never returned, persisted, or logged
- dependency errors are not reflected to the caller

The helper may validate authentication data passed to it. It must not decide
route method, CORS, body shape, ownership, OAuth state, or wallet authority.

## Future Ownership API

The future `ownership.ts` may expose only reviewed equivalents of:

```ts
interface OfficialMcpOwnershipLookup {
  lookupAgent: (agentId: string) => Promise<{
    agentId: string;
    workspaceId: string;
  } | null>;
  lookupWorkspace: (workspaceId: string) => Promise<{
    workspaceId: string;
    ownerUserId: string;
  } | null>;
}

interface OfficialMcpOwnerAgentBinding {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
}

async function resolveOfficialMcpOwnerAgentBinding(
  input: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
  },
  lookup: OfficialMcpOwnershipLookup,
): Promise<OfficialMcpOwnerAgentBinding>;
```

The implementation may use a structurally equivalent API if tests preserve all
security properties.

## Identifier Contract

Before database access, helpers must validate:

- `ownerUserId` is a canonical UUID
- `workspaceId` is a canonical UUID
- `agentId` is a canonical UUID
- values contain no whitespace or alternate representation

The ownership helper must:

1. Look up the exact `agentId`.
2. Require the returned agent ID to match.
3. Require the returned agent workspace ID to match `workspaceId`.
4. Look up that exact workspace.
5. Require the returned workspace ID to match.
6. Require workspace owner ID to match authenticated `ownerUserId`.
7. Return a normalized binding only after every check succeeds.

The browser must never supply an owner ID to this helper. A separately approved
route layer must pass the owner ID returned by `authenticateOfficialMcpOwner`.

## Enumeration Decision

External policy: fixed sanitized 404 for every inaccessible binding.

The same external error must cover:

- missing agent
- missing workspace
- owner mismatch
- agent/workspace mismatch
- malformed lookup result
- duplicate or ambiguous lookup result

The fixed response meaning is only: `requested_binding_not_found`.

Database availability failures remain fixed sanitized 500. They must not expose
table names, columns, IDs, SQL, Supabase details, service-role state, or whether
one half of the binding existed.

## Error Model

Future helpers may throw a local typed error containing only:

```text
status
code
safeMessage
```

Allowed external codes:

- `unauthorized`
- `requested_binding_not_found`
- `server_error`

Forbidden error data:

- bearer authorization
- JWT claims
- owner ID
- workspace ID
- agent ID
- raw database result
- table or column name
- service-role key
- Telegram bot token
- OAuth code/state/PKCE
- token or credential reference
- wallet address or payload

## Test-First Order

After separate explicit owner approval:

1. Add owner-auth tests.
2. Add the minimum owner-auth helper to pass them.
3. Add ownership tests.
4. Add the minimum ownership helper to pass them.
5. Add the static auth-boundary checker.
6. Confirm no route imports either helper.
7. Run helper tests, Phase 7 checks, privacy checks, function checks, and build.
8. Review secret scan and local diff.
9. Commit locally only.
10. Request separate approval before route integration, push, or deploy.

## Required Owner Auth Tests

Tests must prove:

- missing authorization fails 401
- Basic, empty Bearer, whitespace-only Bearer, and malformed schemes fail 401
- bearer parsing is case-insensitive only for the `Bearer` scheme
- raw authorization never appears in errors
- `getUser` is not called for malformed authorization
- `getUser` rejection fails sanitized 401
- null, array, blank ID, non-string ID, and malformed UUID user objects fail
- valid user returns exactly one canonical owner ID
- no environment, database, provider, token, wallet, or Telegram dependency is
  present

## Required Ownership Tests

Tests must prove:

- malformed owner/workspace/agent ID fails before lookup
- lookup order is agent then workspace
- exact IDs are passed to lookup dependencies
- missing agent and missing workspace return identical external 404
- cross-owner access returns the same external 404
- agent/workspace mismatch returns the same external 404
- unexpected returned IDs fail closed
- database errors return sanitized 500
- raw records and identifiers never appear in errors
- successful result returns only owner/workspace/agent IDs
- no route, provider, token, wallet, or Telegram dependency is present

## Static No-Integration Checks

The helper-only milestone must prove:

- none of the five official MCP route files imports `owner-auth.ts`
- none of the five route files imports `ownership.ts`
- route request bodies and query parameters remain unread
- fixed 403/503 Phase 7AX responses remain unchanged
- `supabase/config.toml` still has no official MCP route sections
- frontend and Telegram have no official MCP route wiring
- official MCP token schema remains absent
- `walletExecution` remains `disabled`
- refresh-token and MCP-tool functions remain absent

## Forbidden Changes

Reject the helper milestone if it includes:

- route imports or route behavior changes
- environment reads
- Supabase client construction
- service-role key reads
- auth cookies
- OAuth state or callback logic
- CORS policy implementation
- database writes
- schema or SQL changes
- provider or network calls
- token encryption, storage, refresh, or revocation
- MCP initialization or tools
- frontend or Telegram wiring
- wallet prompts, signing, calldata, or transactions
- production configuration
- deploy or push

## Security And Privacy Rule

User wallet authority and user Telegram bot-token privacy remain the highest
priority.

The helper layer must never receive Telegram bot tokens, Base Account secrets,
OAuth credentials, wallet signing payloads, or transaction data. Authentication
and ownership helpers establish identity only; they grant no wallet or provider
authority.

## Rollback Rule

If a helper test fails, a route import appears, an identifier leaks, a
service-role read appears, or any forbidden dependency is introduced:

1. Stop the helper milestone.
2. Do not integrate routes, commit, push, deploy, or enable gates.
3. Remove only the uncommitted helper milestone changes.
4. Re-run Phase 7AX and privacy checks.
5. Record the failure before requesting a new approval.

Existing unrelated owner work must never be reverted.

## Approval Preconditions

Before requesting `owner_approved_auth_helpers`, verify:

1. Phase 7C remains NO-GO.
2. Phase 7AX remains `disabled_safe`.
3. Phase 7AY remains `owner_auth_contract_defined`.
4. The five-file helper boundary is reviewed.
5. Fixed 404 enumeration policy is reviewed.
6. Pure dependency injection and no-environment rules are reviewed.
7. Test-first and rollback rules are reviewed.
8. The owner understands helper approval does not permit route integration.

## Current Repository Boundary

After Phase 7AZ:

- owner-auth and ownership helper files remain absent
- Phase 7AX routes remain unchanged and `disabled_safe`
- no route processes identity, body, or query data
- no official route configuration exists
- no provider, OAuth, token, MCP, wallet, signing, or transaction path exists
- no frontend or Telegram wiring exists
- no deploy or push occurred

## Verification

- `npm run check:phase-7az`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Helper file boundary and APIs are explicit.
- Dependency injection and environment boundaries are explicit.
- Fixed 404 enumeration and sanitized 500 policies are explicit.
- Test-first and no-route-integration rules are explicit.
- Current state is `ready_to_request_owner_auth_helper_approval`.
- Helper code still requires separate explicit owner approval.
- Runtime remains NO-GO and `disabled_safe`.
- No helper, route integration, request parsing, auth processing, ownership
  lookup, provider call, OAuth processing, token handling, MCP session, wallet
  prompt, signing, transaction, deploy, or push occurred.
