# Kyra Telegram Dashboard Status

Production status: active as an authenticated dashboard-safe read model.

The function accepts a bounded list of agent IDs, validates the Supabase session, verifies ownership, and returns only the Telegram fields required by the private workspace.

## Returned Fields

- agent ID
- bot handle
- webhook status
- owner-chat linked state
- owner-link availability
- last safe event timestamp

## Privacy Boundary

- Service-role reads occur only after runtime-gate, bearer, session, and request validation; every query then enforces agent ownership before returning data.
- Telegram user IDs, chat IDs, owner IDs, workspace IDs, session IDs, challenge material, token references, webhook-secret references, bot tokens, webhook secrets, and raw database errors are never returned.
- Browsers receive no direct access to private Telegram authorization tables.
- Disabled gates or malformed requests fail before private reads.

Deployment and runtime enablement are separate controls. The active production path remains owner-scoped and sanitized.
