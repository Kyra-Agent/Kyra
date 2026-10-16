begin;

-- Supabase's ensure_rls event trigger function is SECURITY DEFINER and was
-- executable by API roles. Event triggers fire without an EXECUTE check, so
-- revoking it only removes the RPC surface flagged by the security advisor.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
    from public, anon, authenticated;
  end if;
end;
$$;

-- Evaluate auth.uid() once per statement instead of once per row, and keep
-- workspace reads to signed-in accounts.
alter policy "Users can read their own workspaces"
on public.workspaces
to authenticated
using (owner_user_id = (select auth.uid()));

alter policy "Workspace owners can read execution results"
on public.execution_results
using (
  (select auth.uid()) = owner_user_id
  and public.owns_workspace(workspace_id)
);

commit;
