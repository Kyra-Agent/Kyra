begin;

-- Community mode: Telegram groups where any member may ask an agent
-- read-only questions with /ask or by replying to the bot. Only the agent's
-- linked owner (matched by Telegram user id) can turn a group on or off.
create table if not exists public.telegram_community_chats (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null
    references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  telegram_chat_id text not null,
  chat_title text not null default '',
  enabled_by_telegram_user_id text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint telegram_community_chats_chat_id_check
    check (telegram_chat_id ~ '^-[1-9][0-9]*$'),
  constraint telegram_community_chats_user_id_check
    check (enabled_by_telegram_user_id ~ '^[1-9][0-9]*$'),
  constraint telegram_community_chats_title_check
    check (char_length(chat_title) <= 64)
);

create unique index if not exists telegram_community_chats_active_idx
  on public.telegram_community_chats (agent_id, telegram_chat_id)
  where revoked_at is null;
create index if not exists telegram_community_chats_workspace_idx
  on public.telegram_community_chats (workspace_id);

alter table public.telegram_community_chats enable row level security;

drop policy if exists "Workspace owners can read community chats"
  on public.telegram_community_chats;
create policy "Workspace owners can read community chats"
  on public.telegram_community_chats
  for select
  to authenticated
  using ((select public.owns_workspace(workspace_id)));

revoke all privileges on public.telegram_community_chats
  from public, anon, authenticated, service_role;
grant select on public.telegram_community_chats to authenticated;
grant select, insert, update, delete on public.telegram_community_chats
  to service_role;

-- Per-member and per-group usage buckets (10-minute windows) that cap how
-- often community members can reach the agent brain.
create table if not exists public.telegram_community_usage (
  agent_id uuid not null
    references public.agent_instances(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (agent_id, telegram_chat_id, telegram_user_id, window_start),
  constraint telegram_community_usage_count_check
    check (request_count between 0 and 1000)
);

create index if not exists telegram_community_usage_chat_window_idx
  on public.telegram_community_usage (agent_id, telegram_chat_id, window_start);
create index if not exists telegram_community_usage_window_idx
  on public.telegram_community_usage (window_start);

alter table public.telegram_community_usage enable row level security;

revoke all privileges on public.telegram_community_usage
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.telegram_community_usage
  to service_role;

-- Turns community mode on or off for a group. The caller must be the
-- agent's linked owner on Telegram.
create or replace function public.set_telegram_community_chat(
  p_agent_id uuid,
  p_telegram_user_id text,
  p_telegram_chat_id text,
  p_chat_title text,
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
  if not exists (
    select 1
    from public.telegram_chat_authorizations auth
    where auth.agent_id = p_agent_id
      and auth.telegram_user_id = p_telegram_user_id
      and auth.role = 'owner'
      and auth.revoked_at is null
  ) then
    return 'not_owner';
  end if;

  if p_telegram_chat_id !~ '^-[1-9][0-9]*$' then
    return 'not_group';
  end if;

  if not p_enabled then
    update public.telegram_community_chats chats
    set revoked_at = now()
    where chats.agent_id = p_agent_id
      and chats.telegram_chat_id = p_telegram_chat_id
      and chats.revoked_at is null;

    return case when found then 'disabled' else 'already_disabled' end;
  end if;

  if exists (
    select 1
    from public.telegram_community_chats chats
    where chats.agent_id = p_agent_id
      and chats.telegram_chat_id = p_telegram_chat_id
      and chats.revoked_at is null
  ) then
    return 'already_enabled';
  end if;

  if (
    select count(*)
    from public.telegram_community_chats chats
    where chats.agent_id = p_agent_id
      and chats.revoked_at is null
  ) >= 5 then
    return 'limit_reached';
  end if;

  select agents.workspace_id into v_workspace_id
  from public.agent_instances agents
  where agents.id = p_agent_id;

  if v_workspace_id is null then
    return 'not_owner';
  end if;

  insert into public.telegram_community_chats
    (agent_id, workspace_id, telegram_chat_id, chat_title, enabled_by_telegram_user_id)
  values
    (p_agent_id, v_workspace_id, p_telegram_chat_id, left(coalesce(p_chat_title, ''), 64), p_telegram_user_id);

  return 'enabled';
end;
$$;

create or replace function public.resolve_telegram_community_chat(
  p_agent_id uuid,
  p_telegram_chat_id text
) returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.telegram_community_chats chats
    where chats.agent_id = p_agent_id
      and chats.telegram_chat_id = p_telegram_chat_id
      and chats.revoked_at is null
  );
$$;

-- Counts one community request. Limits: 6 per member per 10 minutes and 60
-- per group per hour.
create or replace function public.consume_telegram_community_quota(
  p_agent_id uuid,
  p_telegram_chat_id text,
  p_telegram_user_id text
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_window timestamptz := date_bin(interval '10 minutes', now(), timestamptz '2000-01-01');
  v_member_count integer;
  v_group_count integer;
begin
  select coalesce(sum(usage.request_count), 0) into v_group_count
  from public.telegram_community_usage usage
  where usage.agent_id = p_agent_id
    and usage.telegram_chat_id = p_telegram_chat_id
    and usage.window_start > now() - interval '1 hour';

  if v_group_count >= 60 then
    return 'group_limited';
  end if;

  select coalesce(sum(usage.request_count), 0) into v_member_count
  from public.telegram_community_usage usage
  where usage.agent_id = p_agent_id
    and usage.telegram_chat_id = p_telegram_chat_id
    and usage.telegram_user_id = p_telegram_user_id
    and usage.window_start = v_window;

  if v_member_count >= 6 then
    return 'member_limited';
  end if;

  insert into public.telegram_community_usage
    (agent_id, telegram_chat_id, telegram_user_id, window_start, request_count)
  values
    (p_agent_id, p_telegram_chat_id, p_telegram_user_id, v_window, 1)
  on conflict (agent_id, telegram_chat_id, telegram_user_id, window_start)
  do update set request_count = public.telegram_community_usage.request_count + 1;

  return 'allowed';
end;
$$;

revoke all on function public.set_telegram_community_chat(uuid,text,text,text,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.resolve_telegram_community_chat(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.consume_telegram_community_quota(uuid,text,text)
  from public, anon, authenticated, service_role;

grant execute on function public.set_telegram_community_chat(uuid,text,text,text,boolean)
  to service_role;
grant execute on function public.resolve_telegram_community_chat(uuid,text)
  to service_role;
grant execute on function public.consume_telegram_community_quota(uuid,text,text)
  to service_role;

-- Usage buckets are only needed for the last hour.
select cron.schedule(
  'kyra-purge-telegram-community-usage',
  '*/30 * * * *',
  $purge$delete from public.telegram_community_usage where window_start < now() - interval '2 hours'$purge$
);

commit;
