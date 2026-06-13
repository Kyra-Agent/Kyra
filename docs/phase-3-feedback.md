# Phase 3 Feedback Tracker

Status note: this is a historical public-demo feedback tracker. Current product
status is maintained in `README.md` and the Phase 5 closeout is maintained in
`docs/phase-5-telegram-closeout.md`.

Kyra Agent is now live as a backend-connected demo. Phase 3 is for public demo feedback,
light polish, and planning the next build steps without pretending the product is live
onchain.

## Current Position

- Live site: https://kyra-agent.netlify.app/
- Official X: https://x.com/Kyra_Agent
- Historical phase: public demo feedback after first X post.
- Demo status: backend-connected, not live onchain execution.
- Safety line: no real transactions, no wallet private keys, no Telegram bot tokens, no
  real funds touched.

## Early Feedback

Initial friend feedback has been positive.

Capture future feedback in this format:

| Date | Source | Feedback | Category | Priority | Follow-up |
| --- | --- | --- | --- | --- | --- |
| 2026-06-02 | Friends | Positive early reaction to the public demo. | General | P2 | Keep collecting specifics. |

Categories:

- Product concept
- UI and visual identity
- Agent templates
- Deploy flow
- Dashboard
- Public agent preview
- Mobile
- Safety and trust wording
- Backend reliability

## Questions To Watch

- Do users understand that Kyra is a backend-connected demo?
- Do users understand that Base/onchain actions are simulated for now?
- Which template gets the most interest: Operator, Strategist, Scout, Steward, Executor, or Custom?
- Does the deploy wizard feel clear enough without explanation?
- Does the dashboard feel useful or too technical?
- Does the public agent preview feel share-ready?
- Does mobile feel good enough for people arriving from X?

## Build-Forward Work While Feedback Is Light

Do not wait passively for feedback. Keep improving the demo in small, safe batches.

Safe Phase 3 work:

- Improve public copy where users might misunderstand demo vs live execution.
- Polish public agent preview details.
- Add better empty states and receipt details if needed.
- Prepare follow-up X screenshots and short demo explanations.
- Document feedback and triage decisions.
- Create a Phase 4 backend-hardening plan before changing backend behavior.

Do not do in Phase 3 without explicit approval:

- Do not add real onchain execution.
- Do not connect live wallet transaction execution.
- Do not store wallet private keys.
- Do not add real Telegram bot token handling in the browser.
- Do not change schema, RLS, or auth behavior casually.
- Do not expose service-role keys or secret values.

## Triage Rules

Blocker:

- Live site broken.
- Sign-in or deploy broken.
- Public route incorrectly shows stale/mock data.
- Safety copy implies real transaction execution.
- Secret, credential, admin ID, token, or private data exposure.

Polish:

- Visual spacing, wording, layout, mobile fit, or screenshot readiness.
- Public agent headline and profile clarity.
- Template descriptions and action labels.

Backlog:

- Server-side admin authorization.
- Rate limits.
- Structured logs and error monitoring.
- Stronger workspace model.
- LLM reasoning layer.
- Telegram integration. Phase 5 later closed the read-only Telegram + LLM scope.
- Base MCP and wallet integration.

## Phase 4 Candidates

Phase 4 should focus on backend hardening before any deeper live integrations.

- Server-side admin role validation for admin/reset operations.
- Rate limits for deploy and public profile reads.
- Better structured logging for deploy-agent calls.
- Error monitoring for frontend and Edge Function failures.
- Stronger workspace ownership and uniqueness model.
- RLS re-audit after any schema or role changes.
- Clear admin dashboard for health, quota, and demo records.

## Follow-Up X Ideas

- Screenshot thread: public agent profile, template grid, mobile view, approval modal.
- Explain Operator as the personal wallet action agent.
- Explain Strategist as the market and campaign planning agent.
- Show the safety model: Kyra prepares, wallet approves, demo execution stays simulated.
- Invite feedback on which agent template should be built deeper first.
