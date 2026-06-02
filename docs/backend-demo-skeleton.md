# Backend Demo Skeleton

Kyra is still safe demo mode. The Supabase demo backend is now partially connected without enabling live onchain execution.

## What Exists Now

- `supabase/schema.sql` defines the first database shape.
- `supabase/seed.sql` seeds Kyra agent templates.
- `supabase/functions/deploy-agent` scaffolds the server-side deploy write path.
- `src/types/database.ts` mirrors the Supabase table rows in TypeScript.
- `src/services/repositoryFactory.ts` keeps mock fallback data available.
- `src/services/supabaseKyraRepository.ts` reads the Supabase template catalog.
- `src/services/supabaseDashboardService.ts` reads signed-in dashboard records.
- `src/services/supabasePublicAgentService.ts` reads public agent profiles.
- `src/services/supabaseDeployService.ts` calls the deploy Edge Function first, then falls back to RLS-backed client writes while the function is not deployed.
- `src/services/deployFunctionHealthService.ts` checks the deploy function health endpoint for dashboard readiness.
- `.env.example` includes the provider and Supabase env names.

## Tables

The demo backend is built around these records:

- `workspaces`: account scope owned by a Supabase user.
- `agent_templates`: Operator, Scout, Steward, Executor, Strategist, and Custom.
- `agent_instances`: deployed demo agents and public slugs.
- `wallet_policies`: wallet approval rules without custody.
- `approval_requests`: command, route, risk, status, and optional future tx fields.
- `activity_logs`: dashboard-visible server-style logs.
- `telegram_sessions`: Telegram connection state without raw bot tokens.

## Safety Defaults

- `walletExecution` stays `disabled`.
- No seed phrase, private key, or raw Telegram bot token belongs in the database.
- `prepared_tx` and `tx_hash` exist only for the future live phase.
- Public reads should use `public_agent_profiles`, not private workspace tables.
- Row Level Security is enabled on the private tables.

## Local Supabase Setup

When you are ready to test a real demo backend:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Run `supabase/seed.sql`.
4. Add these variables to `.env.local`:

```bash
VITE_KYRA_DATA_PROVIDER=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_KYRA_DEPLOY_FUNCTION_URL=https://your-project.supabase.co/functions/v1/deploy-agent
```

The UI can run against Supabase when `VITE_KYRA_DATA_PROVIDER=supabase`. It still falls back to mock records when Supabase is unavailable.

## Edge Function Scaffold

`supabase/functions/deploy-agent` is the intended server-side deployment boundary. It validates the user session, enforces the 3-agent demo quota, writes the same demo records, and returns a receipt.

The function also supports `GET` as a health check. Admin-only backend diagnostics use it to distinguish:

- `ready`: function is deployed and required secrets exist.
- `configuration required`: function is deployed but not fully configured.
- `fallback ready`: function is not reachable yet. Production deploys should not silently write through frontend REST fallback.

The function needs server-only secrets:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
KYRA_DEMO_AGENT_LIMIT=3
```

Do not place `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or any `VITE_` variable. It belongs only in Supabase Function secrets.

## Next Implementation Step

The frontend already prefers the Edge Function when configured. The next backend step is to deploy and test the function in Supabase:

1. Deploy `deploy-agent` to Supabase.
2. Set `SUPABASE_SERVICE_ROLE_KEY` and `KYRA_DEMO_AGENT_LIMIT` as Supabase Function secrets.
3. Verify admin backend diagnostics changes from `fallback ready` to `ready`.
4. Verify the frontend receipt source shows backend persistence only after the function succeeds.
5. Verify dashboard/public profile reads after the function receipt.
6. Keep live onchain execution disabled.

Keep live onchain execution disabled until wallet approval, rate limits, Telegram token storage, and security review are complete.
