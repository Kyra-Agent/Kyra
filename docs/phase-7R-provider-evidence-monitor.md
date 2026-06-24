# Phase 7R Official Base MCP Provider Evidence Monitor

Date: 2026-06-19

Status: local read-only monitor complete. Official OAuth, scopes, tokens,
sessions, tools, wallet authority, and execution remain disabled.

## Objective

Provide a repeatable operator-only check that detects changes in the official
Base MCP public metadata and documentation without touching authorization,
registration, token, MCP session, wallet, or transaction endpoints.

The monitor does not approve a provider. It reports evidence drift and keeps
the product blocked pending manual security review.

## Fixed Public Sources

The monitor can request only:

- `https://mcp.base.org/.well-known/oauth-authorization-server`
- `https://mcp.base.org/.well-known/oauth-protected-resource`
- `https://mcp.base.org/.well-known/oauth-protected-resource/mcp`
- `https://mcp.base.org/mcp`
- `https://docs.base.org/llms-full.txt`
- `https://docs.base.org/agents/llms-full.txt`

The URL allowlist is exact. Query strings, fragments, embedded credentials,
HTTP, arbitrary hosts, and caller-provided URLs are rejected.

## Network Contract

- GET only.
- No request body.
- No `Authorization` header.
- No cookie header or credential mode.
- No redirect following.
- Unauthenticated GET to `/mcp` is allowed only to read the bearer challenge.
- No calls to `/authorize`, `/register`, `/token`, MCP initialize, tool
  discovery, tool invocation, approval links, wallet APIs, or RPC endpoints.
- Eight-second timeout per source.
- 16 KiB limit per metadata response.
- 1 MiB limit for the public documentation index corpus.
- 256 KiB limit for the public agent documentation corpus.
- Exact allowlisted success content types: JSON for metadata, plain text for
  the docs index, and the official text/octet-stream response variants for the
  agent corpus.
- Non-success bodies are not interpreted as metadata.

The monitor does not persist response cookies, provider bodies, secrets, or
tokens.

## Sanitized Report

The report contains:

- observation timestamp
- bounded HTTP status and content type
- response byte count and SHA-256 evidence hash
- normalized public authorization metadata
- normalized protected-resource availability and scopes
- bounded documentation capability signals
- deterministic blockers
- baseline drift paths

It does not output:

- response headers such as `Set-Cookie`
- raw provider body
- authorization code, state, PKCE verifier, token, wallet address, transaction,
  Telegram token, Supabase session, or user identity

## Baseline Decision

The tracked baseline records the reviewed public contract:

- authorization metadata available
- PKCE S256
- public token endpoint authentication method `none`
- advertised scopes `agent_wallet:transact` and `agent_wallet:escalate`
- both tested Protected Resource Metadata locations unavailable
- the unauthenticated `/mcp` challenge returns bearer realm `mcp` without
  `resource_metadata` or scope guidance
- read and write product guides documented
- arbitrary calldata through `send_calls` documented
- reviewed write tool names documented
- exact scope-to-tool mapping absent
- escalation semantics absent
- authoritative MCP input schemas absent
- complete approval lifecycle contract absent
- complete OAuth token lifecycle contract absent

The baseline excludes timestamps, raw content, response cookies, and content
hashes from equality decisions. Hashes remain in live output as supporting
evidence, while semantic fields drive drift.

## Drift Behavior

`npm run observe:base-mcp-provider`:

- exits `0` when semantic evidence matches the reviewed baseline
- exits `2` when evidence changes
- prints a sanitized JSON report in both cases

Any drift is review-required, not auto-approved. New read-only scopes, metadata,
tools, or better documentation do not enable OAuth automatically.

The monitor must never:

- modify the baseline automatically
- write environment variables or secrets
- change runtime gates
- create a database record
- trigger a deployment
- run from the browser, Telegram, public agent pages, or an LLM tool call

## Current Live Observation

Latest local observation on 2026-06-24:

- baseline match: true
- decision: blocked
- protected resource metadata: unavailable
- advertised wallet-authority scopes: `agent_wallet:transact`,
  `agent_wallet:escalate`
- `/mcp` challenge: bearer realm `mcp`, no `resource_metadata`, no scope
  guidance
- documentation: read and write guides present, but exact scope-to-tool mapping
  and escalation semantics remain unverified
- authoritative input schemas, approval lifecycle guarantees, and OAuth token
  lifecycle guarantees remain unverified

This confirms the current Phase 7C no-go decision. No Phase 7D wallet,
OAuth, token storage, MCP session, or execution implementation may start from
this evidence.

## Baseline Update Procedure

1. Run the monitor manually.
2. Review every reported drift against current official sources.
3. Re-run the Phase 7O threat model and Phase 7Q scope qualification.
4. Update the baseline manually only after owner approval.
5. Run the monitor tests, full Phase 7 checks, function tests, build, and secret
   scan.
6. Keep all OAuth and execution gates disabled unless a later implementation
   phase receives separate approval.

## Files

- Monitor: `scripts/observe-base-mcp-provider.mjs`
- Tests: `scripts/test-phase-7r-provider-monitor.mjs`
- Baseline: `docs/phase-7R-base-mcp-provider-baseline.json`
- Structural checker: `scripts/check-phase-7r-provider-monitor.mjs`

## Verification

- `npm run test:phase-7r`
- `npm run check:phase-7r`
- `npm run observe:base-mcp-provider`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Exact public source allowlist exists.
- Sensitive OAuth and execution endpoints cannot be called.
- Redirects, oversized responses, and unexpected content types fail closed.
- Output is sanitized and baseline drift is deterministic.
- Mocked tests prove no credentials, body, or sensitive endpoint is used.
- Live observation matches or reports explicit drift without changing state.
- No schema, OAuth runtime, scope, token, session, tool, wallet prompt,
  signature, transaction, deploy, or push occurred.
