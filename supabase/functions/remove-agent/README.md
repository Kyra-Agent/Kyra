# Kyra Remove Agent

Production status: active as the authenticated owner-scoped agent lifecycle boundary.

The function removes one persisted agent and frees one workspace slot without resetting the account workspace.

## Safety Contract

- Accepts only the exact agent-removal confirmation payload.
- Requires a valid Supabase account session and derives ownership on the server.
- Uses the atomic owner-scoped removal RPC. Its legacy database identifier is an implementation detail, not a product mode.
- Refuses removal while Telegram credentials are active, onchain execution is active, or protected approval or transaction evidence must be preserved.
- Deletes only the selected agent and its permitted child records; the workspace and other agents remain intact.
- Returns a sanitized quota receipt without owner IDs, workspace IDs, token references, wallet addresses, or transaction payloads.

The current production migration and verifier for atomic agent removal are applied in the linked database.
