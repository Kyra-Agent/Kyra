begin;

alter table public.telegram_processed_updates
  add column if not exists delivery_status text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer,
  add column if not exists delivered_at timestamptz;

update public.telegram_processed_updates
set delivery_status = coalesce(delivery_status, 'delivered'),
    lease_expires_at = coalesce(lease_expires_at, created_at),
    attempt_count = coalesce(attempt_count, 1),
    delivered_at = coalesce(delivered_at, created_at);

alter table public.telegram_processed_updates
  alter column delivery_status set default 'processing',
  alter column delivery_status set not null,
  alter column lease_expires_at set default (now() + interval '2 minutes'),
  alter column lease_expires_at set not null,
  alter column attempt_count set default 1,
  alter column attempt_count set not null;

alter table public.telegram_processed_updates
  drop constraint if exists telegram_processed_updates_delivery_status_check,
  drop constraint if exists telegram_processed_updates_attempt_count_check,
  add constraint telegram_processed_updates_delivery_status_check
    check (delivery_status in ('processing', 'delivered')),
  add constraint telegram_processed_updates_attempt_count_check
    check (attempt_count between 1 and 25);

create index if not exists telegram_processed_updates_retry_idx
on public.telegram_processed_updates(delivery_status, lease_expires_at)
where delivery_status = 'processing';

create or replace function public.claim_telegram_update(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  claimed boolean,
  status text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_delivery_status text;
  v_lease_expires_at timestamptz;
  v_attempt_count integer;
begin
  if not exists (
    select 1
    from public.telegram_sessions sessions
    where sessions.id = p_telegram_session_id
      and sessions.webhook_status = 'active'
      and p_telegram_update_id >= 0
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_telegram_session_id::text || ':' || p_telegram_update_id::text,
      0
    )
  );

  select updates.delivery_status,
         updates.lease_expires_at,
         updates.attempt_count
  into v_delivery_status, v_lease_expires_at, v_attempt_count
  from public.telegram_processed_updates updates
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id
  for update;

  if not found then
    insert into public.telegram_processed_updates (
      telegram_session_id,
      telegram_update_id,
      delivery_status,
      lease_expires_at,
      attempt_count,
      delivered_at
    ) values (
      p_telegram_session_id,
      p_telegram_update_id,
      'processing',
      v_now + interval '2 minutes',
      1,
      null
    );

    return query select true, 'claimed'::text;
    return;
  end if;

  if v_delivery_status = 'delivered'
    or v_lease_expires_at > v_now
    or v_attempt_count >= 25
  then
    return query select false, 'duplicate'::text;
    return;
  end if;

  update public.telegram_processed_updates updates
  set delivery_status = 'processing',
      lease_expires_at = v_now + interval '2 minutes',
      attempt_count = updates.attempt_count + 1,
      delivered_at = null
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id;

  return query select true, 'claimed'::text;
end;
$$;

create or replace function public.mark_telegram_update_delivered(
  p_telegram_session_id uuid,
  p_telegram_update_id bigint
) returns table (
  marked boolean,
  status text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  update public.telegram_processed_updates updates
  set delivery_status = 'delivered',
      lease_expires_at = clock_timestamp(),
      delivered_at = clock_timestamp()
  where updates.telegram_session_id = p_telegram_session_id
    and updates.telegram_update_id = p_telegram_update_id
    and updates.delivery_status = 'processing';

  if found then
    return query select true, 'delivered'::text;
    return;
  end if;

  if exists (
    select 1
    from public.telegram_processed_updates updates
    where updates.telegram_session_id = p_telegram_session_id
      and updates.telegram_update_id = p_telegram_update_id
      and updates.delivery_status = 'delivered'
  ) then
    return query select false, 'duplicate'::text;
  end if;
end;
$$;

revoke all privileges on public.telegram_processed_updates
  from public, anon, authenticated, service_role;
grant all privileges on public.telegram_processed_updates to service_role;

revoke all on function public.claim_telegram_update(uuid,bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_telegram_update_delivered(uuid,bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_telegram_update(uuid,bigint)
  to service_role;
grant execute on function public.mark_telegram_update_delivered(uuid,bigint)
  to service_role;

commit;
