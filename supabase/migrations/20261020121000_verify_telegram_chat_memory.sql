do $$
begin
  if not exists (
    select 1
    from pg_class
    where oid = 'public.telegram_chat_memory'::regclass
      and relrowsecurity
  ) then
    raise exception 'telegram chat memory must have row level security enabled';
  end if;

  if has_table_privilege('anon', 'public.telegram_chat_memory', 'select')
    or has_table_privilege('authenticated', 'public.telegram_chat_memory', 'select')
    or has_table_privilege('authenticated', 'public.telegram_chat_memory', 'insert')
  then
    raise exception 'telegram chat memory must stay backend-only';
  end if;

  if has_function_privilege(
    'anon',
    'public.load_telegram_chat_memory(uuid,text)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.append_telegram_chat_memory(uuid,text,text,text)'::regprocedure,
    'execute'
  ) or has_function_privilege(
    'authenticated',
    'public.forget_telegram_chat_memory(uuid,text)'::regprocedure,
    'execute'
  ) then
    raise exception 'telegram chat memory functions must stay backend-only';
  end if;

  if position(
    'limit 6'
    in pg_get_functiondef(
      'public.append_telegram_chat_memory(uuid,text,text,text)'::regprocedure
    )
  ) = 0 then
    raise exception 'telegram chat memory must keep at most six messages';
  end if;

  if position(
    '24 hours'
    in pg_get_functiondef(
      'public.load_telegram_chat_memory(uuid,text)'::regprocedure
    )
  ) = 0 then
    raise exception 'telegram chat memory reads must ignore messages older than 24 hours';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.telegram_chat_memory'::regclass
      and contype = 'f'
      and confrelid = 'public.telegram_sessions'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'telegram chat memory must cascade with its Telegram session';
  end if;

  if not exists (
    select 1
    from cron.job
    where jobname = 'kyra-purge-telegram-chat-memory'
      and command like '%interval ''24 hours''%'
  ) then
    raise exception 'telegram chat memory purge job missing';
  end if;
end;
$$;
