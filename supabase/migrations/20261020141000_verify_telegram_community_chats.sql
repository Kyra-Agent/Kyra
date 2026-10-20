do $$
begin
  if not exists (
    select 1 from pg_class
    where oid = 'public.telegram_community_chats'::regclass and relrowsecurity
  ) or not exists (
    select 1 from pg_class
    where oid = 'public.telegram_community_usage'::regclass and relrowsecurity
  ) then
    raise exception 'community tables must have row level security enabled';
  end if;

  if has_table_privilege('anon', 'public.telegram_community_chats', 'select')
    or has_table_privilege('authenticated', 'public.telegram_community_chats', 'insert')
    or has_table_privilege('authenticated', 'public.telegram_community_chats', 'update')
    or has_table_privilege('anon', 'public.telegram_community_usage', 'select')
    or has_table_privilege('authenticated', 'public.telegram_community_usage', 'select')
  then
    raise exception 'community tables must stay backend-only for writes';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.set_telegram_community_chat(uuid,text,text,text,boolean)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'anon',
    'public.consume_telegram_community_quota(uuid,text,text)'::regprocedure,
    'execute'
  ) then
    raise exception 'community functions must stay backend-only';
  end if;

  if position(
    'not_owner'
    in pg_get_functiondef(
      'public.set_telegram_community_chat(uuid,text,text,text,boolean)'::regprocedure
    )
  ) = 0 then
    raise exception 'community enable must verify the linked owner';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'kyra-purge-telegram-community-usage'
  ) then
    raise exception 'community usage purge job missing';
  end if;
end;
$$;
