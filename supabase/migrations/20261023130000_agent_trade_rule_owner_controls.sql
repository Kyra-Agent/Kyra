begin;

-- Owner controls for trade rules from the dashboard: pause or resume one
-- rule, or delete it. The agent-trade-rules Edge Function proves ownership
-- first and is the only caller; both functions stay service-role only.

create or replace function public.set_agent_trade_rule_enabled(
  p_agent_id uuid,
  p_rule_id uuid,
  p_enabled boolean
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_rule public.agent_trade_rules%rowtype;
begin
  -- Serialises changes per agent so two resumes cannot both pass the cap.
  perform 1 from public.agent_instances agents
  where agents.id = p_agent_id
  for update;

  select * into v_rule
  from public.agent_trade_rules rules
  where rules.id = p_rule_id and rules.agent_id = p_agent_id
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_rule.enabled = p_enabled then
    return 'unchanged';
  end if;

  if p_enabled and (
    select count(*) from public.agent_trade_rules rules
    where rules.agent_id = p_agent_id and rules.enabled
  ) >= 5 then
    return 'limit_reached';
  end if;

  -- A resumed DCA rule that missed runs while paused comes due at the next
  -- monitor run instead of firing once per missed interval.
  update public.agent_trade_rules rules
  set enabled = p_enabled,
      next_run_at = case
        when p_enabled and rules.kind = 'dca' and rules.next_run_at < now() then now()
        else rules.next_run_at
      end
  where rules.id = p_rule_id;

  return case when p_enabled then 'resumed' else 'paused' end;
end;
$$;

create or replace function public.delete_agent_trade_rule(
  p_agent_id uuid,
  p_rule_id uuid
) returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  delete from public.agent_trade_rules rules
  where rules.id = p_rule_id and rules.agent_id = p_agent_id;

  return case when found then 'deleted' else 'not_found' end;
end;
$$;

revoke all on function public.set_agent_trade_rule_enabled(uuid,uuid,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.delete_agent_trade_rule(uuid,uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.set_agent_trade_rule_enabled(uuid,uuid,boolean) to service_role;
grant execute on function public.delete_agent_trade_rule(uuid,uuid) to service_role;

commit;
