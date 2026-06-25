# Controlled Execution Launch Packet

Date: 2026-06-25

Status: implemented as an owner-only readiness packet. This is not a new product phase and does not enable live execution.

## Purpose

This packet is the bridge between the completed Phase 7J controlled-live gate
and any later owner-approved execution window.

It keeps the working flow compact:

```text
owner signs in
-> owner selects one deployed agent
-> owner connects Base Account
-> Kyra checks the controlled-live gate
-> Kyra confirms production and Supabase health
-> owner may review a launch decision packet
-> wallet prompt, signing, and submission still stay disabled
```

## Current Decision

Base Account remains the primary transaction lane.

Official hosted Base MCP remains optional and disabled while provider evidence
is no-go. It must not become a hidden dependency for the Base Account primary
lane.

## Required Before Any Enablement Window

- authenticated owner session
- one selected deployed agent
- one owner-click Base Account connection
- Phase 7J controlled-live gate ready
- official Base MCP not required
- Telegram execution disabled
- public execution state hidden
- wallet execution runtime disabled
- wallet signing runtime disabled
- transaction submission runtime disabled
- production deploy health green
- Supabase health green
- rollback ready
- emergency disablement ready
- post-transaction audit ready

## Runtime Boundary

This packet cannot:

- open a wallet prompt
- request a signature
- submit a transaction
- persist a transaction hash
- call an official MCP tool
- call a provider transaction endpoint
- create or approve a prepared-action production row
- expose wallet state on public profiles
- allow Telegram to authorize execution

## Implementation

- `src/types/executionLaunchReadiness.ts`
- `scripts/test-execution-launch-readiness.mjs`
- `scripts/check-controlled-execution-launch-packet.mjs`
- private dashboard execution launch evidence panel
- `npm run check:execution-launch-readiness`

The model returns `ready_for_owner_launch_decision` only when every prerequisite
is present and every runtime execution switch is still disabled.

If the owner decision is marked approved, the model returns
`owner_approved_runtime_still_disabled`; this is intentional. Approval of the
packet is not the same as enabling wallet prompt, signing, or submission.

## Privacy Boundary

The packet is owner-only and must not include:

- private keys
- seed phrases
- Telegram bot tokens
- OpenRouter keys
- Supabase service-role keys
- raw provider payloads
- full wallet identifiers in public views
- transaction hashes before observed provider submission

User wallet authority and Telegram bot-token privacy remain the top security
priority.

## Verification

Required local checks:

```powershell
npm run test:execution-launch-readiness
npm run check:execution-launch-readiness
npm run check:phase-7
npm run build
git diff --check
```

## Done Criteria

- Launch readiness model exists.
- Dashboard shows the owner-only launch packet state.
- Base Account is the primary lane.
- Official Base MCP remains optional and disabled while no-go.
- Telegram and public routes cannot authorize execution.
- Wallet prompt, signing, and transaction submission remain disabled.
- Full Phase 7 checker includes the launch readiness guard.
