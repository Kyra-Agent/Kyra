begin;

-- DCA, stop-loss, and take-profit rules for the Telegram swap prompts. A
-- rule never trades: when it comes due, telegram-monitor sends the owner a
-- button that opens the Kyra Mini App with a fresh Uniswap quote, and the
-- owner signs the swap in their own wallet. Amount caps match the swap lane.
create table if not exists public.agent_trade_rules (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  sell_token_symbol text not null,
  buy_token_symbol text not null,
  sell_amount_atomic text not null,
  interval_hours integer null,
  trigger_price_usd numeric null,
  next_run_at timestamptz null,
  last_triggered_at timestamptz null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint agent_trade_rules_kind_check
    check (kind in ('dca', 'stop_loss', 'take_profit')),
  constraint agent_trade_rules_tokens_check
    check (
      sell_token_symbol in ('ETH', 'USDG')
      and buy_token_symbol in ('ETH', 'USDG')
      and sell_token_symbol <> buy_token_symbol
    ),
  constraint agent_trade_rules_amount_check
    check (
      sell_amount_atomic ~ '^[1-9][0-9]{0,30}$'
      and (
        (sell_token_symbol = 'ETH' and sell_amount_atomic::numeric <= 5000000000000000)
        or (sell_token_symbol = 'USDG' and sell_amount_atomic::numeric <= 12500000)
      )
    ),
  constraint agent_trade_rules_shape_check
    check (
      (
        kind = 'dca'
        and interval_hours in (24, 168)
        and trigger_price_usd is null
        and next_run_at is not null
      )
      or (
        kind in ('stop_loss', 'take_profit')
        and interval_hours is null
        and trigger_price_usd > 0
        and trigger_price_usd < 1000000
        and sell_token_symbol = 'ETH'
        and buy_token_symbol = 'USDG'
      )
    )
);

create index if not exists agent_trade_rules_due_idx
  on public.agent_trade_rules (enabled, kind, next_run_at);
create index if not exists agent_trade_rules_agent_idx
  on public.agent_trade_rules (agent_id);

alter table public.agent_trade_rules enable row level security;

drop policy if exists "Workspace owners can read trade rules" on public.agent_trade_rules;
create policy "Workspace owners can read trade rules" on public.agent_trade_rules
  for select to authenticated using ((select public.owns_workspace(workspace_id)));

revoke all privileges on public.agent_trade_rules from public, anon, authenticated, service_role;
grant select on public.agent_trade_rules to authenticated;
grant select, insert, update, delete on public.agent_trade_rules to service_role;

create or replace function public.add_agent_trade_rule(
  p_agent_id uuid,
  p_kind text,
  p_sell_token_symbol text,
  p_buy_token_symbol text,
  p_sell_amount_atomic text,
  p_interval_hours integer,
  p_trigger_price_usd numeric
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
    select count(*) from public.agent_trade_rules rules
    where rules.agent_id = p_agent_id and rules.enabled
  ) >= 5 then
    return 'limit_reached';
  end if;

  insert into public.agent_trade_rules (
    agent_id, workspace_id, kind, sell_token_symbol, buy_token_symbol,
    sell_amount_atomic, interval_hours, trigger_price_usd, next_run_at
  ) values (
    p_agent_id, v_workspace_id, p_kind, p_sell_token_symbol, p_buy_token_symbol,
    p_sell_amount_atomic, p_interval_hours, p_trigger_price_usd,
    case when p_kind = 'dca' then now() else null end
  );

  return 'added';
end;
$$;

create or replace function public.clear_agent_trade_rules(
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
  delete from public.agent_trade_rules rules where rules.agent_id = p_agent_id;
  get diagnostics v_removed = row_count;
  return v_removed;
end;
$$;

create or replace function public.list_agent_trade_rules(
  p_agent_id uuid
) returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', rules.id,
    'kind', rules.kind,
    'sell', rules.sell_token_symbol,
    'buy', rules.buy_token_symbol,
    'amount', rules.sell_amount_atomic,
    'interval_hours', rules.interval_hours,
    'trigger_price_usd', rules.trigger_price_usd,
    'next_run_at', rules.next_run_at,
    'enabled', rules.enabled
  ) order by rules.created_at), '[]'::jsonb)
  from public.agent_trade_rules rules
  where rules.agent_id = p_agent_id and rules.enabled;
$$;

revoke all on function public.add_agent_trade_rule(uuid,text,text,text,text,integer,numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.clear_agent_trade_rules(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_agent_trade_rules(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.add_agent_trade_rule(uuid,text,text,text,text,integer,numeric)
  to service_role;
grant execute on function public.clear_agent_trade_rules(uuid) to service_role;
grant execute on function public.list_agent_trade_rules(uuid) to service_role;

commit;
