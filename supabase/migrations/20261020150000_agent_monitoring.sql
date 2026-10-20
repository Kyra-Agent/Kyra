begin;

-- Proactive monitoring: watchlists, price alerts, and launch digests that the
-- telegram-monitor Edge Function checks every five minutes and pushes to the
-- owner's private Telegram chat. Owners read their own rows; all writes go
-- through the Telegram webhook (owner chat only) or the monitor function.

create table if not exists public.agent_watch_items (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  address text not null,
  kind text not null,
  label text not null default '',
  last_block bigint,
  last_price_usd numeric,
  created_at timestamptz not null default now(),
  constraint agent_watch_items_address_check check (address ~ '^0x[0-9a-f]{40}$'),
  constraint agent_watch_items_kind_check check (kind in ('wallet', 'token')),
  constraint agent_watch_items_label_check check (char_length(label) <= 40),
  constraint agent_watch_items_unique unique (agent_id, address)
);

create table if not exists public.agent_price_alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_address text not null,
  token_label text not null default '',
  direction text not null,
  target_usd numeric not null,
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price_usd numeric,
  constraint agent_price_alerts_token_check check (token_address ~ '^0x[0-9a-f]{40}$'),
  constraint agent_price_alerts_direction_check check (direction in ('above', 'below')),
  constraint agent_price_alerts_target_check check (target_usd > 0 and target_usd < 1000000000000),
  constraint agent_price_alerts_label_check check (char_length(token_label) <= 40)
);

create table if not exists public.agent_launch_subscriptions (
  agent_id uuid primary key references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  last_digest_at timestamptz,
  updated_at timestamptz not null default now()
);

-- New DEX pools found by the monitor; kept for 24 hours to build digests.
create table if not exists public.chain_launch_events (
  pool_address text primary key,
  dex text not null,
  fee integer,
  launch_token text not null,
  quote_token text not null,
  symbol text not null default '',
  name text not null default '',
  quote_symbol text not null default '',
  block_number bigint not null,
  detected_at timestamptz not null default now(),
  constraint chain_launch_events_dex_check check (dex in ('v2', 'v3')),
  constraint chain_launch_events_pool_check check (pool_address ~ '^0x[0-9a-f]{40}$')
);

create table if not exists public.monitor_state (
  key text primary key,
  block_number bigint not null,
  updated_at timestamptz not null default now(),
  constraint monitor_state_key_check check (key ~ '^[a-z_]{3,40}$')
);

create index if not exists agent_watch_items_agent_idx on public.agent_watch_items (agent_id);
create index if not exists agent_watch_items_workspace_idx on public.agent_watch_items (workspace_id);
create index if not exists agent_price_alerts_active_idx
  on public.agent_price_alerts (agent_id) where triggered_at is null;
create index if not exists agent_price_alerts_workspace_idx on public.agent_price_alerts (workspace_id);
create index if not exists agent_launch_subscriptions_workspace_idx
  on public.agent_launch_subscriptions (workspace_id);
create index if not exists chain_launch_events_detected_idx on public.chain_launch_events (detected_at);

alter table public.agent_watch_items enable row level security;
alter table public.agent_price_alerts enable row level security;
alter table public.agent_launch_subscriptions enable row level security;
alter table public.chain_launch_events enable row level security;
alter table public.monitor_state enable row level security;

drop policy if exists "Workspace owners can read watch items" on public.agent_watch_items;
create policy "Workspace owners can read watch items" on public.agent_watch_items
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
drop policy if exists "Workspace owners can read price alerts" on public.agent_price_alerts;
create policy "Workspace owners can read price alerts" on public.agent_price_alerts
  for select to authenticated using ((select public.owns_workspace(workspace_id)));
drop policy if exists "Workspace owners can read launch subscriptions" on public.agent_launch_subscriptions;
create policy "Workspace owners can read launch subscriptions" on public.agent_launch_subscriptions
  for select to authenticated using ((select public.owns_workspace(workspace_id)));

revoke all privileges on public.agent_watch_items, public.agent_price_alerts,
  public.agent_launch_subscriptions, public.chain_launch_events, public.monitor_state
  from public, anon, authenticated, service_role;
grant select on public.agent_watch_items, public.agent_price_alerts,
  public.agent_launch_subscriptions to authenticated;
grant select, insert, update, delete on public.agent_watch_items, public.agent_price_alerts,
  public.agent_launch_subscriptions, public.chain_launch_events, public.monitor_state
  to service_role;

create or replace function public.add_agent_watch_item(
  p_agent_id uuid,
  p_address text,
  p_kind text,
  p_label text
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select agents.workspace_id into v_workspace_id
  from public.agent_instances agents where agents.id = p_agent_id;

  if v_workspace_id is null then
    return 'agent_not_found';
  end if;

  if exists (
    select 1 from public.agent_watch_items items
    where items.agent_id = p_agent_id and items.address = lower(p_address)
  ) then
    return 'exists';
  end if;

  if (select count(*) from public.agent_watch_items items where items.agent_id = p_agent_id) >= 10 then
    return 'limit_reached';
  end if;

  insert into public.agent_watch_items (agent_id, workspace_id, address, kind, label)
  values (p_agent_id, v_workspace_id, lower(p_address), p_kind, left(coalesce(p_label, ''), 40));

  return 'added';
end;
$$;

create or replace function public.remove_agent_watch_item(
  p_agent_id uuid,
  p_address text
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  delete from public.agent_watch_items items
  where items.agent_id = p_agent_id and items.address = lower(p_address);

  return case when found then 'removed' else 'not_found' end;
end;
$$;

create or replace function public.add_agent_price_alert(
  p_agent_id uuid,
  p_token_address text,
  p_token_label text,
  p_direction text,
  p_target_usd numeric
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select agents.workspace_id into v_workspace_id
  from public.agent_instances agents where agents.id = p_agent_id;

  if v_workspace_id is null then
    return 'agent_not_found';
  end if;

  if (
    select count(*) from public.agent_price_alerts alerts
    where alerts.agent_id = p_agent_id and alerts.triggered_at is null
  ) >= 10 then
    return 'limit_reached';
  end if;

  insert into public.agent_price_alerts
    (agent_id, workspace_id, token_address, token_label, direction, target_usd)
  values
    (p_agent_id, v_workspace_id, lower(p_token_address), left(coalesce(p_token_label, ''), 40),
     p_direction, p_target_usd);

  return 'added';
end;
$$;

create or replace function public.clear_agent_price_alerts(
  p_agent_id uuid
) returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_removed integer;
begin
  delete from public.agent_price_alerts alerts
  where alerts.agent_id = p_agent_id and alerts.triggered_at is null;

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

create or replace function public.set_agent_launch_subscription(
  p_agent_id uuid,
  p_enabled boolean
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  select agents.workspace_id into v_workspace_id
  from public.agent_instances agents where agents.id = p_agent_id;

  if v_workspace_id is null then
    return 'agent_not_found';
  end if;

  insert into public.agent_launch_subscriptions (agent_id, workspace_id, enabled, last_digest_at, updated_at)
  values (p_agent_id, v_workspace_id, p_enabled, now(), now())
  on conflict (agent_id) do update
    set enabled = excluded.enabled,
        last_digest_at = case when excluded.enabled then now() else public.agent_launch_subscriptions.last_digest_at end,
        updated_at = now();

  return case when p_enabled then 'on' else 'off' end;
end;
$$;

-- Everything the owner set up, for /watchlist and /alerts.
create or replace function public.list_agent_monitoring(
  p_agent_id uuid
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'watch', coalesce((
      select jsonb_agg(jsonb_build_object('address', items.address, 'kind', items.kind, 'label', items.label)
        order by items.created_at)
      from public.agent_watch_items items where items.agent_id = p_agent_id
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'token', alerts.token_address, 'label', alerts.token_label,
        'direction', alerts.direction, 'target', alerts.target_usd)
        order by alerts.created_at)
      from public.agent_price_alerts alerts
      where alerts.agent_id = p_agent_id and alerts.triggered_at is null
    ), '[]'::jsonb),
    'launches', coalesce((
      select subs.enabled from public.agent_launch_subscriptions subs where subs.agent_id = p_agent_id
    ), false)
  );
$$;

revoke all on function public.add_agent_watch_item(uuid,text,text,text) from public, anon, authenticated, service_role;
revoke all on function public.remove_agent_watch_item(uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.add_agent_price_alert(uuid,text,text,text,numeric) from public, anon, authenticated, service_role;
revoke all on function public.clear_agent_price_alerts(uuid) from public, anon, authenticated, service_role;
revoke all on function public.set_agent_launch_subscription(uuid,boolean) from public, anon, authenticated, service_role;
revoke all on function public.list_agent_monitoring(uuid) from public, anon, authenticated, service_role;

grant execute on function public.add_agent_watch_item(uuid,text,text,text) to service_role;
grant execute on function public.remove_agent_watch_item(uuid,text) to service_role;
grant execute on function public.add_agent_price_alert(uuid,text,text,text,numeric) to service_role;
grant execute on function public.clear_agent_price_alerts(uuid) to service_role;
grant execute on function public.set_agent_launch_subscription(uuid,boolean) to service_role;
grant execute on function public.list_agent_monitoring(uuid) to service_role;

-- Scheduler: every five minutes, call telegram-monitor. The URL and shared
-- secret live in Vault (kyra_monitor_url, kyra_monitor_secret) so nothing
-- secret is committed; until both exist the job does nothing.
create extension if not exists pg_net;

select cron.schedule(
  'kyra-telegram-monitor',
  '*/5 * * * *',
  $monitor$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'kyra_monitor_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-kyra-monitor-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'kyra_monitor_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'kyra_monitor_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'kyra_monitor_secret')
  $monitor$
);

select cron.schedule(
  'kyra-purge-monitoring',
  '17 * * * *',
  $purge$
  delete from public.chain_launch_events where detected_at < now() - interval '24 hours';
  delete from public.agent_price_alerts where triggered_at < now() - interval '7 days';
  $purge$
);

commit;
