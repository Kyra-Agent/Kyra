# Backend Demo Skeleton

Kyra is still safe demo mode. The Supabase demo backend is connected for
persistence, dashboard records, public profiles, and live read-only Telegram
replies without enabling live onchain execution.

## What Exists Now

- `supabase/schema.sql` defines the first database shape.
- `supabase/seed.sql` seeds Kyra agent templates.
- `supabase/functions/deploy-agent` scaffolds the server-side deploy write path.
- `supabase/functions/reset-demo-workspace` provides the admin-only demo reset path.
- `src/types/database.ts` mirrors the Supabase table rows in TypeScript.
- `src/services/repositoryFactory.ts` keeps mock fallback data available.
- `src/services/supabaseKyraRepository.ts` reads the Supabase template catalog.
- `src/services/supabaseDashboardService.ts` reads signed-in dashboard records.
- `src/services/supabasePublicAgentService.ts` reads public agent profiles.
- `src/services/supabaseDeployService.ts` calls the deploy Edge Function first. Direct RLS-backed client writes remain available only during local development.
- `src/services/deployFunctionHealthService.ts` checks the deploy function health endpoint for dashboard readiness.
- `.env.example` includes the provider and Supabase env names.
- `supabase/lockdown_authenticated_demo_writes.sql` keeps production authenticated clients read-only for demo records, while Edge Functions continue writing with `service_role`.
- `supabase/functions/telegram-webhook` handles Phase 5 live read-only Telegram
  commands and bounded natural chat when the backend runtime gates are enabled.

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
- Telegram execution stays read-only.
- No seed phrase, private key, or raw Telegram bot token belongs in the database.
- `prepared_tx` and `tx_hash` exist only for the future live phase.
- Public reads should use `public_agent_profiles`, not private workspace tables.
- Row Level Security is enabled on the private tables.
- Production writes should use Edge Functions. Browser clients should not receive direct insert, update, or delete privileges on demo record tables.

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
VITE_KYRA_RESET_FUNCTION_URL=https://your-project.supabase.co/functions/v1/reset-demo-workspace
```

The UI can run against Supabase when `VITE_KYRA_DATA_PROVIDER=supabase`. It still falls back to mock records when Supabase is unavailable.

For production, run `supabase/lockdown_authenticated_demo_writes.sql` after the deploy and reset Edge Functions are deployed. The development-only REST fallback is only for isolated local/dev databases that intentionally keep write grants. If a dev build points at the locked production project, direct browser writes should fail and deploys should use the Edge Function.

## Edge Function Scaffold

`supabase/functions/deploy-agent` is the intended server-side deployment boundary. It validates the user session, enforces the 3-agent demo quota, writes the same demo records, and returns a receipt.

`supabase/functions/reset-demo-workspace` is the admin-only reset boundary. It validates the user
session and `app_metadata.role` on the server, accepts no workspace or user ID from the browser,
and deletes only the signed-in admin account's demo workspace records.

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

The frontend already prefers the Edge Function when configured. The production backend should be verified in this order:

1. Run `npm run check:functions` so Deno type-checks `deploy-agent` and `reset-demo-workspace` before either function is deployed.
2. Deploy `deploy-agent` to Supabase.
3. Set `SUPABASE_SERVICE_ROLE_KEY` and `KYRA_DEMO_AGENT_LIMIT` as Supabase Function secrets.
4. Verify admin backend diagnostics changes from `fallback ready` to `ready`.
5. Verify the frontend receipt source shows backend persistence only after the function succeeds.
6. Verify dashboard/public profile reads after the function receipt.
7. Keep live onchain execution disabled.
8. Deploy `reset-demo-workspace`, then test its confirmation flow once with an admin account.
9. Verify a non-admin request receives `403 Forbidden`.
10. Run `supabase/lockdown_authenticated_demo_writes.sql`.
11. Run `supabase/verify_authenticated_demo_write_lockdown.sql` and confirm authenticated inserts are false while service role inserts remain true.

Keep live onchain execution disabled until Phase 6 wallet approval, Base MCP,
rate limits, execution-specific Telegram gates, and security review are
complete.
