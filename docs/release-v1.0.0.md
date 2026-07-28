# Kyra Agent v1.0.0

Released 2026-07-29.

Kyra Agent v1.0.0 is the first stable public release of the Robinhood Chain AI agent platform. It closes the canonical ten-phase roadmap with agent deployment, private workspaces, Telegram and LLM interaction, user-controlled wallet connectivity, approval-first action review, and a bounded transaction release lane.

## Available

- Account creation, sign-in, and private owner-scoped workspaces.
- Six agent templates backed by the five-module Kyra capability stack.
- Deployment of up to three persisted agents per workspace.
- Sanitized public agent profiles.
- Telegram linking, commands, multilingual natural-language planning, and backend-only LLM enrichment.
- Compatible EVM wallet discovery with provider identity shown after connection.
- Robinhood Chain mainnet and testnet identity enforcement.
- Immutable prepared actions, NYX-05 risk review, explicit approval, wallet prompt, receipt verification, and owner-only result closeout.

## Safety Boundary

- The connected user wallet remains the only signing authority.
- Telegram and public profiles cannot sign, approve, or submit transactions.
- Private keys, seed phrases, Telegram bot tokens, raw provider payloads, and sensitive session data are never published.
- Autonomous fund movement, token approvals, arbitrary calldata, and hidden signing are not enabled.
- Every transaction independently revalidates account, workspace, agent, chain, intent, policy, approval, wallet, and receipt scope.

## Release Qualification

The release gate completed successfully:

- product, privacy, authentication, chain, migration, and execution checks
- all 44 selected automated test scripts
- Robinhood Chain mainnet production build
- production dependency audit with zero reported vulnerabilities
- linked Supabase migration parity and active Edge Functions
- healthy public production routes with security headers
- successful GitHub CI for the release candidate

Manual account, deployment, Telegram, wallet, and controlled transaction flows were exercised during production qualification. The recorded transaction evidence remains sanitized and owner-only.

## Runtime Contract

`v1.0.0` marks the product release, not unrestricted execution. Runtime gates remain mandatory and fail closed whenever a prerequisite drifts or is missing.
