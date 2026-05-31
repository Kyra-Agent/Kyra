# Backend Demo Skeleton

Kyra is still safe frontend demo mode. This skeleton prepares the backend phase without enabling live onchain execution.

## What Exists Now

- `supabase/schema.sql` defines the first database shape.
- `supabase/seed.sql` seeds Kyra agent templates.
- `src/types/database.ts` mirrors the Supabase table rows in TypeScript.
- `src/services/repositoryFactory.ts` keeps the active UI on mock records.
- `src/services/supabaseKyraRepository.ts` exposes the planned Supabase adapter status and table list.
- `.env.example` includes the provider and Supabase env names.

## Tables

The demo backend is built around these records:

- `workspaces`: account scope owned by a Supabase user.
- `agent_templates`: Operator, Scout, Steward, Executor, Launcher, and Custom.
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
```

The UI will still use mock records until the async Supabase data adapter is implemented. That is intentional: we are preparing the backend safely before changing product behavior.

## Next Implementation Step

The next code phase should add a real async backend gateway:

1. Install the Supabase client.
2. Create auth/session state.
3. Replace deploy wizard receipt creation with an insert into `agent_instances`.
4. Create default `wallet_policies`.
5. Create `activity_logs` for deploy and approval events.
6. Read dashboard/public agent data from Supabase.

Keep live onchain execution disabled until wallet approval, rate limits, Telegram token storage, and security review are complete.
