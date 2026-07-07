<p align="center">
  <img src="public/brand/kyra.jpg" alt="Kyra Agent" width="96" />
</p>

<h1 align="center">Kyra Agent</h1>

<p align="center">
  Base-native AI agent platform for deploying Telegram-native agents with
  approval-first onchain workflows.
</p>

<p align="center">
  <a href="https://kyraagent.xyz">Website</a>
  &middot;
  <a href="https://x.com/Kyra_Agent">X</a>
  &middot;
  <a href="https://github.com/Kyra-Agent/Kyra">GitHub</a>
</p>

<p align="center">
  <img alt="Product" src="https://img.shields.io/badge/Product-Release%20Ready-111827?style=for-the-badge" />
  <img alt="Base" src="https://img.shields.io/badge/Base-Native-0052FF?style=for-the-badge" />
  <img alt="Security" src="https://img.shields.io/badge/Security-Approval%20First-16A34A?style=for-the-badge" />
</p>

![Kyra Agent product preview](public/og-card.png)

## Product Snapshot

Kyra Agent is a Base-native AI agent platform for creating user-owned agents that operate through Telegram, maintain private dashboard records, publish shareable agent profiles, and prepare onchain actions behind explicit owner and wallet approval.

Kyra is designed for users and teams who want an agent interface without giving up wallet authority. Agents can understand intent, produce planning or risk context, and prepare bounded action reviews. Sensitive execution stays behind the owner dashboard, Base Account, approval gates, receipt checks, and privacy-safe logging.

## Live Product Surface

| Surface | What it provides |
| --- | --- |
| Agent deployment | Template-based agent creation with account-scoped persistence |
| Dashboard | Private workspace for agents, Telegram state, wallet policy, and action readiness |
| Public profiles | Shareable agent identity, capabilities, command examples, and safety policy |
| Telegram | Live read-only commands and bounded natural-language planning |
| LLM layer | Backend-only enrichment for eligible read-only replies |
| Base Account | User-owned wallet connection and approval boundary |
| Execution path | Controlled owner flow with approval, risk review, and sanitized result handling |

## What Kyra Can Do

- Deploy agent profiles from clear templates.
- Persist signed-in agent records through the backend.
- Publish private dashboard and public profile views.
- Reply in Telegram with read-only commands and planning chat.
- Convert risky wallet or transaction requests into review drafts.
- Refuse Telegram-triggered execution while still producing useful plans, checklists, and risk reviews.
- Require owner approval and wallet approval before any onchain action can move forward.
- Preserve sanitized logs, support evidence, and release readiness records.

## Telegram Commands

Connected Telegram agents support a read-only command surface:

| Command | Purpose |
| --- | --- |
| `/help` | Show available commands and examples |
| `/status` | Report Telegram session and execution boundary |
| `/agent` | Summarize the deployed agent role and focus |
| `/actions` | Show available read-only actions and approval-required actions |
| `/modules` | Show the deployed template module stack |
| `/policy` | Explain the wallet and onchain safety boundary |

Natural prompts can produce campaign plans, market briefs, narrative maps, launch copy, community pulse summaries, and risk reviews. Swap, transfer, approval, contract, wallet, and Base MCP execution requests from Telegram are refused and converted into safe review output.

## Agent Templates

| Template | Role |
| --- | --- |
| Operator | Personal wallet readiness and action review agent |
| Scout | Recon and launch monitor |
| Steward | Project and community agent |
| Executor | Rule-based action readiness agent |
| Strategist | Market and campaign intelligence agent |
| Custom | User-defined workflow and safety limits |

Templates are the product package. Kyra modules are the internal capability layer behind them.

| Module | Capability |
| --- | --- |
| NIRA-01 | Lead orchestration |
| VEXA-02 | Recon and monitoring |
| ASTRA-03 | Research and reasoning |
| NOVA-04 | Data and context |
| NYX-05 | Security and risk guard |

## Approval-First Execution

Kyra is built around a simple rule: the agent can prepare, but the user wallet decides.

| Available surface | Protected boundary |
| --- | --- |
| Telegram read-only commands | Telegram-triggered wallet execution |
| LLM-assisted planning replies | Hidden transaction submission |
| Dashboard and public profiles | Seed phrase or private-key collection |
| Base Account readiness | Autonomous fund movement |
| Action review drafts | Contract calls without explicit owner approval |
| Sanitized result recording | Public exposure of wallet internals or tokens |

Current safety guarantees:

- No seed phrase collection.
- No private key custody.
- No hidden transaction execution.
- No Telegram-triggered signing.
- No public exposure of Telegram bot tokens.
- No raw session tokens, provider payloads, or wallet internals in public views.
- Owner approval, wallet approval, receipt verification, rollback readiness, and privacy checks stay part of the execution path.

## Base MCP And Base Account

Kyra's primary user transaction boundary is Base Account: the user connects their own account, reviews the prepared action, and remains the final approval gate.

Base MCP remains an optional provider adapter track. It is not a blocker for Kyra's Base Account path, and it stays separated until provider metadata, scope semantics, consent, token lifecycle, revocation, rate limits, and owner approval are fully verified.

## Product Status

Kyra has closed the current release-readiness roadmap for agent deployment, Telegram-native interaction, wallet policy modeling, Base Account readiness, controlled owner execution flow, public hardening, support operations, launch QA, final security/privacy review, and public product polish.

Public execution remains approval-first by design. Any widened transaction rollout must preserve the same owner dashboard, Base Account approval, risk review, receipt verification, emergency disable, and privacy-safe evidence requirements.

Detailed engineering evidence is tracked in:

- [`docs/product-phase-roadmap.md`](docs/product-phase-roadmap.md)
- [`docs/supporting-readiness-closeout.md`](docs/supporting-readiness-closeout.md)
- [`docs/phase-10-product-release-readiness.md`](docs/phase-10-product-release-readiness.md)
- [Product Readiness Snapshot](docs/product-readiness-snapshot.md)

## Product Principles

- User wallet authority first.
- Telegram-native agent UX.
- Backend-only handling for sensitive integrations.
- Read-only by default; approval before execution.
- No custody, no seed phrases, no hidden signing.
- Clear public copy, sanitized evidence, and explicit release controls.

## Links

| Destination | URL |
| --- | --- |
| Website | https://kyraagent.xyz |
| X | https://x.com/Kyra_Agent |
| Repository | https://github.com/Kyra-Agent/Kyra |