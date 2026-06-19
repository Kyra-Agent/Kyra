# Phase 7 Pre-Base MCP Cleanup Audit

Date: 2026-06-20

Status: required cleanup before official Base MCP implementation.

Canonical reference: `docs/product-phase-roadmap.md`

## Verdict

Kyra should not start live Base MCP execution work until the preflight cleanup
gate passes.

The remaining primary product block is still official Base MCP end-to-end
execution for a user-owned deployed agent. This cleanup keeps the product
truthful and secure before that work starts.

## Confirmed Done

- Phase 5 Telegram and LLM is complete as live read-only.
- Phase 6 wallet and approval foundation is complete, but not live execution.
- Five module identifiers are present in templates, seed data, dashboard copy,
  and Telegram template context.
- NYX-05 has deterministic local risk-review logic.
- Telegram rejects wallet, write, approval, swap, and onchain execution from
  chat.
- Supabase schema keeps Telegram bot tokens and webhook secrets behind
  service-role-only RPC boundaries.
- Public agent profiles exclude wallet, prepared action, token, and secret
  fields.

## Cleanup Applied

- Netlify security headers now include a Content Security Policy.
- Runtime integration labels distinguish:
  - Telegram `live read-only`
  - Base MCP `custom read-only bridge`
  - wallet execution `disabled`
- Wallet policy status copy no longer calls disabled execution "simulated".
  Gated wallet states are shown as gated.
- The vulnerable `ws` dependency path is pinned through an npm override so
  wallet/Base dependencies cannot keep the known vulnerable nested version.
- `check:pre-base-mcp` now verifies the cleanup gate before the Phase 7 checker
  chain continues.

## Still Not Allowed

- No wallet prompts from page load, Telegram, LLM output, or background jobs.
- No Telegram-created prepared actions.
- No Base MCP transaction tool calls.
- No signing or transaction submission.
- No platform-owned wallet fallback.
- No token, wallet address, transaction payload, or provider credential in
  public routes or logs.

## Current Product Truth

Kyra is a deployed-agent platform.

Today:

- users can sign in
- users can deploy demo agents
- template module stacks are attached to deployed agents
- Telegram can reply read-only with LLM-backed planning
- wallet/onchain requests are refused
- Base MCP is only a custom read-only status bridge
- official Base MCP live execution is not complete

Next:

1. Keep this cleanup gate green.
2. Re-audit the official Base MCP provider contract.
3. Only after a go decision, implement Base Account connection per deployed
   agent.
4. Add OAuth/token storage, MCP tool allowlist, prepared action persistence,
   NYX/policy review, Kyra owner approval, Base Account approval, and result
   closeout in that order.
