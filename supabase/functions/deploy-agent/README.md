# Kyra Deploy Agent

Production status: active as the authenticated write boundary for agent deployment.

The frontend calls this Edge Function after a Supabase account session is active. Direct browser writes are not the production path.

## Runtime Contract

- Validates the bearer session and derives the account owner on the server.
- Finds or creates the account-scoped workspace.
- Enforces the three-agent workspace quota.
- Loads the selected template and creates the persisted agent instance.
- Creates the initial wallet policy, approval request, Telegram session, and activity records.
- Binds new agents to the current Robinhood Chain product runtime.
- Returns a sanitized deployment receipt with dashboard and public-route data.

## Security Boundary

- Service-role credentials remain backend-only and must never use a `VITE_` variable.
- Owner, workspace, quota, template, and chain checks fail closed.
- Bot tokens, wallet secrets, private keys, seed phrases, and raw database errors are never returned.
- The function being active does not enable wallet signing or transaction submission.

Operations and secrets are managed through the Kyra release pipeline. Secret values and project-specific credentials are intentionally omitted from this document.
