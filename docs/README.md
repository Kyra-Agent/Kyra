# Kyra Engineering Documentation

This directory records the production architecture, safety boundaries, migration history, and release evidence behind Kyra Agent. Public product claims remain in the repository README; these documents provide the technical contract without publishing secret values, private identifiers, wallet addresses, or raw operational evidence.

## Product Truth

| Document | Purpose |
| --- | --- |
| [v1.0.0 Release Notes](release-v1.0.0.md) | Public release scope, verification, and retained safety boundaries |
| [Product Roadmap](product-phase-roadmap.md) | Canonical ten-phase product roadmap and current completion state |
| [Product Readiness Snapshot](product-readiness-snapshot.md) | Live capability, controlled boundaries, and sanitized release evidence |
| [Backend Blueprint](backend-blueprint.md) | Runtime architecture, privacy model, chain contract, and execution boundary |
| [Controlled Execution Launch Packet](controlled-execution-launch-packet.md) | Required sequence and hard blocks for an onchain transaction |

## Robinhood Chain

| Document | Purpose |
| --- | --- |
| [Migration Blueprint](robinhood-chain-migration-blueprint.md) | Completed cutover from the retired chain implementation |
| [Mainnet Runbook](robinhood-mainnet-cutover-runbook.md) | Production configuration, verification, evidence, and rollback procedure |

## Telegram

| Document | Purpose |
| --- | --- |
| [Telegram Integration](telegram-integration-plan.md) | Live Telegram, LLM, owner-linking, and read-only execution boundary |

## Source-Level Contracts

Each deployed Edge Function has a colocated README under `supabase/functions/<function>/README.md`. Those files describe the active runtime contract, privacy boundary, failure behavior, and operational role of the function. Deployment and runtime authorization remain separate: an active function still fails closed unless its authenticated scope and exact runtime gates pass.

## Documentation Rules

- Robinhood Chain is the only active product chain family.
- Owner means the signed-in user who owns the workspace, not a separate privileged product account.
- Telegram is live for read-only commands and multilingual planning; it never signs or submits.
- Wallet authority remains with the connected user wallet.
- Transaction access is private, selected-agent bound, explicitly approved, and verified per action.
- Secret values, raw logs, internal identifiers, full wallet addresses, and provider payloads never belong in public documentation.
- A completed roadmap does not disable runtime safety gates.

Production documentation was reconciled with the `v1.0.0` release state on 2026-07-29.
