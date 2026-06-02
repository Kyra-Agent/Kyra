# reset-demo-workspace Edge Function

This function is the server-side boundary for the internal Kyra demo workspace reset action.

## Safety Contract

- Accepts `POST` requests only.
- Requires a valid Supabase Auth bearer token.
- Validates `app_metadata.role === "admin"` on the server.
- Deletes only demo workspace records owned by the signed-in admin account.
- Does not accept a workspace ID or target user ID from the browser.
- Relies on existing foreign-key cascades for demo workspace child records.
- Returns a scoped receipt without workspace IDs, user IDs, email addresses, or secret values.

## Required Secrets

The function uses the same server-side Supabase Function secrets as `deploy-agent`:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser or any `VITE_` environment variable.

## Deploy

```bash
npx --yes supabase@latest functions deploy reset-demo-workspace --project-ref lvgqtxbygrazkolhdwnh
```

After deploying, test the existing confirmation flow once with an admin account. A signed-out user
and a signed-in non-admin user must not see the Admin actions UI, and direct requests from a
non-admin session must return `403 Forbidden`.
