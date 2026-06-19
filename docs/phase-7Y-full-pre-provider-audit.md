# Phase 7Y Full Pre-Provider Audit

Date: 2026-06-19

Status: local full pre-provider audit complete.

Current decision: provider selection blocked until a separate sandbox packet is
created and approved.

No provider is approved. No target Supabase rate-limit SQL has been applied. No
redacted owner approval packet has been filled. No smoke window is approved.
`KYRA_BASE_MCP_PREP_ENABLED` remains off. Wallet prompts, signing, Telegram
execution, swaps, transfers, contract calls, prepared-action production writes,
provider calls, and transaction submission remain disabled.

## Audit Objective

This audit checks whether Phase 7 can safely move from internal pre-smoke
hardening toward provider selection.

It does not select a provider, contact a provider, apply SQL, enable a runtime
gate, run a smoke, open a wallet prompt, create a Telegram execution path, or
submit a transaction.

## Evidence Reviewed

- Phase 7A through Phase 7X documents and check scripts.
- Base MCP Edge Function runtime, dependencies, provider adapter, provider
  contract, rate-limit boundary, and tests.
- Owner dashboard Base MCP caller and browser response parsing.
- Public agent route.
- Telegram webhook runtime and execution gate.
- Wallet provider boundary and runtime provider mount.
- Prepared-action types and storage wiring boundary.
- Official Base MCP OAuth decision and blocked scope evidence.
- README public product claims.

## Audit Matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Runtime gate | Base MCP prep gate enables only on the exact reviewed enabled value | pass |
| Disabled path | `base-mcp-prepare` returns disabled before bearer, body, ownership, adapter | pass |
| Dashboard trigger | Owner dashboard click only, fresh session before request | pass |
| Public route | Public agent profile has no Base MCP function trigger | pass |
| Telegram route | Telegram webhook has no Base MCP function trigger | pass |
| Wallet boundary | Wallet runtime providers are not mounted while execution is disabled | pass |
| Signing surface | Frontend has no live signing or transaction submission hook usage | pass |
| Provider payload | Provider request excludes owner, workspace, agent, wallet, Telegram, Supabase, calldata, and transaction data | pass |
| Provider contract | `kyra_status_v1` requires exact request id binding and bounded response | pass |
| Prepared-action storage | Storage adapter exists but runtime dependencies do not wire production writes | pass |
| Rate limit | Service-role rate limiter exists, but target SQL remains review-only | pass |
| Official MCP | OAuth registration, token storage, sessions, tool calls, and wallet scopes remain blocked | pass |
| Documentation | README and Phase 7 docs do not claim live execution | pass |
| Secrets | Decision files are suitable for secret scan before commit | pass |

## Findings

No critical finding was identified in the current local source audit.

The current code remains blocked as intended:

- No production provider is approved.
- No provider endpoint is selected.
- No target Supabase SQL has been applied.
- No target verifier evidence exists.
- No owner smoke approval packet is filled.
- No smoke window is approved.
- No runtime gate is approved for enablement.

These are expected blockers, not defects.

## Runtime Gate Review

The Base MCP preparation function is still guarded by an exact runtime gate:

- Only the exact reviewed enabled value enables the runtime.
- Disabled runtime returns a bounded disabled response before bearer auth,
  body read, session validation, ownership lookup, rate limit, provider call, or
  storage write.
- Enabled runtime still requires HTTPS endpoint normalization, exact
  `kyra_status_v1` protocol, owner auth, ownership lookup, request freshness,
  rate limiting, and bounded adapter response validation.
- `mcp.base.org` is rejected from the custom bridge endpoint normalizer.

## Dashboard Caller Review

The browser caller remains owner-scoped and read-only:

- Button requires an authenticated session and a selected owner dashboard agent.
- Handler refreshes the session before calling the Edge Function.
- Request action is exactly `base_mcp_status_check`.
- Request chain is exactly `base`.
- Request mode is exactly `read_only`.
- Response parser accepts only read-only summary shape with null
  `opaquePayloadRef`.
- Successful preview copy states no wallet approval, no storage write, no
  signing, and no transaction submission.

## Telegram And Public Route Review

Telegram and public routes remain isolated:

- Telegram execution gate keeps `canExecuteFromTelegram: false`.
- Telegram execution gate keeps `canCreateDraftNow: false`.
- Telegram runtime does not call `base-mcp-prepare`.
- Telegram runtime does not create Base MCP requests, prepared-action writes,
  wallet prompts, signatures, or transaction submissions.
- Public agent route does not call `base-mcp-prepare`.
- Public profile copy remains non-executing.

## Wallet And Signing Review

Wallet execution remains gated:

- `appConfig.integrations.walletExecution` is `disabled`.
- `WalletProviderBoundary` returns children without mounting wallet runtime
  providers while execution is disabled.
- Wallet runtime providers are isolated behind the boundary.
- Frontend source has no live `useSendTransaction`, `useWriteContract`,
  `sendTransaction`, `writeContract`, `signMessage`, or `signTypedData` call
  path.

## Prepared-Action Storage Review

Prepared-action production writes remain blocked:

- Prepared-action kind remains limited to `base_mcp_status_check`.
- Prepared-action private draft type forbids wallet address and Telegram token
  ref fields.
- Runtime dependency factory does not wire `storePreparedActionSummary`.
- Review SQL remains review-only until separately approved.
- No public route exposes prepared-action sensitive data.

## Provider Privacy Review

Provider payload remains minimal:

- Sent fields are action kind, protocol, chain, mode, request id, and requested
  timestamp.
- Provider request does not include owner id, workspace id, agent id, wallet
  data, Telegram token refs, Supabase sessions, service-role keys, token
  amounts, recipients, calldata, signatures, or transaction hashes.
- Provider response is parsed through exact contract validation and does not
  surface raw provider bodies.

## Residual Risk

These risks remain intentionally unresolved until later approval:

- Production environment values cannot be proven from local source alone.
- Target Supabase verifier evidence cannot exist before target SQL approval.
- A real provider cannot be trusted until a dossier, contract evidence, and
  redacted approval packet are complete.
- Netlify deployment should remain batched to avoid unnecessary credit usage.

## Decision

Phase 7Y is locally green for audit completeness.

Provider selection remains blocked until Phase 7Z creates a provider selection
sandbox that evaluates candidates without credentials, network calls, SQL
application, runtime gate enablement, wallet prompts, Telegram execution, or
transaction submission.

## Done Criteria

- Full pre-provider audit exists.
- Audit explicitly reviews runtime, dashboard, public route, Telegram route,
  wallet boundary, signing surface, prepared-action storage, provider payload,
  official OAuth, docs, and secrets.
- Audit states no critical finding in local source.
- Audit preserves the blocked provider-selection decision.
- Audit identifies expected blockers.
- Audit keeps SQL application, provider calls, runtime gate enablement, wallet
  prompts, signing, Telegram execution, swaps, transfers, contract calls,
  prepared-action production writes, and transaction submission disabled.
