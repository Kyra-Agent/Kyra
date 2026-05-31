# KYRA-AGENT

Kyra is a frontend demo for a Base-native onchain agent deployment console.

The demo shows the intended product flow:

1. Choose an agent template.
2. Configure a Telegram-native agent.
3. Connect a Base Account or wallet.
4. Prepare onchain actions through Base MCP.
5. Require wallet approval before any transaction.

This repository is demo-only. It does not execute real transactions, store wallet keys, or require real Telegram bot tokens.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Security notes

- Never commit `.env` files.
- Never enter or store seed phrases or private keys.
- User-facing transactions should always require wallet approval.
- Telegram bot tokens, OAuth tokens, API keys, and database secrets must stay in environment variables.
