# Phase 7AW Disabled-Only Route Skeleton Approval Packet

Date: 2026-06-20

Status: owner approval recorded for local disabled-only skeleton work.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AU-official-oauth-route-implementation-plan.md`
- `docs/phase-7AV-disabled-route-test-harness-plan.md`

## Objective

Define the exact approval boundary for a future code-bearing, disabled-only
official Base MCP OAuth route skeleton milestone.

This phase is documentation and verification only. It does not create Edge
Functions, shared route code, tests, provider calls, OAuth metadata requests,
authorization URLs, PKCE values, OAuth state, cookies, token requests, token
storage, MCP sessions, frontend controls, wallet prompts, signing, transaction
submission, deploys, or pushes.

## Current Decision

Approval state: `owner_approved_disabled_skeleton`.

The owner explicitly approved Phase 7AX local disabled-only skeleton work on
2026-06-20.

It does not mean:

- provider contact is approved
- OAuth is approved
- token handling is approved
- Base Account connection is approved
- deploy or push is approved

Phase 7C remains NO-GO. Official Base MCP runtime authority remains blocked.

## Approval Result States

| State | Meaning |
| --- | --- |
| `blocked` | Required contracts or repository guards are incomplete |
| `rejected` | The proposed skeleton could contact providers, process secrets, or enable authority |
| `ready_to_request_owner_skeleton_approval` | Disabled-only scope is documented and may be presented for owner approval |
| `owner_approved_disabled_skeleton` | Owner explicitly approved local disabled-only skeleton code and tests |

The approval is limited to the exact local file boundary and fail-closed
behavior in this packet. It does not carry forward to enablement, deployment,
provider calls, token handling, or wallet authority.

## Exact Future Scope

If the owner later gives explicit approval, the milestone may add only:

- shared exact-`true` gate parsing
- shared fixed disabled response helpers
- shared response and log redaction helpers
- disabled-only route entry points
- disabled-route tests
- static no-wiring checks

Every route must evaluate its own gate independently and return its fixed
sanitized 403 response while disabled.

The future skeleton must remain incapable of:

- contacting `mcp.base.org` or another provider
- reading provider OAuth metadata
- constructing authorization URLs
- generating PKCE, OAuth state, or browser-binding values
- reading callback query parameters for business logic
- exchanging authorization codes
- storing or refreshing tokens
- creating MCP sessions
- discovering or invoking tools
- opening Base Account or wallet UI
- preparing calldata
- requesting signatures
- submitting transactions

## Future Allowed File Boundary

Only after `owner_approved_disabled_skeleton`, the first local code-bearing
milestone may propose these files:

```text
supabase/functions/official-mcp-shared/gates.ts
supabase/functions/official-mcp-shared/redaction.ts
supabase/functions/official-mcp-shared/disabled-response.ts
supabase/functions/official-mcp-shared/gates_test.ts
supabase/functions/official-mcp-shared/redaction_test.ts
supabase/functions/official-mcp-oauth-start/index.ts
supabase/functions/official-mcp-oauth-start/index_test.ts
supabase/functions/official-mcp-oauth-callback/index.ts
supabase/functions/official-mcp-oauth-callback/index_test.ts
supabase/functions/official-mcp-token-broker/index.ts
supabase/functions/official-mcp-token-broker/index_test.ts
supabase/functions/official-mcp-revoke/index.ts
supabase/functions/official-mcp-revoke/index_test.ts
supabase/functions/official-mcp-status/index.ts
supabase/functions/official-mcp-status/index_test.ts
scripts/check-official-mcp-disabled-routes.mjs
```

The list is the approved Phase 7AX local file boundary. It is not permission to
add other runtime files or enable any route.

No SQL migration, schema table, frontend component, provider client, wallet
provider change, Telegram handler, public-agent handler, deployment config, or
production secret may be added in that milestone.

## Fixed Disabled Contract

Future disabled-only route skeletons must return:

| Route | HTTP | Result code |
| --- | --- | --- |
| `official-mcp-oauth-start` | 403 | `official_mcp_oauth_start_disabled` |
| `official-mcp-oauth-callback` | 403 | `official_mcp_oauth_callback_disabled` |
| `official-mcp-token-broker` | 403 | `official_mcp_token_broker_disabled` |
| `official-mcp-revoke` | 403 | `official_mcp_revoke_disabled` |
| `official-mcp-status` | 403 | `official_mcp_status_disabled` |

Responses must be deterministic and must not reveal request data, owner data,
workspace data, agent data, provider URLs, OAuth data, token state, wallet
state, Telegram bot tokens, Supabase secrets, or whether a credential exists.

## Test-First Order

After explicit owner approval, implementation order must be:

1. Add static absence and forbidden-import checks.
2. Add gate parsing tests.
3. Add redaction tests.
4. Add disabled response tests for each route.
5. Add the minimum route files required to satisfy those tests.
6. Run Phase 7, build, privacy, and function checks.
7. Review the local diff and secret scan.
8. Commit locally only.
9. Request separate approval before push or deploy.

No enabled-path test or provider simulation belongs in this milestone.

## Mandatory Gates

Each future route requires its own environment variable:

- `KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED`
- `KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED`
- `KYRA_OFFICIAL_MCP_TOKEN_BROKER_ENABLED`
- `KYRA_OFFICIAL_MCP_REVOKE_ENABLED`
- `KYRA_OFFICIAL_MCP_STATUS_ENABLED`

Only the exact lowercase string `true` may evaluate as enabled. Missing, empty,
`false`, `1`, `yes`, and `TRUE` must remain disabled.

Adding these names to code does not approve setting them to `true` anywhere.
The disabled-only milestone must not add the variables to production
configuration or deployment secrets.

## Forbidden Changes

The future disabled-only milestone must be rejected if it includes:

- `fetch` or HTTP calls to an OAuth or MCP provider
- OAuth discovery or protected-resource metadata calls
- authorization endpoint or token endpoint logic
- PKCE, state, nonce, cookie, or callback processing logic
- token encryption, persistence, refresh, or revocation calls
- official MCP database tables or migrations
- MCP client or session initialization
- tool discovery or invocation
- frontend connect, authorize, disconnect, or status controls
- Telegram or public route imports
- wallet connector changes
- wallet prompts, signing, calldata, or transaction submission
- production gate enablement
- deploy or push without separate approval

## Security And Privacy Rule

User wallet authority and user Telegram bot-token privacy remain the highest
priority.

The disabled-only skeleton must process no wallet authority, expose no owner
identity, and read no Telegram bot token. Logs and responses must remain
sanitized even for malformed or secret-bearing requests.

## Rollback Rule

If any local skeleton test fails, any forbidden import appears, any provider
call appears, or a response contains sensitive data:

1. Stop the milestone.
2. Do not commit, push, deploy, or enable gates.
3. Remove only the uncommitted skeleton changes from that milestone.
4. Re-run the static freeze and privacy checks.
5. Record the failure before requesting a new approval.

Existing unrelated owner work must never be reverted.

## Approval Preconditions Verified Before Phase 7AX

Before recording `owner_approved_disabled_skeleton`, the following were
verified:

1. Phase 7C is still explicitly NO-GO.
2. All official route paths were absent before Phase 7AX implementation.
3. `walletExecution` remains hardcoded `disabled`.
4. The custom bridge still rejects `mcp.base.org`.
5. No official MCP token schema exists.
6. The exact future file list is reviewed.
7. The fixed disabled responses are reviewed.
8. Test-first order and rollback rules are reviewed.
9. The owner understands that approval permits local disabled code only.

## Current Repository Boundary

After the recorded owner approval and Phase 7AX implementation:

- reviewed official OAuth route skeletons exist locally
- disabled-route runtime tests exist locally
- no official provider call exists
- no OAuth authorization or callback runtime exists
- no token storage schema exists
- no official MCP session exists
- no frontend or Telegram wiring exists
- wallet execution remains disabled
- signing and transaction submission remain disabled
- no deploy or push occurred

## Verification

- `npm run check:phase-7aw`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- The future disabled-only code scope is explicit.
- The future allowed file boundary is explicit.
- Fixed disabled result codes and gates are explicit.
- Test-first, privacy, rollback, and approval rules are explicit.
- Current state is `owner_approved_disabled_skeleton`.
- Code-bearing skeleton approval is recorded only for the exact Phase 7AX local
  disabled-only file boundary.
- Runtime remains NO-GO and disabled.
- No route, test harness runtime, provider call, OAuth flow, token handling,
  MCP session, wallet prompt, signing, transaction, deploy, or push occurred.
