# Kyra Agent

Kyra Agent is a Base-native AI agent console for deploying Telegram-native
agents with approval-first onchain workflows.

Live demo: https://kyraagent.xyz

X: https://x.com/Kyra_Agent

Repository: https://github.com/Kyra-Agent/Kyra

## Product Status

Kyra is currently a backend-connected product demo.

Phase 5 is complete: Telegram + LLM read-only interaction is live for connected
agent sessions.

Kyra can:

- Deploy demo agent profiles from templates.
- Persist demo records through the backend.
- Show private dashboard and public agent profile views.
- Reply in Telegram through read-only slash commands.
- Handle bounded natural Telegram chat for planning requests.
- Use backend-only LLM enrichment for eligible read-only replies.
- Refuse wallet, approval, Base MCP, swap, transfer, and onchain execution from
  Telegram.

Kyra does not currently execute live onchain transactions.

## What Kyra Does

Kyra turns agent deployment into a product flow:

1. Choose an agent template.
2. Configure the agent identity and capabilities.
3. Deploy a persisted demo agent.
4. Open the dashboard and public profile.
5. Use Telegram as the read-only command and planning interface.
6. Keep wallet approval and onchain execution gated for the next phase.

The goal is simple: deploy AI agents that can understand context, operate
through Telegram, and prepare Base-native actions without taking custody of user
funds.

## Live Telegram Layer

Connected Telegram agents support read-only commands:

- `/help`
- `/status`
- `/agent`
- `/actions`
- `/modules`
- `/policy`

They also support natural read-only planning prompts, such as:

- campaign plan
- market brief
- narrative map
- launch copy
- community pulse
- risk review

Execution requests are refused from Telegram. Kyra can help turn them into a
read-only plan, checklist, or risk review, but it cannot sign, approve, swap,
transfer, or call contracts from Telegram.

## Agent Templates

Kyra ships with six product templates:

- **Operator** - personal wallet action agent.
- **Scout** - recon and launch monitor.
- **Steward** - project and community agent.
- **Executor** - rule-based action agent.
- **Strategist** - market and campaign intelligence agent.
- **Custom** - user-defined agent modules and safety limits.

## Module Stack

Templates are the user-facing package. Modules are the internal capability
layer.

- **NIRA-01** - lead orchestration.
- **VEXA-02** - recon and monitoring.
- **ASTRA-03** - research and reasoning.
- **NOVA-04** - data and context.
- **NYX-05** - security and risk guard.

Different templates can use different module stacks depending on their role.

## Safety Boundary

Kyra is built around approval-first execution.

Current boundaries:

- No private key custody.
- No seed phrase collection.
- No autonomous fund movement.
- No hidden transaction execution.
- No live wallet signing from Telegram.
- No Base MCP execution from Telegram.
- No live onchain transaction submission in the current demo.

Future execution should remain wallet-approved: Kyra can prepare an action, but
the user's wallet must remain the final approval gate.

## Phase 6 Direction

The next product phase focuses on the execution layer:

1. Wallet connection model.
2. Approval policy and signing boundary.
3. Base MCP integration.
4. Prepared transaction review.
5. User wallet signing.
6. Onchain execution audit logs.
7. Telegram execution gates only after wallet approval is safe.

## Product Principles

- Product first.
- Telegram-native UX.
- Backend-only sensitive integration handling.
- Read-only before execution.
- Wallet approval before onchain action.
- No financial promises.
- No custody.

## Current Links

- Website: https://kyraagent.xyz
- X: https://x.com/Kyra_Agent
- GitHub: https://github.com/Kyra-Agent/Kyra
