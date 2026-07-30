begin;

create or replace function public.enforce_prepared_action_transfer_daily_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  utc_day_start timestamptz;
  reserved_atomic numeric;
  daily_limit_atomic numeric;
begin
  if new.action_kind <> 'robinhood_reviewed_transaction'
    or new.policy_version <> 3 then
    return new;
  end if;

  daily_limit_atomic := case new.asset_kind
    when 'native' then 20000000000000000::numeric
    when 'erc20' then 50000000000000000000000::numeric
    else null
  end;

  if daily_limit_atomic is null then
    raise exception using
      errcode = '23514',
      message = 'transfer_asset_policy_invalid';
  end if;

  utc_day_start := pg_catalog.date_trunc('day', pg_catalog.timezone('utc', pg_catalog.now()))
    at time zone 'utc';

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      new.workspace_id::text
        || ':' || new.asset_kind
        || ':' || utc_day_start::text,
      0
    )
  );

  select coalesce(sum(amount_atomic::numeric), 0)
  into reserved_atomic
  from public.prepared_actions
  where workspace_id = new.workspace_id
    and action_kind = 'robinhood_reviewed_transaction'
    and policy_version = 3
    and asset_kind = new.asset_kind
    and created_at >= utc_day_start
    and created_at < utc_day_start + interval '1 day';

  if reserved_atomic + new.amount_atomic::numeric > daily_limit_atomic then
    raise exception using
      errcode = '23514',
      message = 'daily_transfer_limit_exceeded';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_prepared_action_transfer_daily_limit()
from public, anon, authenticated, service_role;

drop trigger if exists prepared_actions_transfer_daily_limit
  on public.prepared_actions;

create trigger prepared_actions_transfer_daily_limit
before insert on public.prepared_actions
for each row
execute function public.enforce_prepared_action_transfer_daily_limit();

comment on function public.enforce_prepared_action_transfer_daily_limit() is
  'Atomically enforces per-workspace UTC-day native and KYRA transfer review caps.';

commit;
