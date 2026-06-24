# Phase 7F Prepared-Action Adapter Allowlist

Date: 2026-06-24

Status: complete as a deterministic allowlist boundary.

## Purpose

Phase 7F defines the first Kyra prepared-action adapter allowlist. It converts
bounded owner-dashboard intent into a canonical action shape or fails closed.

This phase does not enable wallet signing, token approval, swaps, transfers,
contract calls, transaction submission, provider tool invocation, or production
prepared-action persistence.

Wallet signing and transaction submission remain disabled.

## Trusted Source

Only the private owner dashboard is a trusted source.

Telegram, LLM output, provider output, plugins, and public pages are untrusted.
They can request a read-only brief or checklist, but they cannot create a
prepared action, approval, wallet prompt, Base MCP request, signature, or
transaction.

## Allowlisted Kinds

The Phase 7F allowlist is implemented in `src/types/preparedAction.ts`.

Allowed action kinds:

- `base_mcp_status_check`
- `base_reviewed_transaction`

`base_mcp_status_check` is read-only and canonicalizes to:

- chain: Base
- value: `0`
- calldata: `0x`
- recipient: none
- risk: read-only
- wallet required: false

`base_reviewed_transaction` is a review schema only in Phase 7F. It requires:

- source: owner dashboard
- chain: Base, chain id `8453`
- EVM recipient format
- safe non-negative wei value format
- hex calldata format
- bounded route summary
- bounded value summary

Additional Phase 7F locks:

- Token spend is blocked in Phase 7F.
- Calldata is blocked in Phase 7F.
- Wallet execution disabled blocks review transactions.

## Fail-Closed Rules

The allowlist returns a blocked result when any of these conditions appears:

- unknown action kind
- untrusted source
- schema mismatch
- non-Base chain
- invalid recipient
- invalid value
- invalid calldata
- non-empty calldata
- token spend
- disabled wallet execution gate

No raw provider payload, raw calldata, wallet secret, private key, seed phrase,
Telegram token, API key, or transaction hash is accepted by the browser-safe
prepared-action contract.

## Dashboard Evidence

The private dashboard now shows the PreparedAction Allowlist boundary inside
the Base MCP prep panel:

- trusted source: owner dashboard
- allowed kinds: status check and reviewed transaction
- token spend: blocked in 7F
- calldata: blocked in 7F
- untrusted inputs: Telegram, LLM, provider blocked

The dashboard evidence is informational and does not open a wallet prompt.

## Validation

Required checks:

- `npm run test:prepared-action-allowlist`
- `npm run check:phase-7f`
- `npm run check:phase-7`

The Phase 7F check keeps the older Telegram execution boundary audit active and
adds the prepared-action allowlist guard.

## Remaining Locked Paths

Still disabled after Phase 7F:

- owner-scoped prepared-action production writes
- NYX-05 bound risk review persistence
- Kyra owner approval writes
- wallet prompt eligibility success
- Base Account signing
- transaction submission
- transaction hash persistence
- official hosted Base MCP OAuth/tool authority

Proceed to Phase 7G only after this allowlist remains green.
