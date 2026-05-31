# Kyra Agent Backend Blueprint

This is the backend plan for the next phase. The current product is still frontend-only, but the UI now uses backend-shaped mock records so the transition to Supabase can be direct.

## Goal

Build a demo backend that can persist agent deployments, dashboard logs, wallet policies, and approval records without enabling live onchain execution yet.

The first backend version should prove the product flow:

1. A user signs in.
2. The user creates a Kyra workspace.
3. The user deploys a demo agent from a template.
4. Kyra stores the agent instance and Telegram settings placeholder.
5. The dashboard reads logs, approvals, wallet policy, and public profile data from the backend.
6. Onchain actions remain simulated until the security model is ready.

## Suggested Stack

- Supabase Auth for email or social login.
- Supabase Postgres for records.
- Supabase Row Level Security for workspace isolation.
- Supabase Edge Functions or a small Node API for deploy/log actions.
- Later: Telegram bot webhook and Base MCP action preparation service.

## Core Tables

### `workspaces`

Stores the account scope.

- `id`: uuid primary key
- `owner_user_id`: uuid references auth user
- `name`: text
- `mode`: text, starts as `demo`
- `created_at`: timestamp

### `agent_templates`

Stores available Kyra templates.

- `id`: text primary key, for example `operator`
- `name`: text
- `role`: text
- `status`: text
- `summary`: text
- `actions`: jsonb
- `modules`: jsonb

### `agent_instances`

Stores deployed agents.

- `id`: uuid primary key
- `workspace_id`: uuid references `workspaces`
- `template_id`: text references `agent_templates`
- `display_name`: text
- `handle`: text
- `public_slug`: text unique
- `status`: text, for example `online`, `draft`, `paused`
- `mode`: text, starts as `demo`
- `network`: text, starts as `base`
- `telegram_status`: text
- `base_mcp_status`: text
- `approval_policy_id`: uuid
- `created_at`: timestamp
- `last_sync_at`: timestamp

### `wallet_policies`

Stores approval rules without storing private keys.

- `id`: uuid primary key
- `workspace_id`: uuid references `workspaces`
- `agent_id`: uuid references `agent_instances`
- `wallet_label`: text
- `wallet_address`: text nullable for demo
- `daily_limit_usdc`: numeric
- `approval_required`: boolean default true
- `allowed_actions`: jsonb
- `status`: text
- `created_at`: timestamp

### `approval_requests`

Stores every action that needs review.

- `id`: uuid primary key
- `agent_id`: uuid references `agent_instances`
- `scenario_id`: text nullable
- `command`: text
- `route`: text
- `risk`: text
- `status`: text, for example `waiting_wallet`, `read_only_ready`, `review_required`, `approved`, `rejected`
- `fee_payer`: text, default `connected_wallet`
- `requires_wallet`: boolean
- `prepared_tx`: jsonb nullable for later live phase
- `tx_hash`: text nullable
- `created_at`: timestamp
- `resolved_at`: timestamp nullable

### `activity_logs`

Stores dashboard-visible logs.

- `id`: uuid primary key
- `workspace_id`: uuid references `workspaces`
- `agent_id`: uuid references `agent_instances`
- `source`: text, for example `telegram_sessions`, `base_mcp_routes`, `approval_requests`
- `level`: text
- `message`: text
- `created_at`: timestamp

### `telegram_sessions`

Stores Telegram connection state. Real bot tokens must be encrypted or stored outside the database in a secret manager.

- `id`: uuid primary key
- `agent_id`: uuid references `agent_instances`
- `bot_handle`: text
- `webhook_status`: text
- `token_secret_ref`: text nullable
- `created_at`: timestamp
- `last_event_at`: timestamp nullable

## Auth And Access

Use Supabase Auth first. Every table should be scoped by `workspace_id` or joined through `agent_instances.workspace_id`.

Minimum RLS rules:

- Users can read and write workspaces they own.
- Users can read and write agent instances inside their workspaces.
- Public agent pages can read a limited view of `agent_instances`, template metadata, and safe public stats.
- Public reads must not expose wallet addresses, secrets, raw logs, API keys, bot tokens, or prepared transaction payloads.

## Deploy Flow

1. Frontend sends selected template, agent name, and requested actions.
2. API validates template and allowed demo actions.
3. API creates `agent_instances`.
4. API creates default `wallet_policies`.
5. API creates initial `activity_logs`.
6. API returns dashboard route and public agent route.
7. Frontend updates the wizard receipt.

## Approval Flow

Demo phase:

1. User enters command in the UI or Telegram demo.
2. API creates an `approval_requests` row.
3. API writes an `activity_logs` row.
4. Dashboard shows `waiting_wallet` or `read_only_ready`.
5. No transaction payload is signed or submitted.

Live phase:

1. Base MCP prepares an unsigned transaction or action payload.
2. NYX-05 checks risk, approvals, slippage, and action limits.
3. Frontend asks the connected wallet or Base Account to approve.
4. Wallet signs and submits.
5. API stores `tx_hash` and final status.

## Security Rules

- Never store seed phrases or private keys.
- Do not store raw Telegram bot tokens in plain text.
- Use environment variables or secret references for sensitive integrations.
- Keep transaction execution behind explicit wallet approval.
- Store prepared transactions separately from public profile data.
- Add audit logs before enabling live onchain actions.

## Demo To Live Transition

Phase 2 should only add persistence and auth. It should not execute real transactions.

Phase 3 can add Telegram webhooks and Base MCP preparation.

Phase 4 can enable live wallet-approved execution after security review, rate limits, monitoring, and audit logging are in place.
