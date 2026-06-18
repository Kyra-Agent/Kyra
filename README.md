<p align="center">
  <img src="public/brand/kyra.jpg" alt="Kyra Agent" width="96" />
</p>

<h1 align="center">Kyra Agent</h1>

<p align="center">
  Base-native AI agent console for deploying Telegram-native agents with
  approval-first onchain workflows.
</p>

<p align="center">
  <a href="https://kyraagent.xyz">Website</a>
  ·
  <a href="https://x.com/Kyra_Agent">X</a>
  ·
  <a href="https://github.com/Kyra-Agent/Kyra">GitHub</a>
</p>

<p align="center">
  <img alt="Phase 7" src="https://img.shields.io/badge/Phase%207-Read--Only%20Base%20MCP%20Wiring-111827?style=for-the-badge" />
  <img alt="Base" src="https://img.shields.io/badge/Base-Native-0052FF?style=for-the-badge" />
  <img alt="Safety" src="https://img.shields.io/badge/Execution-Approval%20First-16A34A?style=for-the-badge" />
</p>

![Kyra Agent product preview](public/og-card.png)

## Product Snapshot

Kyra Agent is a backend-connected product demo for creating AI agents that
operate through Telegram and prepare Base-native workflows behind explicit user
approval.

| Area                 | Current Status                                         |
| -------------------- | ------------------------------------------------------ |
| Agent deployment     | Demo agents can be created from templates              |
| Dashboard            | Private workspace view for deployed agents             |
| Public profiles      | Shareable agent identity and capability pages          |
| Telegram             | Live read-only commands and natural planning chat      |
| LLM layer            | Backend-only enrichment for eligible read-only replies |
| Wallet/Base layer    | Phase 6 hardened foundation, execution still gated     |
| Base MCP             | Read-only status provider wired behind backend gate    |
| Onchain transactions | Not live in the current demo                           |

## What Is Live

Phase 5 is complete: Telegram + LLM read-only interaction is live for connected
agent sessions.

Phase 6 is complete as a hardened foundation: wallet readiness, approval
policy, prepared-action review, risk review, signing handoff states, execution
result states, and Telegram execution refusal are modeled without enabling live
wallet prompts or onchain execution.

Kyra can currently:

- Deploy demo agent profiles from templates.
- Persist demo records through the backend.
- Show private dashboard and public agent profile views.
- Reply in Telegram through read-only slash commands.
- Handle bounded natural Telegram chat for planning requests.
- Use backend-only LLM enrichment for eligible read-only replies.
- Show non-executing wallet/Base readiness and review surfaces.
- Prepare a read-only Base MCP status check behind owner-dashboard auth and
  backend runtime gates.
- Refuse wallet, approval, Base MCP, swap, transfer, and onchain execution from
  Telegram.

## Telegram Command Surface

Connected Telegram agents support read-only commands:

| Command    | Purpose                                            |
| ---------- | -------------------------------------------------- |
| `/help`    | Show available commands and plain-text examples    |
| `/status`  | Report Telegram session and execution boundary     |
| `/agent`   | Summarize the deployed agent role and focus        |
| `/actions` | Show read-only actions and gated execution actions |
| `/modules` | Show the deployed template module stack            |
| `/policy`  | Explain the wallet/onchain safety boundary         |

Natural read-only prompts are supported for:

| Prompt Type     | Output                                            |
| --------------- | ------------------------------------------------- |
| Campaign plan   | Launch roadmap, phases, audience, and positioning |
| Market brief    | Read-only market/context summary                  |
| Narrative map   | Story angles and message structure                |
| Launch copy     | Announcement, thread, and CTA drafts              |
| Community pulse | Sentiment and engagement summary                  |
| Risk review     | Checklist-style risk framing                      |

Execution requests are refused from Telegram. Kyra can turn them into a
read-only plan, checklist, or risk review, but it cannot sign, approve, swap,
transfer, or call contracts from Telegram.

## Agent Templates

| Template   | Role                                   |
| ---------- | -------------------------------------- |
| Operator   | Personal wallet readiness agent        |
| Scout      | Recon and launch monitor               |
| Steward    | Project and community agent            |
| Executor   | Rule-based action readiness agent      |
| Strategist | Market and campaign intelligence agent |
| Custom     | User-defined modules and safety limits |

## Module Stack

Templates are the user-facing package. Modules are the internal capability
layer.

| Module   | Capability              |
| -------- | ----------------------- |
| NIRA-01  | Lead orchestration      |
| VEXA-02  | Recon and monitoring    |
| ASTRA-03 | Research and reasoning  |
| NOVA-04  | Data and context        |
| NYX-05   | Security and risk guard |

Different templates can use different module stacks depending on their role.

## Safety Boundary

Kyra is built around approval-first execution.

| Allowed Now                                | Still Gated                         |
| ------------------------------------------ | ----------------------------------- |
| Read-only Telegram commands                | Live wallet prompts                 |
| Natural planning chat                      | Token approvals                     |
| LLM-assisted planning replies              | Base MCP transaction execution      |
| Dashboard and public profiles              | Contract calls                      |
| Demo persistence                           | Live onchain transaction submission |
| Wallet/Base readiness and review surfaces  | Arbitrary swaps or transfers        |
| Read-only Base MCP status check            | Prepared-action production writes   |

Current boundaries:

- No private key custody.
- No seed phrase collection.
- No autonomous fund movement.
- No hidden transaction execution.
- No live wallet signing from Telegram.
- No Base MCP execution from Telegram.
- No live onchain transaction submission in the current demo.
- Owner dashboard sensitive reads are column-scoped.
- Activity log messages are sanitized before display and backend persistence.

Future execution should remain wallet-approved: Kyra can prepare an action, but
the user's wallet must remain the final approval gate.

## Phase 6 Status

Phase 6 focused on the execution foundation without turning execution on:

1. Wallet connection model.
2. Approval policy and signing boundary.
3. Base MCP preparation boundary.
4. Prepared transaction review.
5. User wallet signing handoff model.
6. Onchain execution result states.
7. Telegram execution refusal and future gate design.

Phase 7 starts with pre-execution security audits before any production wallet
prompt, prepared-action write, transaction signing, or transaction submission is
enabled. The first approved runtime step is narrow: a read-only Base MCP status
provider adapter behind backend gates, without prepared-action storage or wallet
execution. See `docs/phase-7-pre-execution-audit.md`.

## Product Principles

- Product first.
- Telegram-native UX.
- Backend-only sensitive integration handling.
- Read-only before execution.
- Wallet approval before onchain action.
- No financial promises.
- No custody.

## Links

| Destination | URL                                |
| ----------- | ---------------------------------- |
| Website     | https://kyraagent.xyz              |
| X           | https://x.com/Kyra_Agent           |
| Repository  | https://github.com/Kyra-Agent/Kyra |
