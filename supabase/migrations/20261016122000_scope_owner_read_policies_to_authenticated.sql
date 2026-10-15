begin;

-- The privacy-boundary hardening revoked anon access to owns_workspace(), but
-- several owner read policies still applied to every role. Anonymous reads of
-- public profiles then evaluated those policies and failed with a permission
-- error. Owner policies only make sense for signed-in accounts, so scope them
-- to authenticated; anon keeps only the explicit public-profile policy.
alter policy "Workspace owners can read activity logs"
on public.activity_logs
to authenticated;

alter policy "Workspace owners can read agent instances"
on public.agent_instances
to authenticated;

alter policy "Workspace owners can read approval requests"
on public.approval_requests
to authenticated;

alter policy "Workspace owners can read prepared actions"
on public.prepared_actions
to authenticated;

alter policy "Workspace owners can read telegram sessions"
on public.telegram_sessions
to authenticated;

alter policy "Workspace owners can read wallet policies"
on public.wallet_policies
to authenticated;

commit;
