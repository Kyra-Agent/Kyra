begin;

-- Short-term chat memory for the owner's Telegram chat: at most the last six
-- messages, kept for 24 hours, readable only by the backend service role.
-- Rows disappear with their Telegram session (disconnect, agent removal, or
-- workspace reset), on /forget, and through the purge job below.
create table if not exists public.telegram_chat_memory (
  id bigint generated always as identity primary key,
  telegram_session_id uuid not null
    references public.telegram_sessions(id) on delete cascade,
  telegram_chat_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint telegram_chat_memory_role_check
    check (role in ('user', 'assistant')),
  constraint telegram_chat_memory_content_check
    check (char_length(content) between 1 and 1200),
  constraint telegram_chat_memory_chat_id_check
    check (telegram_chat_id ~ '^-?[0-9]{1,20}$')
);

create index if not exists telegram_chat_memory_chat_recent_idx
  on public.telegram_chat_memory (telegram_session_id, telegram_chat_id, created_at desc);
create index if not exists telegram_chat_memory_created_at_idx
  on public.telegram_chat_memory (created_at);

alter table public.telegram_chat_memory enable row level security;

revoke all privileges on public.telegram_chat_memory
  from public, anon, authenticated, service_role;
grant select, insert, delete on public.telegram_chat_memory to service_role;

-- Returns the newest messages (oldest first) from the last 24 hours.
create or replace function public.load_telegram_chat_memory(
  p_telegram_session_id uuid,
  p_telegram_chat_id text
) returns table (
  role text,
  content text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select recent.role, recent.content
  from (
    select memory.role, memory.content, memory.created_at, memory.id
    from public.telegram_chat_memory memory
    where memory.telegram_session_id = p_telegram_session_id
      and memory.telegram_chat_id = p_telegram_chat_id
      and memory.created_at > clock_timestamp() - interval '24 hours'
    order by memory.created_at desc, memory.id desc
    limit 6
  ) recent
  order by recent.created_at asc, recent.id asc;
$$;

-- Stores one exchange, then keeps only the newest six messages for the chat
-- and drops anything older than 24 hours.
create or replace function public.append_telegram_chat_memory(
  p_telegram_session_id uuid,
  p_telegram_chat_id text,
  p_user_content text,
  p_assistant_content text
) returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_kept integer;
begin
  insert into public.telegram_chat_memory
    (telegram_session_id, telegram_chat_id, role, content)
  values
    (p_telegram_session_id, p_telegram_chat_id, 'user', p_user_content);

  insert into public.telegram_chat_memory
    (telegram_session_id, telegram_chat_id, role, content)
  values
    (p_telegram_session_id, p_telegram_chat_id, 'assistant', p_assistant_content);

  delete from public.telegram_chat_memory memory
  where memory.telegram_session_id = p_telegram_session_id
    and memory.telegram_chat_id = p_telegram_chat_id
    and (
      memory.created_at <= clock_timestamp() - interval '24 hours'
      or memory.id not in (
        select newest.id
        from public.telegram_chat_memory newest
        where newest.telegram_session_id = p_telegram_session_id
          and newest.telegram_chat_id = p_telegram_chat_id
        order by newest.created_at desc, newest.id desc
        limit 6
      )
    );

  select count(*) into v_kept
  from public.telegram_chat_memory memory
  where memory.telegram_session_id = p_telegram_session_id
    and memory.telegram_chat_id = p_telegram_chat_id;

  return v_kept;
end;
$$;

-- /forget: removes every stored message for the chat.
create or replace function public.forget_telegram_chat_memory(
  p_telegram_session_id uuid,
  p_telegram_chat_id text
) returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_removed integer;
begin
  delete from public.telegram_chat_memory memory
  where memory.telegram_session_id = p_telegram_session_id
    and memory.telegram_chat_id = p_telegram_chat_id;

  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

revoke all on function public.load_telegram_chat_memory(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function public.append_telegram_chat_memory(uuid,text,text,text)
  from public, anon, authenticated, service_role;
revoke all on function public.forget_telegram_chat_memory(uuid,text)
  from public, anon, authenticated, service_role;

grant execute on function public.load_telegram_chat_memory(uuid,text)
  to service_role;
grant execute on function public.append_telegram_chat_memory(uuid,text,text,text)
  to service_role;
grant execute on function public.forget_telegram_chat_memory(uuid,text)
  to service_role;

-- Hard 24-hour retention even for chats that go quiet.
create extension if not exists pg_cron;

select cron.schedule(
  'kyra-purge-telegram-chat-memory',
  '*/15 * * * *',
  $purge$delete from public.telegram_chat_memory where created_at < now() - interval '24 hours'$purge$
);

commit;
