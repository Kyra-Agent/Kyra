begin;

do $$
begin
  if to_regclass('public.swap_quote_reviews') is null then
    raise exception 'public.swap_quote_reviews missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.swap_quote_reviews'::regclass
      and tgname = 'reject_swap_quote_review_mutation'
      and not tgisinternal
  ) then
    raise exception 'swap quote immutability trigger missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.swap_quote_reviews'::regclass
      and tgname = 'enforce_swap_quote_review_agent_scope'
      and not tgisinternal
  ) then
    raise exception 'swap quote agent scope trigger missing';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.swap_quote_reviews'::regclass
      and relrowsecurity
  ) then
    raise exception 'swap quote RLS must remain enabled';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'swap_quote_reviews'
  ) then
    raise exception 'swap quote table must remain service-only';
  end if;
  if has_table_privilege('anon', 'public.swap_quote_reviews', 'select')
    or has_table_privilege('authenticated', 'public.swap_quote_reviews', 'select')
    or has_table_privilege('anon', 'public.swap_quote_reviews', 'insert')
    or has_table_privilege('authenticated', 'public.swap_quote_reviews', 'insert')
    or has_table_privilege('anon', 'public.swap_quote_reviews', 'update')
    or has_table_privilege('authenticated', 'public.swap_quote_reviews', 'update')
    or has_table_privilege('anon', 'public.swap_quote_reviews', 'delete')
    or has_table_privilege('authenticated', 'public.swap_quote_reviews', 'delete')
  then
    raise exception 'swap quote table grants are too broad';
  end if;
  if not has_table_privilege('service_role', 'public.swap_quote_reviews', 'select')
    or not has_table_privilege('service_role', 'public.swap_quote_reviews', 'insert')
    or has_table_privilege('service_role', 'public.swap_quote_reviews', 'update')
    or has_table_privilege('service_role', 'public.swap_quote_reviews', 'delete')
    or has_table_privilege('service_role', 'public.swap_quote_reviews', 'truncate')
    or has_table_privilege('service_role', 'public.swap_quote_reviews', 'references')
    or has_table_privilege('service_role', 'public.swap_quote_reviews', 'trigger')
  then
    raise exception 'swap quote service role grants are not least privilege';
  end if;
end;
$$;

rollback;