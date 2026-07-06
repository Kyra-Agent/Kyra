# Phase 10C Launch QA and Production Health Evidence

Status: ready for local closeout. Public execution runtime remains default-off.

Batch 10C defines the launch QA checklist and production health evidence required before Kyra can move into final security and privacy audit. This document does not claim a new production deployment has happened; it defines the evidence that must be collected after an approved push or release candidate deploy.

## Launch QA Scope

| Surface | Required QA evidence | Pass condition |
| --- | --- | --- |
| Landing page | Load the public website and inspect product copy. | Copy matches Phase 10 product positioning and does not imply unsupported execution. |
| README/GitHub | Inspect the public README. | Phase 9 structurally complete and Phase 10 active are visible. |
| Dashboard | Open the private dashboard. | Owner-only panels render, runtime remains gated, and no private state appears in public routes. |
| Deploy flow | Create or inspect a deployed demo agent. | Agent template, module stack, and public route are present without exposing secrets. |
| Public agent profile | Open a public agent route. | Identity/capability copy is visible; wallet, token, session, provider payload, and raw error details stay hidden. |
| Telegram read-only | Send `/help`, `/status`, `/agent`, `/actions`, `/modules`, and `/policy`. | Replies are read-only and refuse wallet/onchain execution. |
| Natural Telegram planning | Send a planning prompt. | Agent returns a read-only brief, plan, copy, or risk review. |
| Wallet/Base Account | Connect and disconnect Base Account from the owner dashboard. | Browser-session scoped connection works and execution stays gated until explicit release approval. |
| Transaction boundary | Attempt a Telegram execution request and public-route execution trigger. | Telegram/public execution remains blocked. |
| Support state copy | Inspect blocked, rejected, provider, gas, stuck receipt, and public profile support states. | Copy is user-safe and does not request secrets. |

## Production Health Evidence

Collect after an approved push or release candidate deploy:

| System | Evidence | Required status |
| --- | --- | --- |
| Netlify production deploy | Latest production deploy status and build log summary. | Published without exposed-secret failure. |
| Netlify site routes | `/`, `/dashboard`, `/deploy`, and a public agent route. | HTTP 200 or expected authenticated/private state. |
| Supabase project health | Project status and Edge Function availability. | Active/healthy with required functions available. |
| Supabase public views | Public profile and Telegram summary views. | No forbidden private columns. |
| Edge Functions | `deploy-agent`, Telegram webhook, Base status/prep functions. | Active and free of unsanitized runtime logs. |
| Telegram bot session | Connected deployed-agent bot. | Read-only command surface works. |
| Base Account provider | Owner dashboard connect/disconnect. | Connection scoped to browser session and selected agent. |
| Privacy checks | `npm run check:privacy`. | Passing. |
| Roadmap checks | `npm run check:roadmap`. | Passing. |
| Build check | `npm run build`. | Passing with only known non-blocking bundle warnings. |

## Manual Smoke Script

1. Open `https://kyraagent.xyz/`.
2. Confirm the public product copy is Phase 10 ready.
3. Open `https://kyraagent.xyz/dashboard`.
4. Confirm owner-only dashboard panels render.
5. Connect Base Account, validate status, then disconnect.
6. Confirm execution remains gated unless release approval exists.
7. Open deploy flow and inspect the latest deployed agent record.
8. Open one public agent route.
9. Confirm public profile hides wallet internals, token refs, session ids, internal ids, provider payload refs, transaction intent internals, and raw error details.
10. Send Telegram read-only commands to the connected bot.
11. Send a Telegram execution request and confirm refusal.
12. Review Netlify deploy status and Supabase project health.
13. Record sanitized owner-only evidence.

## Evidence Rules

- Use screenshots only after hiding wallet addresses unless owner-approved display is required.
- Do not capture Telegram bot tokens, API keys, service-role data, raw session tokens, provider payload bodies, or raw Edge Function errors.
- Store detailed evidence owner-only.
- Public status copy must be aggregated and privacy-preserving.
- If any private value appears publicly, stop release review and use emergency disable plus rollback.

## Closeout Criteria

Batch 10C can close when:

- launch QA surfaces are listed
- production health evidence requirements are listed
- manual smoke test steps are listed
- privacy-safe evidence rules are listed
- Netlify, Supabase, Edge Function, Telegram, Base Account, build, roadmap, and privacy checks are represented
- public execution runtime remains default-off until explicit release approval