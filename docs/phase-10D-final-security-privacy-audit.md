# Phase 10D Final Security and Privacy Audit

Status: ready for local closeout. Public execution runtime remains default-off.

Batch 10D is the final security and privacy audit before release decision. It is a release gate, not a runtime enablement step. No wallet signing, token approval, swap, transfer, calldata submission, or public execution is enabled by this document.

## Audit Priorities

1. User wallet authority is priority one.
2. User Telegram bot-token privacy is priority one.
3. Owner approval and Base Account approval remain separate mandatory gates.
4. Telegram and public profiles must never sign or submit transactions.
5. Public routes must never expose owner-only wallet, provider, session, token, receipt, or raw error details.

## Public Surface Audit

| Surface | Must show | Must hide |
| --- | --- | --- |
| Landing page | Product identity, Base-native positioning, approval-first boundary. | Secrets, private setup steps, raw provider payloads, wallet internals. |
| Public agent profile | Agent identity, template, safe capability summary. | Owner wallet details, Telegram bot tokens, session ids, internal ids, transaction intents, provider payload refs. |
| GitHub README | Product-facing status and safe roadmap. | API keys, service role refs, private install-only instructions, raw environment setup. |
| Telegram replies | Read-only planning, refusal boundaries, allowed commands. | Wallet prompts, signing requests, token approvals, provider payloads, private logs. |
| Support copy | Safe blocked-state explanations. | Requests for seed phrase, private key, Telegram token, API key, service role, raw session token. |

## Private Surface Audit

| Surface | Required control |
| --- | --- |
| Owner dashboard | Owner-only wallet and transaction state remains private. |
| Base Account connection | Browser-session scoped and selected-agent scoped. |
| Prepared action review | Requires owner context, workspace context, selected agent, policy review, and approval state. |
| Runtime submitter | Requires explicit runtime flag, live owner window, connected Base Account, prepared action, and approval state. |
| Result closeout | Stores sanitized owner-only result and never publishes raw provider payloads. |
| Emergency disable | Stops runtime execution review path without affecting read-only Telegram planning. |

## Supabase and Edge Function Audit

Required checks:

- Public views must exclude forbidden private columns.
- Edge Function logs must not include Telegram bot tokens, service-role values, raw session tokens, private keys, raw provider payload bodies, or unsanitized wallet evidence.
- Backend LLM calls must remain server-side.
- Telegram webhook must keep wallet and onchain execution disabled unless a future approved flow creates an owner-dashboard review draft only.
- Official hosted Base MCP adapter remains no-go until provider metadata, resource/audience, scope semantics, scope-to-tool mapping, consent, token lifecycle, revocation, and owner approval are verified.
- Base Account SDK lane remains the primary user transaction boundary.

## Runtime Gate Audit

Execution can only be considered for release when all gates are true together:

- authenticated owner session
- selected deployed agent
- owner-controlled Base Account on Base
- explicit Kyra approval
- explicit Base Account approval
- allowlisted prepared action
- NYX-05 risk review complete
- rate limit and abuse controls active
- emergency disable is off
- receipt/result monitoring and rollback path ready
- public and Telegram routes blocked from direct execution

If any gate fails, execution must stay disabled.

## Secret Hygiene Audit

Run these checks before any release push:

- `npm run check:privacy`
- `npm run check:roadmap`
- `npm run check:phase-10a`
- `npm run check:phase-10b`
- `npm run check:phase-10c`
- `npm run check:phase-10d`
- `npm run build`
- `git diff --check`
- repository secret scan excluding owner-only ignored context notes

Forbidden public values:

- OpenRouter or LLM API keys
- Supabase service role keys
- Telegram bot tokens
- private keys or seed phrases
- raw Base Account session tokens
- raw provider payload bodies
- raw Edge Function error dumps
- owner wallet internals on public routes

## Release Blockers

Stop release decision if any of these are true:

- public execution is enabled without explicit release approval
- Telegram can sign or submit
- public profile exposes wallet internals or tokens
- support copy asks users for secrets
- Edge logs expose secrets or raw provider payloads
- official hosted Base MCP is treated as approved despite unresolved provider evidence
- runtime submitter can bypass Kyra approval or Base Account approval
- transaction result is published publicly instead of owner-only sanitized state

## Closeout Criteria

Batch 10D can close when:

- public surface audit exists
- private surface audit exists
- Supabase and Edge Function audit exists
- runtime gate audit exists
- secret hygiene audit exists
- release blockers are documented
- all Phase 10A through 10D checks pass
- privacy, roadmap, build, diff check, and secret scan pass