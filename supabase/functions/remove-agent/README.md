# remove-agent Edge Function

Owner-scoped lifecycle boundary for freeing one Kyra workspace agent slot without resetting the workspace.

## Safety contract

- Accepts `POST` with an exact `{ agentId, confirmation: "remove_agent" }` payload.
- Requires a valid Supabase account session.
- Derives the owner user ID from the verified session; owner/workspace IDs are never accepted from the browser.
- Uses the atomic `public.remove_owned_demo_agent` RPC.
- Refuses removal when Telegram credentials are active, onchain execution is active, or protected approval/transaction evidence exists.
- Deletes the selected agent only. Foreign-key cascades remove its non-secret child records; workspace records and other agents remain intact.
- Returns a sanitized quota receipt without owner IDs, workspace IDs, token references, wallet addresses, or transaction payloads.

Deploy only after applying `20260724100000_remove_owned_demo_agent.sql` and its verifier.
