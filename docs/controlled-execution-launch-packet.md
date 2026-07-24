# Controlled Execution Launch Packet

## Purpose

This packet defines the only acceptable route from an agent recommendation to a Robinhood Chain transaction.

## Required Sequence

1. The user signs in to a private Kyra workspace.
2. The user selects a deployed agent.
3. The user connects a compatible EVM wallet on the agent's Robinhood network.
4. Kyra prepares an allowlisted action with bounded value and calldata.
5. NYX-05 completes risk review.
6. The owner reviews and explicitly approves the frozen action.
7. A short-lived owner window is armed.
8. The wallet displays its own confirmation prompt.
9. The wallet signs and submits.
10. Kyra records a sanitized receipt and closes the window.

## Hard Blocks

- Telegram and public profiles cannot execute.
- No private key, seed phrase, raw provider secret, or Telegram token enters browser state.
- Agent, workspace, wallet, chain, action, approval, and receipt scopes must match.
- Replay, stale timestamps, changed recipients, changed value, changed calldata, chain mismatch, or missing gas fail closed.
- Emergency disable and disconnect invalidate the live window.

## Release Gate

Public submission is not claimed live until one bounded Robinhood mainnet receipt is verified, sanitized persistence is confirmed, rollback is exercised, and the release decision is recorded. Agent deployment, Telegram, wallet connection, risk review, and prepared-action review remain production-capable independently of that final submit gate.
