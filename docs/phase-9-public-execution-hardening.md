# Phase 9 Public Execution Hardening

Status: Batch 9A in progress. Public execution runtime remains default-off.

Phase 9 hardens the path from owner-only controlled execution into a public-ready product lane. It does not weaken owner wallet authority, Kyra approval, Base Account approval, receipt verification, owner-only closeout, or Telegram token privacy.

## Batch 9A - Execution Eligibility Hardening

Batch 9A defines the first public execution eligibility gate. It does not add a public submit button, Telegram execution, public profile execution, automation execution, token approvals, swaps, arbitrary calldata, private-key input, or seed-phrase input.

Required controls:

- Phase 8 closeout must allow Phase 9 to start.
- Owner must be signed in.
- A deployed agent must be selected.
- The user's own Base Account must be connected.
- Chain must be Base.
- Action kind must be allowlisted as a capped Base ETH transfer.
- Value must be positive and at or below the configured cap.
- Kyra approval must be recorded.
- Base Account approval must be recorded.
- Receipt verification must be available.
- Owner-only closeout must be available.
- Telegram, public profiles, and automation cannot request execution.
- Swaps, token approvals, arbitrary calldata, private keys, and seed phrases remain blocked.
- The public execution runtime remains default-off until explicit release approval.

Implementation evidence:

- `src/types/phase9ExecutionEligibility.ts`
- `scripts/test-phase-9a-execution-eligibility.mjs`
- `scripts/check-phase-9a-execution-eligibility.mjs`
- `src/pages/Dashboard.tsx` renders an owner dashboard eligibility panel.
- `src/styles.css`
- `npm run check:phase-9a`

Batch 9A closeout rule:

- Batch 9A can close when the model, dashboard evidence, docs, and checks prove that public execution eligibility stays blocked unless every owner, wallet, action, approval, receipt, closeout, surface, and runtime condition passes.
- Batch 9B may start after 9A passes because abuse/rate-limit hardening can be built on top of this eligibility gate.


## Batch 9B - Abuse, Rate Limit, and Value-Limit Enforcement

Batch 9B adds the abuse and rate-limit layer that must sit between Batch 9A eligibility and any public execution runtime. It still does not add a public submit button, Telegram execution, public profile execution, automation execution, token approvals, swaps, arbitrary calldata, private-key input, or seed-phrase input.

Required controls:

- Batch 9A structural eligibility must be clean before abuse controls can pass.
- Enforce per-owner, per-agent, per-workspace, per-route, and per-wallet limits.
- Enforce cooldown windows before repeated attempts can run.
- Block used nonces and replay attempts.
- Block duplicate submit attempts.
- Enforce provider failure backoff after rejected, failed, or unavailable provider paths.
- Reuse the approved low-value cap from Batch 9A.
- Keep all abuse decisions sanitized as sanitized decisions that hide raw operational details.
- Do not expose raw wallet data, Telegram token refs, or provider payload refs.
- Keep the public execution runtime default-off until explicit release approval.

Implementation evidence:

- `src/types/phase9AbuseRateLimit.ts`
- `scripts/test-phase-9b-abuse-rate-limit.mjs`
- `scripts/check-phase-9b-abuse-rate-limit.mjs`
- `src/pages/Dashboard.tsx` renders an owner dashboard abuse/rate-limit panel.
- `src/styles.css`
- `npm run check:phase-9b`

Batch 9B closeout rule:

- Batch 9B can close when the model, dashboard evidence, docs, and checks prove that public execution stays blocked by rate-limit, cooldown, replay, duplicate-submit, provider-backoff, value-cap, and sanitized-evidence controls.
- Batch 9C may start after 9B passes because incident and rollback controls can be built on top of the hardened eligibility and abuse gates.


## Batch 9C - Incident, Rollback, and Emergency Controls

Batch 9C adds the operational controls required before public execution can be treated as a product lane. It still does not add a public submit button, Telegram execution, public profile execution, automation execution, token approvals, swaps, arbitrary calldata, private-key input, or seed-phrase input.

Required controls:

- Batch 9B abuse and rate-limit hardening must be clean before incident controls can pass.
- Operator-facing emergency disable switch must be ready.
- Rollback runbook must be ready; the rollback runbook must stay owner-only and sanitized.
- Manual recovery notes must be ready.
- Go/no-go rules must be ready.
- Rejected prompt handling must fail closed.
- Insufficient gas handling must fail closed.
- Reverted transaction handling must fail closed.
- Provider outage handling must fail closed.
- Chain mismatch handling must fail closed.
- Stale approval handling must fail closed.
- Stale prepared action handling must fail closed.
- Stuck receipt verification handling must fail closed; stuck receipt verification must never mark execution complete without owner-only confirmation.
- Post-incident owner-only audit must be available; the post-incident owner-only audit must never expose public wallet or Telegram-token details.
- Incident evidence must be sanitized.
- Public profiles and Telegram cannot control incident state.

Implementation evidence:

- `src/types/phase9IncidentControls.ts`
- `scripts/test-phase-9c-incident-controls.mjs`
- `scripts/check-phase-9c-incident-controls.mjs`
- `src/pages/Dashboard.tsx` renders an owner dashboard incident-control panel.
- `src/styles.css`
- `npm run check:phase-9c`

Batch 9C closeout rule:

- Batch 9C can close when emergency disable, rollback, manual recovery, go/no-go, failure handling, stuck receipt handling, and owner-only post-incident audit are modeled and checked.
- Batch 9D may start after 9C passes because monitoring and support can be built on top of the incident-control boundary.


## Batch 9D - Monitoring, Support, and Owner Evidence

Batch 9D adds the monitoring and owner-support evidence required before public execution can move toward final privacy and release gating. It still does not add a public submit button, Telegram execution, public profile execution, automation execution, token approvals, swaps, arbitrary calldata, private-key input, or seed-phrase input.

Required controls:

- Batch 9C incident controls must be clean before monitoring and support can pass.
- Netlify health must be visible to the owner dashboard.
- Supabase health must be visible to the owner dashboard.
- Edge Functions health must be visible to the owner dashboard.
- Transaction verification health must be visible to the owner dashboard.
- Public execution gate health must be visible without enabling public execution.
- Owner-safe support copy must explain blocked and failed states; owner-safe support copy cannot expose raw internals.
- Debugging states must be sanitized.
- Aggregated analytics must be ready; aggregated analytics cannot expose individual wallet or Telegram token data.
- Privacy-preserving public analytics must hide wallet internals, Telegram token references, provider payloads, and secrets; privacy-preserving public analytics is required before release gating.
- Owner evidence must remain owner-only.

Implementation evidence:

- `src/types/phase9MonitoringSupport.ts`
- `scripts/test-phase-9d-monitoring-support.mjs`
- `scripts/check-phase-9d-monitoring-support.mjs`
- `src/pages/Dashboard.tsx` renders an owner dashboard monitoring-support panel.
- `src/styles.css`
- `npm run check:phase-9d`

Batch 9D closeout rule:

- Batch 9D can close when production health, support copy, sanitized debugging, aggregated analytics, owner evidence, and public privacy boundaries are modeled and checked.
- Batch 9E may start after 9D passes because public privacy and release gating can be built on top of monitoring-support evidence.


## Batch 9E - Public Privacy and Release Gate

Batch 9E adds the final Phase 9 public privacy and release gate. It still does not add a public submit button, Telegram execution, public profile execution, automation execution, token approvals, swaps, arbitrary calldata, private-key input, or seed-phrase input.

Required controls:

- Batch 9D monitoring and support must be clean before public privacy release can pass.
- Landing page audit must confirm product copy does not expose unsupported execution or private state; landing page audit is required before release gating.
- Public agent profile audit must confirm owner-only wallet details stay private; public agent profile audit is required before release gating.
- Telegram response audit must confirm Telegram cannot sign, submit, or expose wallet/token internals; Telegram response audit is required before release gating.
- Dashboard copy audit must confirm owner-only state remains clearly scoped.
- Log audit must confirm no token refs, session ids, internal ids, provider payload refs, or raw errors are exposed.
- Docs audit must confirm public docs do not contain secrets or misleading execution claims.
- Edge Function error audit must confirm raw error details stay sanitized; Edge Function error audit is required before release gating.
- Wallet address exposure is forbidden beyond owner-approved display; wallet address exposure is blocked unless owner-approved.
- Transaction intent internals must not appear on public surfaces; transaction intent internals stay owner-only.
- Raw error details must stay hidden from public surfaces; raw error details stay sanitized.
- Release decision must be recorded before Phase 10 readiness starts.

Implementation evidence:

- `src/types/phase9PublicPrivacyRelease.ts`
- `scripts/test-phase-9e-public-privacy-release.mjs`
- `scripts/check-phase-9e-public-privacy-release.mjs`
- `src/pages/Dashboard.tsx` renders an owner dashboard public-privacy gate panel.
- `src/styles.css`
- `npm run check:phase-9e`

Batch 9E closeout rule:

- Batch 9E can close when public surfaces, logs, docs, Edge Function errors, sensitive-data hiding, and release decision evidence are modeled and checked.
- Phase 9 can close after 9E passes structurally; Phase 10 owns final launch QA and product release readiness.

User wallet authority and user Telegram bot-token privacy remain priority one.