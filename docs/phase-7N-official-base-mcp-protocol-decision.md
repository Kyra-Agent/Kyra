# Phase 7N Official Base MCP Protocol Decision

Date: 2026-06-19

Status: protocol split approved locally; official Base MCP authentication and
wallet scopes remain disabled.

## Objective

Determine whether Kyra's `kyra_status_v1` read-only provider adapter can connect
directly to `https://mcp.base.org/`, using only public metadata and
unauthenticated protocol probes.

## Primary-Source Evidence

Observed directly on 2026-06-19:

- `POST https://mcp.base.org/` with an MCP `initialize` request returns HTTP 401,
  `WWW-Authenticate: Bearer realm="mcp"`, and `invalid_token`.
- `https://mcp.base.org/.well-known/oauth-authorization-server` returns OAuth
  metadata for Authorization Code and Refresh Token grants.
- The metadata requires PKCE method `S256` and token endpoint authentication
  method `none`.
- Advertised scopes are `agent_wallet:transact` and `agent_wallet:escalate`.
- `https://mcp.base.org/status-check` returns 404.
- No official Base MCP repository or MCP documentation page was found in the
  public Base GitHub organization listing or Base documentation sitemap.

## Decision

The official endpoint is not compatible with the custom `kyra_status_v1`
adapter. They are separate protocol lanes:

1. **Kyra status provider bridge**: custom, read-only, exact `/status-check`
   contract, no wallet authority, still without an approved provider.
2. **Official Base MCP**: OAuth-protected remote MCP with agent-wallet scopes.
   This requires a separate threat model, consent UX, token lifecycle, MCP
   client, and wallet-authority review before any implementation is enabled.

The existing custom endpoint normalizer now rejects `mcp.base.org`, preventing
the bridge from sending its backend credential or custom payload to the wrong
protocol.

## Explicit Non-Actions

- Do not call the dynamic registration endpoint.
- Do not open the authorization endpoint.
- Do not request access or refresh tokens.
- Do not store OAuth client data or tokens.
- Do not request `agent_wallet:transact` or `agent_wallet:escalate`.
- Do not initialize an authenticated MCP session.
- Do not list or invoke MCP tools.
- Do not create, escalate, sign, or submit wallet actions.

## Required Audit Before Official MCP

- Verify endpoint ownership and current official documentation.
- Document every tool and exact wallet authority it can exercise.
- Design explicit user consent for each requested scope.
- Keep OAuth state, PKCE verifier, access token, and refresh token backend-only
  or in an approved user-controlled flow.
- Encrypt tokens at rest and define rotation, expiry, revocation, and deletion.
- Bind authorization to one authenticated Kyra owner and workspace.
- Prevent Telegram, public profiles, background jobs, and LLM output from
  initiating OAuth or MCP tool calls.
- Add persistent rate limits, replay protection, sanitized logs, and emergency
  kill switches.
- Require a separate approval before registration or authorization begins.

## Verification

- `deno test --quiet supabase/functions/base-mcp-prepare`
- `npm run check:phase-7n`
- `npm run check:phase-7`
- `deno test --quiet supabase/functions`
- `npm run build`
- `git diff --check`

## Done Criteria

- Custom and official protocol lanes cannot be confused.
- `mcp.base.org` cannot be called by the custom adapter.
- Wallet-authority scopes remain unrequested and unstored.
- No OAuth registration, login, token, MCP session, or tool call is created.
- Production gates remain disabled.
