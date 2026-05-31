# deploy-agent Edge Function

This function is the server-side boundary for Kyra demo deployment writes.
It is scaffolded for the live backend phase and is not required for the current local preview.

## What It Does

- Validates the user from the `Authorization: Bearer <access-token>` header.
- Finds or creates the user's demo workspace.
- Enforces the demo limit of 2 agents per workspace.
- Reads a template from `agent_templates`.
- Creates an `agent_instances` row.
- Creates the default `wallet_policies`, `approval_requests`, `telegram_sessions`, and `activity_logs` rows.
- Returns a deployment receipt with the dashboard/public agent route data.

## Required Secrets

Set these in Supabase before deploying the function:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
supabase secrets set KYRA_DEMO_AGENT_LIMIT=2
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are normally available in Supabase Functions, but they are also listed in `supabase/functions/.env.example` for local testing.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or any `VITE_` environment variable.

## Deploy Later

```bash
supabase functions deploy deploy-agent
```

Frontend integration should call this function only after the user has an active Supabase Auth session. The current UI can keep using direct RLS-backed demo writes until this function is deployed and tested.
