do $$
begin
  if exists (select 1 from public.agent_templates where id = 'executor')
    and not exists (
      select 1 from public.agent_templates
      where id = 'executor'
        and role = 'Rule-based swap agent'
        and terminal_seed = '/dca 0.001 ETH daily'
        and summary not like '%future execution%'
        and best_for not like '%future execution%'
    )
  then
    raise exception 'executor template copy must describe the live swap flow';
  end if;
end;
$$;
