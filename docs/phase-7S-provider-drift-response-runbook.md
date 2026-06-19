# Phase 7S Provider Drift Response Runbook

Date: 2026-06-19

Status: local runbook and guard complete. Official Base MCP OAuth, token
storage, MCP sessions, tools, wallet authority, and execution remain disabled.

## Objective

Define the only approved response path when the Phase 7R provider evidence
monitor reports semantic drift from the reviewed Base MCP baseline.

Drift is evidence that the provider contract changed. It is not approval to
connect wallets, request scopes, store tokens, initialize MCP, call tools, or
enable execution.

## Drift Severity

### Critical Drift

Treat drift as critical when any of these change:

- a new authorization issuer
- a changed authorization endpoint
- a changed token endpoint
- a changed registration endpoint
- changed PKCE support
- changed token endpoint authentication mode
- new or removed wallet-authority scopes
- Protected Resource Metadata becomes available
- Protected Resource Metadata advertises scopes
- official docs add scope-to-tool mapping
- official docs define escalation semantics

Critical drift blocks all OAuth implementation work until Phase 7O and Phase
7Q are re-run and owner approval is captured.

### Caution Drift

Treat drift as caution when only non-authority evidence changes:

- documentation corpus hash changes without new capability signals
- bounded content length changes
- a source returns temporary non-success status
- content type changes without usable metadata

Caution drift still blocks baseline updates until reviewed manually.

## Response Flow

1. Run `npm run observe:base-mcp-provider`.
2. Save the sanitized JSON output outside commits unless owner asks to preserve
   it as evidence.
3. Confirm no request followed redirects or touched `/authorize`, `/register`,
   `/token`, MCP session, tool, wallet, or transaction endpoints.
4. Classify each drift path as critical or caution.
5. Re-read the current official sources manually.
6. Re-run `npm run check:phase-7o` and `npm run check:phase-7q`.
7. If scopes, consent, or metadata changed, update the threat model and scope
   qualification before any implementation work.
8. Update `docs/phase-7R-base-mcp-provider-baseline.json` only after owner
   approval.
9. Run `npm run test:phase-7r`, `npm run check:phase-7r`, and
   `npm run check:phase-7s`.
10. Run the full Phase 7 check suite, function tests, build, whitespace check,
    and secret scan before any commit.

## Hard Stops

Any critical drift keeps these blocked:

- OAuth client endpoint implementation
- authorization redirects
- dynamic client registration
- token exchange
- refresh token handling
- token storage
- MCP session initialization
- tool discovery
- tool invocation
- wallet prompts
- signatures
- approvals
- swaps
- transfers
- contract calls
- Telegram-created drafts
- Telegram-triggered execution

No drift response may change runtime environment gates, database schema, RLS,
Supabase secrets, Netlify settings, Telegram webhook behavior, or public
dashboard behavior.

## Baseline Update Rules

Baseline updates are allowed only when:

- drift has been classified
- official source URLs are documented
- wallet-authority impact is understood
- Phase 7O and 7Q conclusions are updated or confirmed unchanged
- owner approval is explicit
- the update is manual and reviewed

Baseline updates must not include raw provider bodies, cookies, tokens,
authorization codes, PKCE verifiers, wallet addresses, Telegram tokens,
Supabase sessions, transaction payloads, or private user identifiers.

## Owner Summary Format

When reporting drift to the owner, use this bounded format:

```text
Provider evidence drift detected.
Severity: critical|caution
Changed paths:
- path

Impact:
- blocked|no runtime impact

Required before enablement:
- Phase 7O re-check
- Phase 7Q re-check
- owner approval
- full local verification
```

Do not paste raw provider responses or secrets into chat, commits, issues, or
public docs.

## Files

- Monitor: `scripts/observe-base-mcp-provider.mjs`
- Monitor tests: `scripts/test-phase-7r-provider-monitor.mjs`
- Monitor guard: `scripts/check-phase-7r-provider-monitor.mjs`
- Baseline: `docs/phase-7R-base-mcp-provider-baseline.json`
- This runbook: `docs/phase-7S-provider-drift-response-runbook.md`
- Runbook guard: `scripts/check-phase-7s-provider-drift-response.mjs`

## Verification

- `npm run observe:base-mcp-provider`
- `npm run test:phase-7r`
- `npm run check:phase-7r`
- `npm run check:phase-7s`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Drift severity is documented.
- Critical drift keeps official OAuth and execution blocked.
- Response flow requires Phase 7O and 7Q re-checks.
- Baseline update rules require owner approval.
- Owner summary format is bounded and non-secret.
- Automated checker is included in `npm run check:phase-7`.
- No schema, OAuth runtime, token storage, MCP session, tool, wallet prompt,
  signature, transaction, Telegram execution, deploy, or push occurred.
