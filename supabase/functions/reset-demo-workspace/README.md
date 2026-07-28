# Kyra Workspace Reset

Production status: active as an internal admin-only recovery control.

The deployed function keeps its legacy `reset-demo-workspace` slug for compatibility. It is not a public product action and does not define Kyra as a demo.

## Safety Contract

- Accepts `POST` only and requires a valid Supabase account session.
- Requires the server-verified admin role.
- Resets only records owned by the signed-in admin account.
- Does not accept a target workspace ID or user ID from the browser.
- Uses reviewed foreign-key cascades for scoped child records.
- Returns no workspace ID, user ID, email address, token, wallet secret, or raw error.
- Signed-out and non-admin users cannot access the admin UI or function behavior.

Service-role credentials remain backend-only. Reset activity must be performed only for recovery, migration closeout, or controlled support work and must never be exposed as a public account operation.
