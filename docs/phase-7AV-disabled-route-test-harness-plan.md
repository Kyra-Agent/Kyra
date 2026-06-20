# Phase 7AV Disabled Route Test Harness Plan

Date: 2026-06-20

Status: test harness plan complete. Runtime remains NO-GO and disabled.

Canonical references:

- `docs/product-phase-roadmap.md`
- `docs/phase-7AP-no-go-runtime-freeze-guard.md`
- `docs/phase-7AU-official-oauth-route-implementation-plan.md`
- `docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md`
- `docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md`
- `docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md`

## Objective

Define the disabled-route test harness that must exist before Kyra ever adds
official Base MCP OAuth route skeletons.

This phase is planning and verification only. It does not create Edge
Functions, route skeletons, OAuth handlers, authorization URLs, PKCE values,
state values, cookies, token requests, token storage, MCP sessions, UI
controls, SQL migrations, deploys, or pushes.

## Current Decision

Phase 7D remains NO-GO. Official Base MCP OAuth routes must remain absent.

The only approved work is to define what tests must prove before future route
skeletons can be added behind default-off gates.

## Harness Goal

The future harness must prove that a deployed-but-disabled official MCP route
cannot:

- issue an authorization URL
- generate PKCE verifier material
- generate or persist OAuth state
- set browser-binding cookies
- exchange an authorization code
- persist access or refresh tokens
- initialize MCP sessions
- expose status for unauthorized users
- revoke another owner's binding
- trigger wallet prompts
- sign
- submit transactions
- leak secrets in responses or logs

Disabled behavior must be tested before enabled behavior.

## Future Test Layers

Future implementation must add tests in this order:

| Layer | Required before route skeleton? | Purpose |
| --- | --- | --- |
| Static absence verifier | yes | prove official routes are absent while NO-GO |
| Disabled route contract tests | before deploy | prove route skeletons fail closed with gates off |
| Gate parsing tests | before deploy | prove only exact string `true` enables a gate |
| Request shape tests | before deploy | prove wrong method, missing owner, and public callers fail |
| Secret redaction tests | before deploy | prove no code/state/token/cookie/wallet data leaks |
| Frontend import tests | before deploy | prove no public or Telegram runtime imports routes |
| Owner-only tests | before enablement | prove workspace/agent ownership is revalidated |
| Provider metadata tests | before enablement | prove missing PRM blocks start route |
| Callback replay tests | before enablement | prove one-time state and cookie binding |
| Token persistence tests | before enablement | prove no browser-readable token storage |

No enabled-route test may run before disabled-route tests pass.

## Disabled Route Expected Responses

Future route skeletons, if separately approved later, must return fixed,
sanitized disabled responses while gates are off.

| Route | Disabled status | Disabled result code |
| --- | --- | --- |
| `official-mcp-oauth-start` | 403 | `official_mcp_oauth_start_disabled` |
| `official-mcp-oauth-callback` | 403 | `official_mcp_oauth_callback_disabled` |
| `official-mcp-token-broker` | 403 | `official_mcp_token_broker_disabled` |
| `official-mcp-revoke` | 403 | `official_mcp_revoke_disabled` |
| `official-mcp-status` | 403 | `official_mcp_status_disabled` |

Disabled responses must not include provider URLs, authorization URLs, query
strings, OAuth codes, OAuth state, PKCE values, tokens, credential references,
wallet payloads, calldata, signatures, Telegram bot tokens, or user IDs.

## Gate Parsing Contract

Future gate parsing must satisfy:

- missing environment variable means disabled
- empty string means disabled
- `false` means disabled
- `1` means disabled
- `yes` means disabled
- `TRUE` means disabled
- exact lowercase `true` means enabled
- one enabled gate cannot enable any other gate

Gate parsing must run before request body parsing where possible so disabled
routes do not process sensitive request bodies.

## Request Shape Contract

Future disabled route tests must prove:

- wrong method returns sanitized failure
- missing auth returns sanitized failure
- malformed JSON returns sanitized failure without secret echo
- oversized body returns sanitized failure
- public origin returns sanitized failure
- Telegram caller returns sanitized failure
- callback with code/state still fails closed while disabled
- callback does not log query params
- status/revoke cannot reveal whether a credential exists to unauthorized users

## Secret Redaction Contract

Future harness must inject secret-like values and assert they never appear in
response bodies, thrown errors, logs, activity messages, or owner summaries:

```text
authorization code
oauth state
PKCE verifier
browser-binding nonce
access token
refresh token
credential reference
authorization URL query
provider error body
wallet payload
calldata
signature
transaction raw data
Telegram bot token
Supabase service-role key
```

## Static No-Wiring Checks

While Phase 7C remains NO-GO, automated checks must continue proving:

- no `supabase/functions/official-mcp-oauth-start`
- no `supabase/functions/official-mcp-oauth-callback`
- no `supabase/functions/official-mcp-token-broker`
- no `supabase/functions/official-mcp-revoke`
- no `supabase/functions/official-mcp-status`
- no official OAuth imports in `src`
- no official OAuth imports in Telegram functions
- no official MCP token tables in `supabase/schema.sql`
- `walletExecution` remains `disabled`
- custom bridge rejects `mcp.base.org`

## Future Harness File Plan

When implementation becomes approved, the first code-bearing phase should add
tests before route behavior:

```text
supabase/functions/official-mcp-shared/gates_test.ts
supabase/functions/official-mcp-shared/redaction_test.ts
supabase/functions/official-mcp-oauth-start/index_test.ts
supabase/functions/official-mcp-oauth-callback/index_test.ts
supabase/functions/official-mcp-revoke/index_test.ts
supabase/functions/official-mcp-status/index_test.ts
scripts/check-official-mcp-disabled-routes.mjs
```

Those files are not approved in Phase 7AV. This list is a future sequencing
contract only.

## Phase 7AX Transition Record

After separate explicit owner approval, Phase 7AX implemented the reviewed
disabled-only skeleton and tests. The harness result is `disabled_safe`.

This transition does not approve provider contact, OAuth enablement, token
handling, MCP sessions, wallet authority, signing, transactions, deploy, or
push. The original Phase 7AV absence requirements describe the pre-approval
state; the current repository is governed by the stricter Phase 7AX static
file-boundary and no-wiring checker.

## Pass/Fail Rule

Future disabled-route harness result states:

- `not_applicable`: official route skeletons are still absent
- `blocked`: skeletons exist but disabled tests are missing or failing
- `disabled_safe`: skeletons exist and every disabled-route test passes
- `rejected`: any disabled route issues authorization, token, cookie, MCP,
  wallet, signing, transaction, or secret-bearing output

Only `disabled_safe` may move to a later owner discussion about controlled
enablement. It still does not approve enablement.

## Current Repository Boundary

The repository must remain in this state after Phase 7AV:

- official route skeletons are absent
- disabled-route runtime tests are not yet added
- no authorization URL generator exists
- no PKCE/state/cookie generator exists
- no token broker exists
- no token schema exists
- no official MCP session exists
- no wallet prompt exists
- no signing exists
- no transaction submission exists
- `walletExecution` remains `disabled`

## Implementation Preconditions

No disabled route skeleton may be added until:

1. The owner explicitly approves a code-bearing disabled-route phase.
2. Phase 7C either changes to GO or the owner approves a disabled-only skeleton
   milestone that cannot contact providers.
3. Static no-wiring checks remain green.
4. Test file plan is reviewed.
5. Gate and redaction contracts are reviewed.
6. No deploy or push happens without separate approval.

## Verification

- `npm run check:phase-7av`
- `npm run check:phase-7`
- `npm run build`

## Done Criteria

- Disabled-route harness goals are explicit.
- Future test layers and disabled responses are explicit.
- Gate parsing, request shape, redaction, and no-wiring checks are explicit.
- Future harness file plan is explicit without adding route skeletons.
- Runtime remains NO-GO and disabled.
- No Edge Function, route skeleton, OAuth handler, authorization URL, PKCE,
  state, cookie, token exchange, token storage, MCP session, wallet prompt,
  signing, transaction, SQL migration, deploy, or push occurred.
