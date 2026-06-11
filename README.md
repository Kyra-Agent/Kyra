# KYRA-AGENT

Kyra Agent is a backend-connected Base agent console demo for approval-first onchain workflows. It lets a user choose an agent template, configure a Telegram-style agent identity, deploy a persisted demo agent, and inspect dashboard/public profile records before live Telegram and wallet-approved Base execution are connected.

Live demo: https://kyraagent.xyz

Core positioning:

```text
Deploy Base agents with approval-first onchain workflows.
```

Current caveat: the product is still a backend-connected demo. It shows the product flow and persistence model, but it does not execute live onchain transactions.

## Current Status

Kyra is in the production-safe backend-connected demo phase.

- No real transactions are executed.
- No private keys, seed phrases, or wallet custody are used.
- No real Telegram bot token is required in the browser.
- Base MCP, Telegram webhooks, and wallet execution are simulated.
- Supabase can provide auth, template catalog, dashboard records, public agent profiles, activity logs, and persisted demo deploy receipts.
- The `deploy-agent` Supabase Edge Function is the preferred server-side deploy boundary when configured.
- The `reset-demo-workspace` Supabase Edge Function is the admin-only reset boundary when deployed.
- Production demo writes are intended to be Edge-only; authenticated browser clients should only read their own dashboard records.
- Frontend demo fallback remains available when Supabase is not configured.
- Phase 4 production smoke passed for signed-out, admin, and non-admin demo flows.

## Core Flow

1. Choose an agent template.
2. Configure the agent name and enabled actions.
3. Link the simulated Telegram command surface.
4. Confirm wallet approval policy.
5. Deploy a demo agent.
6. Review the deploy receipt.
7. Open the private dashboard and public agent route.
8. Later phases connect real Telegram and wallet-approved Base execution.

## Agent Templates

- **Operator** - personal wallet action agent.
- **Scout** - recon and launch monitor.
- **Steward** - project and community agent.
- **Executor** - rule-based action agent.
- **Strategist** - market and campaign intelligence agent.
- **Custom** - user-defined agent modules and safety limits.

## Features

- Terminal/onchain console interface.
- Responsive landing and dashboard UI.
- Template catalog with Supabase or local fallback data.
- Demo deploy wizard with receipt source labeling.
- Supabase email/password auth for demo workspace ownership.
- Demo agent quota guard, currently `3` agents per workspace.
- Dashboard records for agents, approvals, wallet policies, backend tables, and logs.
- Admin-only reset action with confirmation for signed-in demo workspace records.
- Public agent profile route for deployed demo agents.
- Explicit expired/unavailable state for stale public agent routes.
- Session refresh guard before dashboard fetch, deploy, and reset operations.
- Demo-safe safety copy throughout the product flow.

## Tech Stack

- React 18
- TypeScript
- Vite
- Lucide React icons
- Supabase Auth
- Supabase Postgres + RLS
- Supabase Edge Functions
- Vercel-ready static build config
- Netlify static build config retained as a fallback

## Supabase And Edge Function Role

Supabase is used for the demo backend layer:

- Auth session ownership for demo workspaces.
- Template catalog rows.
- Agent instance records.
- Approval request records.
- Wallet policy records.
- Activity logs.
- Public agent profiles via a share-safe view.
- Edge Function deploy boundary at `supabase/functions/deploy-agent`.
- Admin-only reset boundary at `supabase/functions/reset-demo-workspace`.

The frontend prefers the Edge Function when it is configured. Production demo writes should go through Edge Functions only. The development-only REST fallback is for isolated local/dev databases with write grants; it should fail against the production project after the write-lockdown SQL is applied. Service role keys must stay server-side inside Supabase Function secrets only.

## Demo Safety Notes

Kyra's current demo mode is intentionally limited:

- No private key input.
- No seed phrase input.
- No wallet custody.
- No real Telegram bot token in browser code.
- No live transaction submission.
- No gas spending.
- No onchain execution.

The intended live model is wallet-approved execution: Kyra can prepare an action, but the user's wallet remains the final approval gate and the user pays gas.

## Routes

- `/` - main product interface and deploy flow.
- `/dashboard` - signed-in demo workspace dashboard.
- `/agents/:agent-slug` - public agent profile route.

## Local Development

Install dependencies:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

The dev server usually runs at:

```text
http://localhost:5174
```

Vite may choose another port if the default is busy.

## Environment Variables

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local`.

Frontend variables:

```bash
VITE_KYRA_DATA_PROVIDER=mock
VITE_BASE_MCP_URL=https://mcp.base.org/
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_KYRA_DEPLOY_FUNCTION_URL=
VITE_KYRA_RESET_FUNCTION_URL=
VITE_KYRA_TELEGRAM_CONNECT_FUNCTION_URL=
VITE_KYRA_TELEGRAM_LINK_FUNCTION_URL=
VITE_KYRA_TELEGRAM_DASHBOARD_STATUS_FUNCTION_URL=
VITE_KYRA_ENABLE_TELEGRAM_CONNECT_TOKEN_INPUT=false
VITE_KYRA_ENABLE_TELEGRAM_DASHBOARD_STATUS=false
VITE_DEMO_MODE=true
```

For Supabase-backed demo mode:

```bash
VITE_KYRA_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_KYRA_DEPLOY_FUNCTION_URL=https://your-project.supabase.co/functions/v1/deploy-agent
VITE_KYRA_RESET_FUNCTION_URL=https://your-project.supabase.co/functions/v1/reset-demo-workspace
VITE_KYRA_TELEGRAM_CONNECT_FUNCTION_URL=https://your-project.supabase.co/functions/v1/telegram-connect
VITE_KYRA_TELEGRAM_LINK_FUNCTION_URL=https://your-project.supabase.co/functions/v1/telegram-link
VITE_KYRA_TELEGRAM_DASHBOARD_STATUS_FUNCTION_URL=https://your-project.supabase.co/functions/v1/telegram-dashboard-status
```

Demo UI gating for the internal Admin actions panel uses the Supabase user's
`app_metadata.role`. Only users with the `admin` role see that panel. Live admin endpoints must
still validate the role server-side; frontend visibility does not replace backend authorization
or RLS.

Edge Function secrets must be configured in Supabase, not exposed through `VITE_` variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=server-side-only
KYRA_DEMO_AGENT_LIMIT=3
```

## Build And Deploy

Before deploying Supabase Edge Functions, run the Deno function check:

```bash
npm run check:functions
```

This validates `deploy-agent` and `reset-demo-workspace` with the same TypeScript runtime family used by Supabase Edge Functions. Deno must be installed locally or exposed through `DENO_BIN`.

Create a production build:

```bash
npm run build
```

Build output:

```text
dist
```

Vercel settings:

- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Static config: `vercel.json`
- SPA fallback: `vercel.json` rewrite to `/index.html`

Netlify fallback settings:

- Build command: `npm run build`
- Publish directory: `dist`
- Static config: `netlify.toml`
- SPA fallback: `public/_redirects` and `netlify.toml`

Production is currently deployed as a backend-connected demo. Keep live onchain execution disabled until the Telegram, wallet, Base MCP, rate-limit, and security-review phases are complete.

## Supabase Files

- `supabase/schema.sql` - demo schema, RLS policies, public profile view, and grants.
- `supabase/seed.sql` - template catalog seed data.
- `supabase/set_demo_agent_limit_3.sql` - demo quota trigger helper.
- `supabase/harden_demo_workspace_and_quota.sql` - non-destructive hardening for one demo workspace per user and serialized quota checks.
- `supabase/fix_public_agent_profiles_security.sql` - public profile view hardening.
- `supabase/lockdown_authenticated_demo_writes.sql` - production hardening that keeps authenticated clients read-only and routes demo writes through Edge Functions.
- `supabase/verify_authenticated_demo_write_lockdown.sql` - read-only verification query for the write-lockdown grants and policies.
- `supabase/grant_service_role_deploy_permissions.sql` - service role grants for the Edge Function.
- `supabase/functions/deploy-agent/index.ts` - server-side demo deploy function.
- `supabase/functions/deploy-agent/README.md` - deploy-agent setup notes.
- `supabase/functions/reset-demo-workspace/index.ts` - server-side admin-only demo reset function.
- `supabase/functions/reset-demo-workspace/README.md` - reset-demo-workspace setup and safety notes.

## Roadmap

### Phase 1 - Frontend Demo

- Landing/product interface.
- Templates.
- Deploy wizard.
- Dashboard.
- Public agent route.
- Mobile responsive UI.

### Phase 2 - Backend-Connected Demo

- Supabase auth.
- Supabase schema and RLS.
- Template catalog from Supabase.
- Dashboard records.
- Edge Function deploy path.
- Demo quota and admin reset.

### Phase 3 - Backend Hardening

- Cleaner workspace lifecycle.
- Better rate limits and quotas.
- Stronger audit logs.
- More robust auth/session handling.
- Better admin tooling.

### Phase 4 - Production Demo Hardening

- Production deploy smoke.
- Signed-out, admin, and non-admin role checks.
- Edge-only production demo write policy.
- Better deploy/reset failure UX.
- Admin-only diagnostics and reset controls.
- Stale public route handling.

### Phase 5 - Telegram Integration

- Real Telegram bot/session.
- Bot token stored server-side only.
- Webhook handling.
- Agent command interface.

### Phase 6 - Wallet And Base Integration

- Wallet connect.
- Wallet approval.
- Base MCP integration.
- Prepare transaction safely.
- User wallet signs.
- User pays gas.
- No private key custody.

### Phase 7 - Public Launch

- Publish only after backend demo stability is confirmed.
- Clearly label any simulated execution while the product remains in demo mode.

## Links

- X: https://x.com/Kyra_Agent
- Website: https://kyraagent.xyz
- Repository: https://github.com/Kyra-Agent/Kyra

## GitHub About Suggestions

Description:

```text
Base-native onchain agent console demo.
```

Topics:

```text
base, onchain, ai-agent, supabase, telegram-bot, mcp, vite, react, typescript, web3
```

Homepage:

```text
https://kyraagent.xyz
```
