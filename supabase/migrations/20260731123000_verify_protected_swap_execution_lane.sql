begin;

do $$
declare
  intent_delete_action "char";
  result_delete_action "char";
begin
  if to_regclass('public.swap_execution_intents') is null then
    raise exception 'public.swap_execution_intents missing';
  end if;
  if to_regclass('public.swap_execution_results') is null then
    raise exception 'public.swap_execution_results missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.swap_execution_intents'::regclass
      and tgname = 'enforce_swap_execution_intent_on_insert'
      and not tgisinternal
  ) then
    raise exception 'swap execution intent scope trigger missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.swap_execution_intents'::regclass
      and tgname = 'prevent_swap_execution_intent_update'
      and not tgisinternal
  ) then
    raise exception 'swap execution intent immutability trigger missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.swap_execution_results'::regclass
      and tgname = 'enforce_swap_execution_result_on_write'
      and not tgisinternal
  ) then
    raise exception 'swap execution result transition trigger missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.swap_execution_intents'::regclass
      and conname = 'swap_execution_intents_step_shape_check'
      and contype = 'c'
      and convalidated
      and pg_get_constraintdef(oid) ilike '%token_address IS NOT NULL%'
      and pg_get_constraintdef(oid) ilike '%allowance_amount_atomic IS NOT NULL%'
  ) then
    raise exception 'swap execution allowance null-safety constraint missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.enforce_swap_execution_intent()'::regprocedure
      and pg_get_functiondef(oid) ilike '%new.token_address is null%'
      and pg_get_functiondef(oid) ilike '%new.spender_address is null%'
      and pg_get_functiondef(oid) ilike '%new.allowance_amount_atomic is null%'
  ) then
    raise exception 'swap execution allowance trigger null-safety missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.enforce_swap_execution_result()'::regprocedure
      and pg_get_functiondef(oid) ilike '%old.status in (''confirmed'', ''failed'')%'
      and pg_get_functiondef(oid) ilike '%new.receipt_block_number is distinct from old.receipt_block_number%'
      and pg_get_functiondef(oid) ilike '%new.receipt_checked_at is distinct from old.receipt_checked_at%'
  ) then
    raise exception 'swap execution terminal result immutability missing';
  end if;

  if not exists (
    select 1 from pg_class
    where oid = 'public.swap_execution_intents'::regclass
      and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.swap_execution_results'::regclass
      and relrowsecurity
  ) then
    raise exception 'swap execution RLS must remain enabled';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('swap_execution_intents', 'swap_execution_results')
  ) then
    raise exception 'swap execution tables must remain service-only';
  end if;

  if has_table_privilege('anon', 'public.swap_execution_intents', 'select')
    or has_table_privilege('authenticated', 'public.swap_execution_intents', 'select')
    or has_table_privilege('anon', 'public.swap_execution_results', 'select')
    or has_table_privilege('authenticated', 'public.swap_execution_results', 'select')
    or has_table_privilege('anon', 'public.swap_execution_intents', 'insert')
    or has_table_privilege('authenticated', 'public.swap_execution_intents', 'insert')
    or has_table_privilege('anon', 'public.swap_execution_results', 'insert')
    or has_table_privilege('authenticated', 'public.swap_execution_results', 'insert')
  then
    raise exception 'swap execution grants are too broad';
  end if;

  if not has_table_privilege('service_role', 'public.swap_execution_intents', 'select')
    or not has_table_privilege('service_role', 'public.swap_execution_intents', 'insert')
    or has_table_privilege('service_role', 'public.swap_execution_intents', 'update')
    or has_table_privilege('service_role', 'public.swap_execution_intents', 'delete')
    or not has_table_privilege('service_role', 'public.swap_execution_results', 'select')
    or not has_table_privilege('service_role', 'public.swap_execution_results', 'insert')
    or not has_table_privilege('service_role', 'public.swap_execution_results', 'update')
    or has_table_privilege('service_role', 'public.swap_execution_results', 'delete')
  then
    raise exception 'swap execution service role grants are not least privilege';
  end if;

  select confdeltype
  into intent_delete_action
  from pg_constraint
  where conrelid = 'public.swap_execution_intents'::regclass
    and contype = 'f'
    and confrelid = 'public.swap_quote_reviews'::regclass;

  select confdeltype
  into result_delete_action
  from pg_constraint
  where conrelid = 'public.swap_execution_results'::regclass
    and contype = 'f'
    and confrelid = 'public.swap_execution_intents'::regclass;

  if intent_delete_action is distinct from 'c'
    or result_delete_action is distinct from 'c'
  then
    raise exception 'swap execution account deletion cascade is incomplete';
  end if;
end;
$$;

rollback;
