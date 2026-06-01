# KYRA-AGENT

Kyra Agent is a backend-connected demo for a Base-native onchain agent console.

It shows the intended product flow: choose an agent template, configure a Telegram-native agent, connect a wallet or Base Account, prepare onchain actions through a Base MCP-style layer, and require wallet approval before anything is executed.

## Demo Status

This repository is still demo-only, but the Phase 2 Supabase path is active.

- No real transactions are executed.
- No wallet keys, seed phrases, or private keys are stored.
- No real Telegram bot token is required.
- Supabase can provide auth, template catalog, dashboard records, public agent profiles, and persisted demo receipts.
- Base MCP, Telegram, and wallet execution are still simulated.
- Every onchain action is framed as wallet-approved, never custodial.
- `supabase/functions/deploy-agent` is scaffolded as the server-side deploy boundary. The frontend prefers it when configured and falls back to RLS-backed demo writes while the function is not deployed.

## Routes

- `/` - main landing and demo console.
- `/dashboard` - private operator dashboard preview.
- `/agents/:agent-slug` - public agent profile preview.

## Demo Data Shape

The app can run in mock mode or Supabase-backed demo mode:

- `src/types/backend.ts` defines workspace, agent instance, approval request, wallet policy, activity log, and table summary types.
- `src/data/demoBackend.ts` keeps local fallback records for dashboard, public agent preview, and deploy flow.
- `src/services` reads Supabase templates, auth sessions, dashboard records, public agent profiles, and persisted demo deploy receipts when configured.
- `src/services/supabaseDeployService.ts` calls `deploy-agent` first, then falls back to direct RLS demo writes if the function is unavailable.
- `docs/backend-blueprint.md` outlines the Supabase/Auth/logs/approval plan for the demo backend phase.
- `supabase/schema.sql` and `supabase/seed.sql` provide the Supabase demo schema and template catalog.
- `supabase/functions/deploy-agent` contains the server-side deploy function scaffold for the next backend step.
- `docs/backend-demo-skeleton.md` explains how the demo backend should be enabled safely.

## Local Development

```bash
npm install
npm run dev
```

Vite serves the app locally, usually at `http://127.0.0.1:5173` unless that port is already in use.

For Supabase-backed demo mode, set:

```bash
VITE_KYRA_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_KYRA_DEPLOY_FUNCTION_URL=https://your-project.supabase.co/functions/v1/deploy-agent
```

## Build

```bash
npm run build
```

The production output is generated in `dist/`.

## Netlify Notes

When this is ready to publish:

- Build command: `npm run build`
- Publish directory: `dist`
- Static config: `netlify.toml` is included.
- SPA fallback: `public/_redirects` and Netlify redirects are included.
- Social preview: `public/og-card.svg` is wired into the page metadata.

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
- Phase 2: Demo backend with Supabase auth, database records, deploy receipts, and Edge Function scaffold.
- Phase 3: Telegram bot integration and Base MCP action preparation.
- Phase 4: Live wallet-approved execution with full security hardening.

## Security Notes

- Never commit `.env` files.
- Never enter or store seed phrases or private keys.
- Keep Telegram bot tokens, OAuth tokens, API keys, and database secrets in environment variables.
- Treat the wallet as the final approval gate for every user-facing transaction.
