# Phase 7 Pre-Execution Audit

Date: 2026-06-19

Canonical roadmap:

- `docs/product-phase-roadmap.md`

Status: Phase 7AJ controlled read-only Base status smoke complete. The
Kyra-operated provider bridge, owner-dashboard caller, exact protocol gate, and
service-role rate-limit contract passed production verification. The runtime
gate is disabled after closeout. No production wallet prompt,
prepared-action write, signing, swap, transfer, contract call, Telegram
execution, or transaction submission is enabled.
Phase 7AK adds a transition gate that blocks official MCP OAuth, token storage,
tool discovery, and provider approval links while Phase 7C remains no-go.
Base Account connection is an independent primary lane; prepared actions,
signing, and submission remain protected by their own gates. Phase 7D
owner-click Base Account connection is live and non-transactional. Phase 7E
prompt/signing eligibility is implemented as a fail-closed guard while runtime
signing remains disabled.

Phase status: security audit and custom read-only infrastructure proof are
complete. Official Base MCP live execution is not complete.

## Objective

Phase 7 moves Kyra from a hardened non-executing foundation toward one narrow
live execution candidate, but only after a full security and ownership audit.

The first goal is not speed. The first goal is proving that no execution path can
touch a user wallet, Telegram token, prepared-action record, Base MCP runtime,
or transaction submission path without explicit owner approval and a reviewed
gate.

The Phase 7 product goal is not the custom status bridge. The goal is one
selected deployed agent using the owner's Base Account through Kyra's bounded
prepared-action adapter, with separate Kyra and Base Account approvals,
followed by a sanitized transaction result. Official hosted MCP is an optional
future adapter.

## Crown Jewels

These remain the highest-priority assets:

- User wallet security.
- User Telegram bot token security.
- Owner workspace boundaries.
- Prepared-action ownership and replay protection.
- Transaction submission integrity.
- Sanitized logs and user-facing errors.

If a product shortcut conflicts with any of these, the shortcut loses.

## Phase 7 Entry State

Phase 6 is closed as a hardened foundation:

- Telegram + LLM read-only replies are live.
- Telegram execution requests are refused.
- Wallet/Base readiness and review surfaces exist.
- Base MCP preparation remains backend-only. Phase 7J wires only the read-only
  status provider adapter behind exact runtime gate, HTTPS endpoint, owner auth,
  ownership lookup, and request freshness.
- Prepared-action storage SQL remains review-only.
- Wallet provider dependencies are installed but runtime-gated.
- Wallet prompt/signing/submission paths are not enabled.
- Owner dashboard sensitive reads are column-scoped.
- Activity log messages are sanitized before backend writes and dashboard
  display.

## Non-Negotiable Gates

Do not enable any of these until the matching audit packet, verifier, rollback,
and owner approval are complete:

- Prepared-action SQL in production.
- Base MCP runtime adapter calls.
- Prepared-action storage writes.
- Wallet connect prompts.
- Wallet signing.
- Transaction submission.
- Telegram-created approval drafts.
- Telegram-triggered execution.
- Arbitrary swaps, transfers, or contract calls.
- Public viewer-triggered actions.

## Audit Scope

### 7A - Entry Lock And Source Audit

- Confirm Phase 6 check suite still passes.
- Confirm public docs do not overclaim execution.
- Confirm source-of-truth context says Phase 7 starts with audit.
- Confirm no public route exposes wallet, approval, prepared-action, Telegram
  token, or transaction-sensitive fields.
- Confirm dashboard owner reads stay column-scoped.

### 7B - Ownership, RLS, And Write Path Audit

- Audit packet: `docs/phase-7B-ownership-rls-write-path-audit.md`.
- Review every write path that could create, update, or resolve execution
  records.
- Confirm writes require authenticated owner context or service-role backend
  mediation.
- Confirm wrong-owner access fails closed.
- Confirm anon access has no sensitive table privileges.
- Confirm verifier SQL returns booleans only and no row data.
- Confirm rollback SQL is reviewed before any forward SQL is applied.

### 7C - Base MCP Runtime Audit

- Audit packet: `docs/phase-7C-base-mcp-runtime-audit.md`.
- Keep `base-mcp-prepare` disabled until runtime config, provider endpoint,
  request signing, ownership, replay, rate limits, and failure sanitization are
  reviewed together.
- Keep provider adapter read-only for the first runtime smoke.
- Do not send owner, workspace, agent, wallet, token, or secret scope to the
  provider.
- Do not return raw provider payloads, calldata, token approvals, or transaction
  hashes.

### 7D - Prepared Action Storage Audit

- Audit packet: `docs/phase-7D-prepared-action-storage-approval.md`.
- Apply no storage SQL until forward, rollback, verifier, RLS, column grants,
  idempotency, expiry, replay protection, and owner-summary view are approved.
- Store only bounded owner-summary fields.
- Do not store wallet addresses, raw calldata, private keys, seed phrases,
  Telegram token refs, raw provider payloads, API keys, or transaction hashes.
- Keep public profiles free of prepared-action data.

### 7E - Wallet Prompt And Signing Audit

- Audit packet: `docs/phase-7E-wallet-prompt-signing-audit.md`.
- Wallet prompts must be user-initiated from the owner dashboard.
- No prompt opens on page load, public pages, Telegram messages, or background
  effects.
- The first signable action must be a separately reviewed action kind, not
  `base_mcp_status_check`.
- User rejection must not create a transaction hash.
- Network mismatch must fail safely before signing.
- The connected wallet pays gas.
- Phase 7E now includes the deterministic
  `src/types/walletPromptEligibility.ts` guard and dashboard signing-boundary
  evidence. The guard keeps prompts blocked while wallet execution,
  prepared-action review, risk review, owner approval, and unsigned handoff
  gates are incomplete.

### 7F - Telegram Execution Boundary Audit

- Audit packet: `docs/phase-7F-telegram-execution-boundary-audit.md`.
- Telegram remains read-only until the dashboard/wallet path is live and
  reviewed.
- `canExecuteFromTelegram` remains `false`.
- `canCreateDraftNow` remains `false`.
- Telegram can classify unsafe intent but must not create approval records,
  prepared actions, wallet prompts, Base MCP calls, signatures, or transaction
  submissions.
- Telegram bot tokens remain backend-only.

### 7G - Logs, Errors, And Observability Audit

- Audit packet: `docs/phase-7G-logs-errors-observability-audit.md`.
- Runtime Edge Functions do not use raw `console.*` logging without reviewed
  sanitization.
- Provider, wallet, MCP, Telegram, and backend errors collapse to sanitized
  user-facing messages.
- Activity logs stay bounded and sanitized.
- No logs include bot tokens, wallet secrets, raw payloads, calldata, API keys,
  transaction signing payloads, or unredacted user identifiers.

### 7H - Release And Rollback Audit

- Audit packet: `docs/phase-7H-release-rollback-audit.md`.
- Every production gate needs a rollback plan before enabling.
- Every enabled runtime gate needs a live smoke checklist.
- Live smoke must use a low-risk test account.
- Netlify deploys should be batched to avoid unnecessary credit usage.
- Push only after local checks and owner approval.

### 7I - First Live Candidate Decision

- Audit packet: `docs/phase-7I-base-mcp-status-decision.md`.
- The first selected candidate is read-only Base MCP status preparation.
- Candidate action kind is exactly `base_mcp_status_check`.
- Candidate chain is exactly `base`.
- Candidate surface is owner dashboard only.
- Wallet prompts, signing, transaction submission, prepared-action production
  writes, and Telegram-triggered execution remain disabled.

### 7J - Base MCP Status Provider Wiring

- Audit packet: `docs/phase-7J-base-mcp-provider-wiring.md`.
- Runtime dependencies wire only `createBaseMcpStatusCheckAdapter`.
- Runtime gate still requires exact `KYRA_BASE_MCP_PREP_ENABLED=true`.
- Provider endpoint still must be HTTPS and backend-only.
- Provider payload excludes owner id, workspace id, agent id, wallet data,
  token amounts, calldata, transaction hashes, and Telegram token refs.
- Prepared-action storage remains unwired.
- Telegram and public routes cannot trigger Base MCP.
- Wallet prompts, signing, transaction submission, swaps, transfers, approvals,
  and contract calls remain disabled.

### 7K - Owner Dashboard Base MCP Status Caller

- Audit packet: `docs/phase-7K-owner-dashboard-status-caller.md`.
- One explicit owner click can request only `base_mcp_status_check`.
- The request uses the selected persisted agent and its workspace id.
- Session freshness is checked before the request.
- Browser response parsing requires the exact read-only summary shape.
- The backend runtime gate remains default-off until separately approved.
- No storage write, wallet prompt, approval, signing, submission, public route,
  or Telegram execution path is enabled.

### 7L - Controlled Live Smoke Preparation

- Audit packet: `docs/phase-7L-controlled-live-smoke-preparation.md`.
- Require exact provider protocol `kyra_status_v1`; generic MCP endpoints are
  not compatible by assumption.
- Require persistent service-role rate limiting before provider calls.
- Keep rate-limit forward, verifier, and rollback SQL review-only until explicit
  target-project approval.
- Use bounded correlation headers without external raw-data logging.
- Keep the production runtime gate disabled until a compatible provider,
  database verifier, rollback, and controlled smoke window are approved.

### 7M - Provider Contract Qualification

- Audit packet: `docs/phase-7M-provider-contract-qualification.md`.
- Require exact bounded request and response shapes for `kyra_status_v1`.
- Bind provider success to the original request id.
- Reject non-JSON, malformed, mismatched, extra-field, and oversized responses.
- Cap provider response bodies at 4096 bytes, including streamed bodies.
- Keep provider errors sanitized and keep the production gate disabled until a
  real candidate passes qualification with owner approval.

### 7N - Official Base MCP Protocol Decision

- Audit packet: `docs/phase-7N-official-base-mcp-protocol-decision.md`.
- Treat the custom `kyra_status_v1` bridge and official OAuth MCP as separate
  protocol lanes.
- Reject `mcp.base.org` from the custom endpoint normalizer.
- Do not register, authorize, request tokens, initialize authenticated MCP, or
  request agent-wallet scopes during this phase.
- Require a separate wallet-authority, consent, token-storage, and tool audit
  before official MCP implementation.

### 7AK - Official Base MCP Transition Gate

- Audit packet: `docs/phase-7AK-official-base-mcp-transition-gate.md`.
- Keep only the official hosted MCP adapter blocked while provider-contract
  evidence remains no-go.
- Require protected resource metadata, exact resource, exact issuer and
  audience, non-escalating scope, exact scope-to-tool mapping, tool/schema
  snapshot, approval-link binding, token lifecycle, revocation, and owner
  consent evidence before official wallet authority begins.
- Keep official MCP OAuth start/callback functions, access tokens, refresh
  tokens, `agent_wallet:*` scopes, authenticated MCP sessions, tool listing,
  tool invocation, and provider approval links absent until the transition
  gate changes. Base Account wallet prompts, signing, and submission remain
  governed by separate primary-lane gates.
- Verification: `npm run check:phase-7ak`.

### 7O - Official MCP OAuth And Wallet-Authority Threat Model

- Audit packet: `docs/phase-7O-official-mcp-oauth-threat-model.md`.
- Define assets, actors, trust boundaries, threats, and fail-closed outcomes.
- Require exact issuer, redirect, resource, audience, owner, workspace, PKCE,
  and one-time state binding before any future code exchange.
- Keep official OAuth environment variables, token storage, sessions, tool
  calls, agent-wallet scopes, and wallet execution absent from runtime.
- Require separate architecture, scope, storage, tool, and smoke approvals
  before implementation.

### 7P - Official MCP OAuth Client Architecture

- Architecture packet:
  `docs/phase-7P-official-mcp-oauth-client-architecture.md`.
- Select a backend-for-frontend client with server-owned transaction state,
  callback exchange, encrypted token lifecycle, and MCP transport.
- Reject browser token handling, Telegram initiation, custom-bridge reuse,
  hardcoded discovery, runtime registration, and shared user tokens.
- Keep implementation blocked while Protected Resource Metadata is unavailable
  and the provider advertises only wallet-authority scopes.
- Require scope/consent qualification before callback or token-storage work.

### 7Q - Official MCP Scope And Consent Qualification

- Qualification packet:
  `docs/phase-7Q-official-mcp-scope-consent-qualification.md`.
- Reject omitted scopes because MCP fallback can select the protected
  resource's complete scope set, which cannot currently be verified.
- Reject `agent_wallet:transact` because current documented capabilities include
  broad spending, signing, contract-call, x402, plugin, and multi-chain surface
  without an exact scope-to-tool authority map.
- Reject `agent_wallet:escalate` because no current official authority
  definition was found.
- Keep all OAuth implementation blocked until a non-escalating scope, exact
  tool map, and complete consent contract are verifiable.

### 7R - Official Base MCP Provider Evidence Monitor

- Monitor packet: `docs/phase-7R-provider-evidence-monitor.md`.
- Observe only four exact public metadata/documentation URLs with GET, no
  credentials, no body, no redirects, bounded responses, and sanitized output.
- Track a reviewed semantic baseline and report drift without modifying it.
- Never call authorization, registration, token, MCP session, tool, wallet, or
  transaction endpoints.
- Keep drift review manual and keep all OAuth/runtime gates disabled.

### 7S - Provider Drift Response Runbook

- Runbook packet: `docs/phase-7S-provider-drift-response-runbook.md`.
- Classify provider evidence drift as critical or caution before any baseline
  update.
- Treat authorization, token, registration, scope, protected-resource, tool-map,
  and escalation-semantics changes as critical drift.
- Re-run Phase 7O and Phase 7Q before changing any official MCP decision.
- Require explicit owner approval before manually updating the reviewed
  baseline.
- Keep OAuth client work, token storage, MCP sessions, tool calls, wallet
  prompts, signatures, approvals, swaps, transfers, contract calls, Telegram
  drafts, and Telegram execution blocked during drift response.

### 7T - Custom Bridge Smoke Go/No-Go

- Go/no-go packet: `docs/phase-7T-custom-bridge-smoke-go-no-go.md`.
- Require provider contract, provider ownership, provider safety, target-project
  rate-limit SQL verification, rollback review, gate window, low-risk account,
  local verification, and owner approval before any smoke.
- Keep the current smoke decision blocked until every evidence row is ready.
- Require `KYRA_BASE_MCP_PREP_ENABLED=false` before and immediately after any
  approved smoke window.
- Treat wallet data, calldata, signatures, Telegram tokens, Supabase sessions,
  raw provider bodies, user identifiers, and transaction material as
  non-shareable evidence.
- Keep Telegram, public routes, wallet prompts, signing, prepared-action
  writes, and onchain execution disabled.

### 7U - Target Supabase Rate-Limit Verifier Readiness

- Verifier packet:
  `docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md`.
- Require target project reference, environment label, operator identity, owner
  approval, apply window, rollback operator, rollback window, and gate-off
  confirmation before touching a target Supabase project.
- Keep the rate-limit forward and rollback SQL as review drafts until explicit
  target-project approval.
- Share only boolean verifier evidence; never share service-role keys, database
  passwords, JWTs, row data, Telegram tokens, wallet data, provider secrets, or
  user identifiers.
- Treat any false verifier boolean, target mismatch, SQL drift, secret exposure,
  or local check failure as a no-go.
- Keep runtime gates, provider calls, Telegram execution, wallet prompts,
  signing, prepared-action writes, and onchain execution disabled.

### 7V - Provider Candidate Dossier

- Dossier packet: `docs/phase-7V-provider-candidate-dossier.md`.
- Require provider identity, endpoint owner, operational contact, rollback
  contact, credential lifecycle, data retention, incident path, and endpoint
  origin without credentials before a provider can enter review.
- Require exact `kyra_status_v1` positive and negative contract evidence.
- Reject candidates that require official Base MCP OAuth, `agent_wallet:*`
  scopes, wallet data, Telegram data, Supabase data, user identity data, public
  frontend configuration, or Telegram initiation.
- Keep provider approval separate from smoke approval; dossier approval only
  permits a later smoke approval discussion.
- Keep runtime gates, SQL application, provider calls, wallet prompts, signing,
  Telegram execution, and onchain execution disabled.

### 7W - Redacted Smoke Approval Packet

- Approval packet: `docs/phase-7W-redacted-smoke-approval-packet.md`.
- Convert an approved provider dossier into an owner-review packet without
  exposing credentials, wallet data, Telegram tokens, Supabase secrets, raw
  provider bodies, user identifiers, calldata, signatures, or transaction
  material.
- Require exact provider endpoint origin, smoke window, rollback operator,
  gate-off confirmation, safe request/response evidence, Phase 7U verifier
  booleans, Phase 7T go/no-go rows, and explicit owner approval.
- Keep approval capture separate from execution; this packet does not authorize
  SQL application, provider calls, gate enablement, wallet prompts, Telegram
  execution, signing, swaps, transfers, contract calls, or transaction
  submission.
- Keep current smoke decision blocked until the exact packet is filled and
  approved.

### 7X - Final Pre-Smoke Decision Matrix

- Decision packet: `docs/phase-7X-final-pre-smoke-decision-matrix.md`.
- Consolidate Phase 7A through Phase 7W into one final no-go/go-forward matrix
  before any compatible provider, SQL target, runtime gate, or smoke window is
  accepted.
- Require all prior packets, local checks, redacted approval packet fields,
  provider dossier status, target Supabase verifier readiness, rollback plan,
  and gate-off confirmation to align before the decision can move from blocked.
- Keep the current decision blocked because no provider is approved, no target
  Supabase verifier has been applied, no redacted owner approval packet is
  filled, and no smoke window is approved.
- Keep SQL application, provider calls, runtime gate enablement, wallet prompts,
  signing, Telegram execution, swaps, transfers, contract calls, and transaction
  submission disabled.

### 7Y - Full Pre-Provider Audit

- Audit packet: `docs/phase-7Y-full-pre-provider-audit.md`.
- Re-audit the runtime, dashboard caller, public route, Telegram route, wallet
  provider boundary, prepared-action storage boundary, provider protocol,
  official OAuth decision, logs, docs, and check suite before provider
  selection.
- Current audit finds no production execution path enabled, no Telegram or
  public Base MCP trigger, no wallet prompt/signing path, no prepared-action
  production write wiring, no official OAuth runtime, and no approved provider.
- Remaining blockers are expected: provider absent, target Supabase verifier
  unapplied, owner approval packet unfilled, smoke window absent, and runtime
  gate intentionally off.
- Keep provider selection blocked until this audit remains green and the next
  provider sandbox packet is created.

### 7Z - Provider Selection Sandbox

- Sandbox packet: `docs/phase-7Z-provider-selection-sandbox.md`.
- Define an offline-only candidate evaluation flow after the Phase 7Y audit,
  without contacting providers, pasting credentials, applying SQL, enabling
  runtime gates, running smoke tests, or expanding execution scope.
- Score candidates only on redacted business identity, endpoint ownership,
  protocol compatibility, credential lifecycle, data boundary, rollback
  readiness, incident path, retention, and support ownership.
- Reject any candidate that requires official MCP OAuth, `agent_wallet:*`
  scopes, wallet data, Telegram data, Supabase data, user identifiers, public
  frontend configuration, raw provider payload sharing, or Telegram initiation.
- Keep the current result as no provider selected. A passing sandbox result can
  only move one candidate into a Phase 7V dossier draft; it cannot approve a
  provider or smoke.

### 7AA - Provider Candidate Intake Gate

- Intake packet: `docs/phase-7AA-provider-candidate-intake-gate.md`.
- Require explicit owner nomination before any real provider candidate can
  enter the 7Z sandbox.
- Accept only redacted candidate metadata: provider/project name, public
  source, endpoint origin, accountable contacts, credential type without value,
  credential lifecycle notes, and written support for `kyra_status_v1` plus
  `POST /status-check`.
- Reject intake that includes provider credentials, Telegram secrets, Supabase
  secrets, wallet data, user identifiers, official MCP OAuth material,
  `agent_wallet:*` scopes, raw provider bodies, or live-probe requirements.
- Keep the current result as no candidate intake accepted. A passing intake can
  only move redacted metadata into the Phase 7Z sandbox; it cannot approve a
  provider, SQL, runtime gate, or smoke.

### 7AB - Provider Candidate Scoring Worksheet

- Scoring packet: `docs/phase-7AB-provider-candidate-scoring-worksheet.md`.
- Define an offline-only weighted scorecard for one owner-nominated candidate
  using redacted metadata only.
- Hard-fail rules override numeric score. A candidate is rejected if it requires
  official MCP OAuth, `agent_wallet:*` scopes, wallet data, Telegram data,
  Supabase data, user identity, transaction material, public credential config,
  Telegram initiation, live probes before dossier completion, or non-exact
  `kyra_status_v1` and `POST /status-check` support.
- Require minimum scoring floors before a candidate can be treated as
  `scored_ready_for_7z_sandbox`: total at least 90, data boundary full score,
  protocol/path full score, endpoint safety full score, credential lifecycle at
  least 10, and evidence readiness at least 5.
- Keep the current result as no candidate scored. A passing score can only move
  redacted metadata and score summary into the Phase 7Z sandbox review; it
  cannot approve a provider, SQL, runtime gate, or smoke.

### 7AC - Candidate Dossier Fill Gate

- Dossier fill packet: `docs/phase-7AC-candidate-dossier-fill-gate.md`.
- Require Phase 7AA `ready_for_7z_sandbox`, Phase 7AB
  `scored_ready_for_7z_sandbox`, Phase 7Z `candidate_for_dossier`, Phase 7V
  dossier format, no hard-fail rules, and explicit owner confirmation before a
  real dossier can be filled.
- Allow only redacted dossier fields: provider/project name, public source,
  endpoint origin, owners and contacts, exact protocol/path, credential type
  without value, credential lifecycle, data boundary, summarized evidence
  readiness, retention, incident path, support window, and redacted owner
  summary.
- Reject dossier fill that includes provider credentials, Telegram secrets,
  Supabase secrets, wallet data, user identifiers, official MCP OAuth material,
  `agent_wallet:*` grants, raw provider bodies, or transaction material.
- Keep the current result as no candidate dossier filled. A completed dossier
  can only move to owner dossier review; it cannot approve a provider, SQL,
  runtime gate, provider credential, endpoint call, or smoke.

### 7AD - SQL Verifier Final Approval Packet

- SQL approval packet: `docs/phase-7AD-sql-verifier-final-approval-packet.md`.
- Require Phase 7U target verifier readiness, Phase 7T smoke go/no-go context,
  7AC dossier fill gate status, exact target Supabase project, operator, apply
  window, rollback operator and window, gate-off confirmation, provider and
  smoke still blocked, and owner approval before SQL can be considered for a
  later manual apply.
- Keep approval scope narrow to the reviewed forward SQL, verifier SQL, and
  rollback SQL files.
- Accept only boolean-only verifier evidence and redacted operator summary;
  reject service-role keys, Supabase credentials, Telegram tokens, provider
  credentials, wallet data, user identifiers, raw rows, migration logs with
  secrets, official OAuth material, and transaction material.
- Keep the current result as SQL approval not requested. Owner SQL approval
  still cannot apply SQL, run verifier, enable runtime gates, approve provider
  use, or approve smoke.

### 7AE - Controlled Smoke Closeout Runbook

- Closeout runbook: `docs/phase-7AE-controlled-smoke-closeout-runbook.md`.
- Require Phase 7V provider dossier approval, Phase 7M contract evidence, Phase
  7U target verifier readiness, Phase 7AD SQL approval, Phase 7T go/no-go
  readiness, Phase 7W owner smoke approval, and Phase 7X ready decision before
  any future smoke can be authorized.
- Keep authorization limited to one owner workspace, one persisted demo agent,
  one action kind, one chain, one protocol, one endpoint origin, one short
  window, and owner dashboard only.
- Require gate-off before and after the window, immediate abort rules, safe
  closeout evidence, local checks after the window, and a redacted result state.
- Keep the current result as smoke not authorized. This runbook cannot apply
  SQL, run verifier SQL, enable runtime gates, contact providers, approve
  smoke, trigger Telegram execution, open wallet prompts, or submit
  transactions.

### 7AF - Provider Candidate Submission Template

- Submission template: `docs/phase-7AF-provider-candidate-submission-template.md`.
- Accept only redacted provider candidate submissions: provider name, public
  source, endpoint origin, accountable contacts, credential type without value,
  credential lifecycle, exact `kyra_status_v1` and `POST /status-check`
  support, data boundary, retention, incident path, and support window.
- Reject provider credentials, Telegram tokens, Supabase secrets, wallet data,
  user identifiers, raw provider bodies, transaction material, official MCP
  OAuth material, `agent_wallet:*` scope requirements, live-probe requirements,
  Telegram initiation, and public frontend credential configuration.
- Keep the current result as no provider candidate submitted. A clean
  submission can only move redacted fields into Phase 7AA intake review; it
  cannot approve provider use, credentials, endpoint calls, SQL, runtime gates,
  smoke, wallet prompts, Telegram execution, or transactions.

### 7AG - Provider Evidence Fill Review

- Evidence review: `docs/phase-7AG-provider-evidence-fill-review.md`.
- Require redacted evidence for identity, endpoint ownership, exact protocol and
  path, positive and negative contract summaries, data boundary, credential
  lifecycle, retention, incident path, rollback, and support window.
- Accept only public links, redacted provider statements, redacted operator
  summaries, redacted contract-shape summaries, and redacted incident/rollback
  summaries.
- Reject credentials, Telegram tokens, Supabase secrets, wallet data, user
  identifiers, raw provider bodies, transaction material, official OAuth
  material, `agent_wallet:*` grants, browser storage, and live probe output
  gathered before dossier completion.
- Keep the current result as no provider evidence filled. Filled evidence can
  only move toward Phase 7AB scoring; it cannot approve provider use, endpoint
  calls, SQL, runtime gates, or smoke.

### 7AH - Target SQL Approval Prep

- SQL prep packet: `docs/phase-7AH-target-sql-approval-prep.md`.
- Prepare the exact target-project approval material for the review-only Base
  MCP status rate-limit SQL: redacted target project, environment, operator,
  apply window, rollback operator, rollback window, gate-off proof, SQL file
  list, boolean-only verifier evidence policy, and owner approval status.
- Keep the forward, verifier, and rollback SQL files review-only. Share only
  boolean verifier fields after a future approved manual apply.
- Reject service-role keys, database passwords, JWTs, Telegram tokens, provider
  credentials, wallet data, user identifiers, raw rows, raw migration output
  with sensitive values, transaction material, open-ended windows, and
  runtime-gate-on state.
- Keep the current result as target SQL approval not ready. SQL prep cannot
  request approval, apply SQL, run verifier SQL, enable runtime gates, contact
  providers, or authorize smoke.

### 7AI - Final Smoke Authorization Packet

- Authorization packet: `docs/phase-7AI-final-smoke-authorization-packet.md`.
- Consolidate Phase 7AF, 7AG, 7AA, 7AB, 7Z, 7AC, 7V, 7AH, 7AD, 7U, 7W, 7X,
  and 7AE into one final redacted authorization gate before any future
  one-call read-only smoke can be considered.
- Limit any future authorization to one owner workspace, one persisted demo
  agent, one `base_mcp_status_check`, Base chain, `kyra_status_v1`, one
  provider endpoint origin, one provider call, one short window, and owner
  dashboard only.
- Explicitly exclude wallet prompts, signatures, token approvals, swaps,
  transfers, contract calls, prepared-action production writes outside reviewed
  scope, Telegram execution, public-route execution, official MCP OAuth,
  `agent_wallet:*` scopes, arbitrary calldata, transaction submission, and
  long-running runtime gates.
- Keep the current result as final smoke not authorized. This packet cannot run
  smoke, enable runtime gates, apply SQL, run verifier SQL, contact providers,
  request credentials, paste credentials, or approve wallet/onchain execution.

## Candidate Selection Rules

The first live candidate must be narrow:

- one action kind
- one chain: Base
- one owner workspace
- one reviewed provider path
- one explicit approval path
- no arbitrary calldata
- no arbitrary recipient
- no autonomous execution
- no Telegram execution trigger

The current safest candidate remains read-only Base MCP status preparation. A
real signable action requires a separate Phase 7 decision packet.

Historical clarification: the custom status candidate was selected as an
infrastructure proof and has completed its smoke. It does not close Phase 7.
The remaining primary path is the official Base MCP sequence defined in
`docs/product-phase-roadmap.md`.

## Required Checks

Before any Phase 7 push or deploy:

- `npm run check:phase-6`
- `npm run check:phase-7-entry`
- `npm run check:phase-7b`
- `npm run check:phase-7c`
- `npm run check:phase-7d`
- `npm run check:phase-7e`
- `npm run check:phase-7f`
- `npm run check:phase-7g`
- `npm run check:phase-7h`
- `npm run check:phase-7i`
- `npm run check:phase-7j`
- `npm run check:phase-7k`
- `npm run check:phase-7l`
- `npm run check:phase-7m`
- `npm run check:phase-7n`
- `npm run check:phase-7o`
- `npm run check:phase-7p`
- `npm run check:phase-7q`
- `npm run test:phase-7r`
- `npm run check:phase-7r`
- `npm run check:phase-7s`
- `npm run check:phase-7t`
- `npm run check:phase-7u`
- `npm run check:phase-7v`
- `npm run check:phase-7w`
- `npm run check:phase-7x`
- `npm run check:phase-7y`
- `npm run check:phase-7z`
- `npm run check:phase-7aa`
- `npm run check:phase-7ab`
- `npm run check:phase-7ac`
- `npm run check:phase-7ad`
- `npm run check:phase-7ae`
- `npm run check:phase-7af`
- `npm run check:phase-7ag`
- `npm run check:phase-7ah`
- `npm run check:phase-7ai`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

Before any production execution gate:

- Supabase RLS/ownership verifier reviewed.
- Rollback SQL reviewed.
- Runtime environment gate reviewed.
- Low-risk test account selected.
- Owner approval captured.
- Live smoke checklist prepared.

## Phase 7A Done Criteria

- Phase 7 audit packet exists.
- Automated entry check exists.
- Phase 6 suite still passes.
- Current source confirms no production execution is enabled.
- Next work item is selected from audit findings, not guessed.
