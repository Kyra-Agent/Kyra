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
10. Kyra verifies the network receipt, persists only sanitized owner-scoped evidence through the authenticated backend, and closes the window.

## Hard Blocks

- Telegram and public profiles cannot execute.
- No private key, seed phrase, raw provider secret, or Telegram token enters browser state.
- Agent, workspace, wallet, chain, action, approval, and receipt scopes must match.
- Replay, stale timestamps, changed recipients, changed value, changed calldata, chain mismatch, or missing gas fail closed.
- Emergency disable and disconnect invalidate the live window.
- The backend stores only scoped prepared-action and result identifiers, a SHA-256 submission key, transaction hash, fixed Robinhood chain identity, receipt block number, sanitized status, and timestamps. Raw nonces, provider payloads, calldata copies, keys, and tokens are forbidden.
- PostgreSQL validates owner, workspace, and agent scope independently of the Edge Function. Authenticated users have owner-scoped read access only; backend service writes remain private.

## Release Gate

The bounded Robinhood mainnet release evidence, authenticated owner-only closeout, rollback exercise, and explicit release decision are recorded. Release access still means a private, signed-in, per-action owner workflow; it never means Telegram, public-profile, autonomous, token-approval, arbitrary-calldata, or hidden-signing execution. The July 27 hardening candidate replaces browser-authored closeout claims with stored intent plus backend RPC verification and must be deployed before that stronger evidence is described as live.
