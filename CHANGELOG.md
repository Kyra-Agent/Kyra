# Changelog

All notable public releases of Kyra Agent are documented here.

## [Unreleased]

### Telegram And LLM

- Bound every natural-language reply to the persisted agent template, role,
  actions, and module stack across all six product templates.
- Added multilingual template-isolation checks, foreign-template identity
  rejection, one bounded repair attempt, and a template-safe fallback.
- Kept cross-template comparisons available without allowing the active agent
  to adopt another template identity.
- Rejected execution-like requests before the LLM path so Telegram remains
  read-only and cannot create wallet authority.

### Documentation

- Clarified that the live v1 transaction lane is the exact owner-approved
  `0.0001 ETH` self-transfer, not general-purpose transaction execution.
- Added the four-phase roadmap for native and allowlisted ERC-20 transfers,
  allowlisted swaps, hardening, and staged release.
- Synchronized public, writer, readiness, and engineering documentation around
  the same live-versus-planned product boundary.

## [1.0.0] - 2026-07-29

### Product

- Added account-scoped workspaces and template-based agent deployment.
- Added private dashboards and sanitized public agent profiles.
- Added live Telegram commands and multilingual LLM-assisted planning.
- Added Robinhood Chain wallet discovery with visible provider identity.
- Added selected-agent action preparation, NYX-05 risk review, and explicit user approval.
- Added bounded owner-controlled transaction submission and verified private closeout.

### Security

- Kept private keys, seed phrases, Telegram bot tokens, raw provider payloads, and session internals out of public storage and views.
- Bound prepared actions to the authenticated account, workspace, agent, chain, immutable intent, expiry, and one-time approval flow.
- Added abuse limits, retry-safe Telegram delivery, RPC-verified receipts, emergency controls, and owner-only result evidence.
- Kept Telegram, public profiles, autonomous execution, token approvals, arbitrary calldata, and hidden signing outside the release boundary.

### Operations

- Completed the canonical ten-phase product roadmap.
- Deployed twelve Supabase Edge Functions with twenty-two migrations in linked parity.
- Added product, privacy, chain, execution, migration, and release checks to CI.
- Verified the Robinhood Chain mainnet build and public production routes.

[1.0.0]: https://github.com/Kyra-Agent/Kyra/releases/tag/v1.0.0
