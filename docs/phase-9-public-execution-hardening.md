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

User wallet authority and user Telegram bot-token privacy remain priority one.