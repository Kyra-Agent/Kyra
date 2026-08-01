# Protected Swap Provider Qualification

Status: T2 is deployed default-off and unreleased. This runbook does not authorize
wallet prompts or transaction submission.

## Fixed Contract

- Network: Robinhood Chain mainnet, chain ID `4663`.
- Pair: native ETH and official KYRA only.
- KYRA token: `0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1`.
- Provider API: 0x Swap API v2 AllowanceHolder quote endpoint.
- Provider access: backend-only through the authenticated Supabase Edge Function.
- Scope: signed-in user, workspace, selected agent, connected wallet, chain,
  request, quote, and expiry must match.
- Public profiles and Telegram cannot request approvals, wallet prompts, or
  transaction submission.
- All release flags remain off until every gate below passes.

Official references:

- [0x supported chains](https://docs.0x.org/docs/introduction/supported-chains)
- [0x Swap API v2 upgrade contract](https://docs.0x.org/docs/upgrading/upgrading-to-swap-v2)
- [0x AllowanceHolder quickstart](https://docs.0x.org/docs/introduction/quickstart/swap-tokens-with-0x-swap-api)
- [0x contract guidance](https://docs.0x.org/docs/core-concepts/contracts)
- [Robinhood Chain connection parameters](https://docs.robinhood.com/chain/connecting/)

## Gate 1 - Default-Off Baseline

1. Confirm `VITE_KYRA_PROTECTED_SWAP_ENABLED=false`.
2. Confirm `KYRA_PROTECTED_SWAP_EXECUTION_ENABLED=false`.
3. Run `npm run check:protected-swap-provider-config`.
4. Confirm the linked migration history is synchronized.
5. Confirm `swap-quote-prepare`, `swap-execution-prepare`, and
   `swap-result-closeout` are active with JWT verification.
6. Confirm unauthenticated, wrong-workspace, wrong-agent, and wrong-wallet
   requests fail closed.

No provider secret is required for this baseline gate.

## Gate 2 - Provider Qualification

1. Create a dedicated production 0x API key for Kyra. Do not reuse a personal or
   unrelated application key.
2. Store the key only as the Supabase secret `KYRA_ZEROX_API_KEY`.
3. Keep every allowlist secret unset until actual low-value quote evidence is
   collected for both ETH-to-KYRA and KYRA-to-ETH.
4. Request each quote through the authenticated backend function with execution
   still disabled.
5. Record only sanitized candidates:
   - transaction target
   - AllowanceHolder target, when ERC-20 allowance is required
   - liquidity source names
   - chain ID, pair direction, timestamp, and pass/fail outcome
6. Compare candidates across repeated quotes and both directions. Verify the
   current 0x documentation again before accepting any address.
7. Configure exact comma-separated allowlists:
   - `KYRA_ZEROX_SWAP_ALLOWED_TARGETS`
   - `KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS`
   - `KYRA_ZEROX_ALLOWED_SOURCES`
8. Run `npm run check:protected-swap-provider-config -- --require-provider`
   in a secure shell with the production values loaded.
9. Never approve the 0x Settler as an ERC-20 spender. Allowance must target the
   provider-returned AllowanceHolder and remain exact, never unlimited.

Do not publish the API key, complete quote payload, raw calldata, wallet address,
or internal record identifiers.

## Gate 3 - Fail-Closed Matrix

Verify all of these cases are rejected before any wallet prompt:

- unsupported chain, asset, direction, or amount
- missing or partial provider configuration
- provider timeout, redirect, malformed JSON, oversized response, or no liquidity
- unexpected transaction target, allowance target, or liquidity source
- duplicate, zero-address, oversized, or malformed allowlist entries
- wrong taker, changed recipient, changed value, changed calldata, or changed
  minimum output
- stale quote, changed wallet, changed agent, changed workspace, or replay
- incomplete simulation, insufficient balance, or provider issue flags
- unlimited allowance, arbitrary calldata, public invocation, or Telegram
  invocation

Run `npm run test:protected-swap` and the full product suite before canary.

## Gate 4 - Owner-Controlled Canary

1. Obtain an explicit release decision for one bounded canary.
2. Keep the frontend flag off.
3. Enable the backend execution flag only for the controlled canary window.
4. Sign in to the private workspace, select the intended agent, and connect the
   intended Robinhood Chain wallet.
5. Review the exact pair, amount, minimum output, allowance target, transaction
   target, expiry, and estimated gas in the wallet.
6. Submit one low-value transaction only after the wallet display matches the
   frozen backend review.
7. Verify the transaction and receipt through the backend RPC verifier.
8. For a KYRA sell, verify exact allowance cleanup or revoke-to-zero completion.
9. Store only sanitized owner-scoped closeout evidence.
10. Close the canary window and return the backend execution flag to `false`.

Abort immediately on provider drift, wallet disagreement, receipt mismatch,
unexpected allowance, delayed finality, or missing cleanup.

## Gate 5 - Release Decision

The frontend flag may be enabled only after:

- both quote directions pass provider qualification
- the fail-closed matrix and full regression suite pass
- the bounded canary and receipt verification pass
- allowance cleanup and rollback are verified
- monitoring and support owners are recorded
- an explicit release decision records supported assets, exact allowlists,
  limits, and emergency controls

Until then, product copy must say that the protected swap foundation is deployed
default-off and unreleased.

## Rollback

1. Set the frontend and backend protected-swap flags to `false`.
2. Revoke or rotate the dedicated provider key if provider access is suspect.
3. Remove untrusted allowlist entries.
4. Revoke any remaining exact allowance to zero through the reviewed cleanup
   path.
5. Close active submission windows and disconnect the affected wallet session.
6. Preserve sanitized owner-only evidence and record the incident decision.
7. Re-run the baseline, privacy, protected-swap, and product checks before any
   new qualification attempt.
