# Changelog

All notable public releases of Kyra Agent are documented here.

## [Unreleased]

### Robinhood Chain Relaunch

- Retired the previous official KYRA contract from the product, documentation,
  and tooling. KYRA transfer, allowance, and swap paths now fail closed until
  the relaunched contract is published; native ETH transfers are unaffected.
- Fixed fresh-database bootstrap: the zero-agent reset closeout no longer
  requires pre-existing workspaces, and a new migration seeds the six-template
  agent catalog so `supabase db push` produces a deployable project.
- Fixed anonymous public agent profiles by scoping owner read policies to
  authenticated accounts.
- Added the relaunch runbook and a complete Edge Function environment example.
- Resolved high-severity dependency advisories and aligned the Edge Function
  `viem` pin with the frontend.

### Interface

- Added interface v3: an interactive "Talk to Kyra" Telegram simulator with a
  live decision trace that mirrors the real bot's safety rules, a
  pointer-reactive constellation behind the hero, and an interactive approval
  gate that shows where read-only questions, swaps, and pasted secrets stop.
  Fixed header overflow between 521px and 600px and fitted eight desktop
  nav links at 1241px.
- Added Motion v2: a scroll-driven "How Kyra works" story with a sticky
  preview, an animated stats strip, a live module orbit linked to the Kyra
  Core roster, word-by-word section headings, pointer tilt on cards, magnetic
  primary CTAs, scroll-linked aurora drift, and a focus pulse when moving
  between dashboard sections. Every effect falls back to a static layout under
  reduced motion.
- Introduced the Kyra Luxe visual layer: self-hosted Geist typography, aurora
  background, floating glass header, animated hero headline, console border
  beam, pointer spotlight surfaces, security marquee, and refined dashboard,
  profile, modal, and footer surfaces.
- Added cross-route View Transitions and faster, finer-grained scroll reveals
  with full `prefers-reduced-motion` fallbacks.
- Fixed the sticky header, fixed dialogs inside animated routes, the hero
  console overlap, duplicate log keys, and several mobile layout issues.
- Redesigned the Open Graph social card, added `llms.txt`, and resolved the
  Lighthouse accessibility findings (accessibility, SEO, and agentic browsing
  now score 100 on desktop and mobile).

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
