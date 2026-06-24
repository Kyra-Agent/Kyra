# Phase 7D Base Account Connection Runtime

Date: 2026-06-24

Status: production connection clear. Owner-click Base Account connection is
deployed and owner-smoked. Signing and transaction execution remain disabled.

## Scope

Phase 7D enables one owner-initiated Base Account connection from the private
dashboard for one selected persisted agent.

The connection is browser-session-only and binds:

```text
authenticated owner + workspace + selected deployed agent + Base Account
```

## Runtime Contract

- Base Account is the only enabled connector.
- The connector mounts without opening a prompt.
- `reconnectOnMount` remains `false`.
- Wagmi persistence is disabled with `storage: null`.
- Only an explicit owner click can call `connectAsync`.
- Supabase owner session freshness is checked before the wallet prompt.
- Owner, workspace, and agent identifiers must be canonical UUIDs.
- The returned connector must be exactly `baseAccount`.
- The returned chain must be exactly Base chain ID `8453`.
- The returned address is held only in React memory and shown masked.
- Changing owner, workspace, or selected agent disconnects the binding.
- Account, connector, or chain drift disconnects and fails closed.
- Explicit disconnect clears the browser-session binding.

## Still Disabled

- prepared-action production writes
- wallet signing
- token approvals
- transaction submission
- automatic reconnect
- address persistence
- Telegram wallet actions
- public-page wallet actions
- background or LLM-triggered prompts
- official hosted MCP OAuth, tokens, sessions, tools, or approval links

## Privacy

No wallet address, provider payload, owner identifier, workspace identifier,
or agent identifier is logged or written by the connection component. Kyra
stores no private key, seed phrase, wallet credential, or signing material.

## Verification

- `npm run test:base-account-connection`
- `npm run check:phase-7d-connection`
- `npm run check:phase-7`
- `npm run build`

Verification result:

- full Phase 7 suite passed
- production TypeScript and Vite build passed
- signed-out desktop and 390 px mobile dashboard review passed
- no page-load wallet dialog or console error was observed
- no wallet-related browser storage key was created
- controlled authenticated-owner connection smoke passed
- Netlify production deploy for `7f96f16` is ready
- Netlify secret scan reported no matches
- production dashboard returned `200 OK`
- Supabase linked project and remote Edge Functions remained active

## Done Criteria

- Owner-only explicit Base Account connect exists in the private dashboard.
- Connection binds exactly one owner/workspace/agent target in memory.
- Target drift and wallet drift fail closed by disconnecting.
- Signing and transaction execution remain disabled.
- Official hosted MCP remains independently disabled.
- Tests, structural guards, and production build pass.
- A controlled owner connection smoke must pass before deployment approval.
