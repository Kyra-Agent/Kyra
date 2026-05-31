# KYRA-AGENT

Kyra Agent is a frontend demo for a Base-native onchain agent console.

It shows the intended product flow: choose an agent template, configure a Telegram-native agent, connect a wallet or Base Account, prepare onchain actions through a Base MCP-style layer, and require wallet approval before anything is executed.

## Demo Status

This repository is currently frontend-only.

- No real transactions are executed.
- No wallet keys, seed phrases, or private keys are stored.
- No real Telegram bot token is required.
- Base MCP, Telegram, auth, database, and execution logs are represented as demo UI.
- Every onchain action is framed as wallet-approved, never custodial.

## Routes

- `/` - main landing and demo console.
- `/dashboard` - private operator dashboard preview.
- `/agents/operator-demo` - public agent profile preview.

## Local Development

```bash
npm install
npm run dev
```

Vite serves the app locally, usually at `http://127.0.0.1:5173` unless that port is already in use.

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Netlify Notes

When this is ready to publish:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA fallback: `public/_redirects` is already included.

## Product Flow

1. Choose an agent template: Operator, Scout, Steward, Executor, Launcher, or Custom.
2. Configure the agent name, enabled actions, and public identity.
3. Link a Telegram command surface.
4. Connect a wallet or Base Account.
5. Prepare onchain actions through the Kyra/Base MCP layer.
6. Route every transaction through wallet approval.
7. Monitor the deployed agent from the Kyra dashboard.

## Roadmap

- Phase 1: Frontend demo, responsive UI, dashboard preview, public agent route.
- Phase 2: Demo backend with auth, database records, and server-side logs.
- Phase 3: Telegram bot integration and Base MCP action preparation.
- Phase 4: Live wallet-approved execution with full security hardening.

## Security Notes

- Never commit `.env` files.
- Never enter or store seed phrases or private keys.
- Keep Telegram bot tokens, OAuth tokens, API keys, and database secrets in environment variables.
- Treat the wallet as the final approval gate for every user-facing transaction.
