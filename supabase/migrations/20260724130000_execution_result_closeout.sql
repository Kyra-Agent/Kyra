begin;

create table if not exists public.execution_results (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_id uuid not null references public.agent_instances(id) on delete cascade,
  prepared_action_id text not null check (
    char_length(prepared_action_id) between 1 and 160
  ),
  submission_key text not null check (
    submission_key ~ '^[0-9a-f]{64}$'
  ),
  chain_key text not null default 'robinhood_mainnet' check (
    chain_key = 'robinhood_mainnet'
  ),
  chain_id bigint not null default 4663 check (
    chain_id = 4663
  ),
  tx_hash text not null check (
    tx_hash ~* '^0x[0-9a-f]{64}$'
  ),
  status text not null check (
    status in ('submitted', 'confirmed', 'failed')
  ),
  failure_code text check (
    failure_code is null or failure_code in (
      'submission_failed',
      'transaction_reverted',
      'receipt_unavailable'
    )
  ),
  visibility text not null default 'owner-only' check (
    visibility = 'owner-only'
  ),
  submitted_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint execution_results_status_fields_check check (
    (status = 'submitted' and failure_code is null and confirmed_at is null)
    or (status = 'confirmed' and failure_code is null and confirmed_at is not null)
    or (status = 'failed' and failure_code is not null and confirmed_at is null)
  ),
  unique (owner_user_id, submission_key),
  unique (chain_id, tx_hash)
);

create index if not exists execution_results_owner_updated_idx
on public.execution_results(owner_user_id, updated_at desc);

create index if not exists execution_results_agent_updated_idx
on public.execution_results(agent_id, updated_at desc);

create or replace function public.enforce_execution_result_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.workspaces workspaces
    join public.agent_instances agents
      on agents.workspace_id = workspaces.id
    where workspaces.id = new.workspace_id
      and workspaces.owner_user_id = new.owner_user_id
      and agents.id = new.agent_id
  ) then
    raise exception 'execution_result_scope_mismatch' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_execution_result_scope() from public, anon, authenticated;

drop trigger if exists enforce_execution_result_scope_on_write on public.execution_results;
create trigger enforce_execution_result_scope_on_write
before insert or update of owner_user_id, workspace_id, agent_id
on public.execution_results
for each row
execute function public.enforce_execution_result_scope();

alter table public.execution_results enable row level security;

drop policy if exists "Workspace owners can read execution results"
on public.execution_results;
create policy "Workspace owners can read execution results"
on public.execution_results
for select
to authenticated
using (
  auth.uid() = owner_user_id
  and public.owns_workspace(workspace_id)
);

revoke all privileges on public.execution_results from public, anon, authenticated;
grant select on public.execution_results to authenticated;
grant all on public.execution_results to service_role;

commit;