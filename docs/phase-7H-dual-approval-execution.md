# Phase 7H Dual Approval Execution

Status: complete as a local dual-approval and freeze boundary.

This phase implements the approval order required before Kyra can ever hand a
prepared action toward a Base Account prompt. It does not enable wallet prompts,
wallet signing, transaction submission, transaction hashes, official hosted Base
MCP authority, or production prepared-action writes.

## Product Rule

Kyra approval and Base Account approval are separate decisions.

Required order:

1. A prepared action passes the Phase 7F allowlist and Phase 7G policy review.
2. The owner explicitly approves that exact reviewed action in Kyra.
3. Kyra freezes the reviewed action fields.
4. Any later mutation of route, value, recipient, calldata, or summary rejects
   the action.
5. Only after the action is frozen can the Base Account prompt become a future
   candidate.
6. Runtime wallet prompt, signing, and transaction submission stay disabled
   until a later execution gate.

## Implemented Boundary

The local model is implemented in:

- `src/types/dualApprovalExecution.ts`
- `scripts/test-dual-approval-execution.mjs`
- `scripts/check-phase-7h-dual-approval.mjs`

The model enforces:

- policy review must be `owner_review_required`
- `allowedForStorage` must be true
- the canonical action must be `base_reviewed_transaction`
- owner approval must include an approval id, owner id, and timestamp
- rejected owner decisions never open wallet prompts
- approved actions must have a frozen snapshot
- frozen snapshots fail closed if the reviewed prepared action changes
- Base Account connection and unsigned handoff are separate gates
- wallet execution and wallet signing remain disabled
- official hosted Base MCP authority remains disabled while Phase 7C is no-go

## Dashboard Evidence

The private dashboard now shows a Phase 7H dual approval panel with:

- Kyra approval status
- frozen action status
- Base Account connection requirement
- wallet prompt lock status
- transaction submission disabled text

This is evidence only. The panel does not create prepared-action storage rows,
does not record owner approval, does not open a wallet prompt, and does not
submit a transaction.

## Locked Paths

The following paths remain disabled:

- Telegram-created approval records
- public-page approval
- LLM-triggered approval
- provider-triggered approval
- prepared-action production storage writes
- wallet prompts
- signing
- transaction submission
- transaction hash persistence
- official hosted Base MCP OAuth, tokens, tools, and approval links

## Verification

Required local checks:

```bash
npm run test:dual-approval-execution
npm run check:phase-7h
npm run check:phase-7
npm run build
```

Phase 7H is clear only when the model, dashboard evidence, static checker,
roadmap, and legacy release/rollback audit all pass.

## Next Phase

Phase 7I should focus on result monitoring and closeout modeling only after
this dual approval boundary remains clean.
