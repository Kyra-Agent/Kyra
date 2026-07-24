# Telegram Integration

## Live Capability

Each deployed agent can link one Telegram bot through an owner-scoped backend flow. The webhook resolves the stored bot secret server-side, verifies the Telegram secret header, authorizes the chat, deduplicates updates, loads the selected template and modules, and returns either deterministic commands or an LLM-generated read-only response.

Supported commands include /help, /status, /agent, /actions, /modules, and /policy. Natural-language planning requests are supported through the configured agent brain.

## Security Boundary

- bot tokens never enter persistent frontend state
- webhook secrets are backend-only
- owner linking and disconnect require an authenticated workspace owner
- chat authorization and replay protection are enforced before response generation
- execution-like requests are rejected before the LLM path
- Telegram cannot create wallet prompts, approvals, signatures, calldata, or transaction submissions
- errors are sanitized and do not expose provider or token details

## Robinhood Context

Agent replies may describe Robinhood Chain status, market context, risks, and an action checklist. Any transaction request is redirected to the private owner workspace for review. Telegram stays read-only even when wallet submission is later released.
