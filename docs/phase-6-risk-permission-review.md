# Phase 6 Risk And Permission Review

Status: local model implemented. No wallet signing, Base MCP execution, or
Telegram execution is enabled.

## Goal

NYX-05 must classify every prepared action before any wallet prompt can open.
Unsupported action types must fail closed.

## Risk Levels

| Level       | Meaning                                                                     |
| ----------- | --------------------------------------------------------------------------- |
| `read-only` | Reads context only; no wallet prompt, no spend, no calldata.                |
| `low`       | Signable review exists, but no token spend or contract calldata indicators. |
| `medium`    | Token spend or contract-call indicator exists.                              |
| `high`      | Token spend and contract-call indicators both exist.                        |
| `blocked`   | Unsupported, invalid, wrong-chain, expired, or unsafe action.               |

## Permission Labels

| Permission      | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `read_context`  | Read-only context lookup.                                            |
| `wallet_prompt` | Would require explicit owner wallet prompt in a future enabled path. |
| `token_spend`   | Value or copy implies token movement/spend.                          |
| `contract_call` | Calldata or route implies contract interaction.                      |
| `unknown`       | Action cannot be classified safely and must be blocked.              |

## Current Implementation

- `src/types/riskReview.ts` owns the pure risk model.
- `scripts/test-risk-review.mjs` covers read-only, medium, high, wrong-chain,
  and unsupported fail-closed behavior.
- `WalletApprovalModal` surfaces NYX-05 level, permissions, checks, and safety
  copy before the unsigned handoff review.
- `npm run check:phase-6` includes the risk review test.

## Boundaries

- No provider call.
- No wallet prompt.
- No signing.
- No transaction submission.
- No Telegram bypass.
- Unsupported action kinds return `blocked` before any wallet surface can open.
