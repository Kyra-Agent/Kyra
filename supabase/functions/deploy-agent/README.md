# deploy-agent Edge Function

This function is the server-side boundary for Kyra demo deployment writes.
The frontend deploy service uses this function as the production write boundary. Direct RLS-backed writes are for local development fallback only.

## What It Does

- Supports `GET` health checks for dashboard readiness.
- Validates the user from the `Authorization: Bearer <access-token>` header.
- Finds or creates the user's demo workspace.
- Enforces the demo limit of 3 agents per workspace.
- Reads a template from `agent_templates`.
- Creates an `agent_instances` row.
- Creates the default `wallet_policies`, `approval_requests`, `telegram_sessions`, and `activity_logs` rows.
- Returns a deployment receipt with the dashboard/public agent route data.

## Required Secrets

Set these in Supabase before deploying the function:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set KYRA_DEMO_AGENT_LIMIT=3
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are normally available in Supabase Functions, but they are also listed in `supabase/functions/.env.example` for local testing.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or any `VITE_` environment variable.

## Deploy

The Supabase CLI must be authenticated first. Use a local CLI login or set a
temporary `SUPABASE_ACCESS_TOKEN` in your terminal session. Do not commit the
token or paste it into frontend environment variables.

```bash
npx --yes supabase@latest functions deploy deploy-agent --project-ref lvgqtxbygrazkolhdwnh
```

Frontend integration calls this function only after the user has an active Supabase Auth session. Set `VITE_KYRA_DEPLOY_FUNCTION_URL` to the deployed function URL if the default Supabase function URL is not enough.

After deploy, open the Kyra dashboard as an admin and check `Backend Diagnostics`. The `deploy-agent` checklist should show `ready` when all required secrets are present.
