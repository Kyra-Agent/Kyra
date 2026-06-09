-- READ-ONLY DIAGNOSTIC - SAFE TO RUN FROM SUPABASE SQL EDITOR.
-- This query does not create, alter, grant, revoke, insert, update, or delete.
-- It intentionally avoids token_secret_ref, webhook secret refs, owner_user_id,
-- raw BotFather tokens, challenge hashes, and Telegram user/chat identifiers.
--
-- Purpose:
-- - Explain why the owner-link issue flow can return owner_link_unavailable.
-- - Use this before changing gates, deploying functions, or re-running connect.

with agent_scope as (
  select
    agents.id as agent_id,
    agents.display_name,
    agents.public_slug,
    agents.created_at as agent_created_at
  from public.agent_instances agents
  order by agents.created_at desc
  limit 20
),
session_rollup as (
  select
    sessions.agent_id,
    count(*) filter (where sessions.webhook_status = 'active') as active_session_count,
    count(*) filter (where sessions.webhook_status = 'queued') as queued_session_count,
    count(*) filter (where sessions.webhook_status = 'paused') as paused_session_count,
    count(*) filter (where sessions.webhook_status = 'mocked') as mocked_session_count,
    max(sessions.created_at) as latest_session_created_at,
    coalesce(
      (
        array_agg(
          sessions.bot_handle
          order by
            case sessions.webhook_status
              when 'active' then 0
              when 'queued' then 1
              when 'paused' then 2
              else 3
            end,
            sessions.created_at desc
        )
      )[1],
      null
    ) as selected_bot_handle,
    coalesce(
      (
        array_agg(
          sessions.webhook_status
          order by
            case sessions.webhook_status
              when 'active' then 0
              when 'queued' then 1
              when 'paused' then 2
              else 3
            end,
            sessions.created_at desc
        )
      )[1],
      null
    ) as selected_webhook_status
  from public.telegram_sessions sessions
  where sessions.agent_id in (select agent_id from agent_scope)
  group by sessions.agent_id
),
authorization_rollup as (
  select
    authorizations.agent_id,
    count(*) filter (
      where authorizations.role = 'owner'
        and authorizations.command_scope = 'read_only'
        and authorizations.revoked_at is null
    ) as active_owner_authorization_count
  from public.telegram_chat_authorizations authorizations
  where authorizations.agent_id in (select agent_id from agent_scope)
  group by authorizations.agent_id
),
challenge_rollup as (
  select
    challenges.agent_id,
    count(*) filter (
      where challenges.consumed_at is null
        and challenges.revoked_at is null
        and challenges.expires_at > now()
    ) as open_challenge_count,
    count(*) filter (
      where challenges.created_at >= now() - interval '15 minutes'
    ) as recent_agent_issue_count_15m
  from public.telegram_owner_link_challenges challenges
  where challenges.agent_id in (select agent_id from agent_scope)
  group by challenges.agent_id
)
select
  agent_scope.display_name,
  agent_scope.public_slug,
  agent_scope.agent_id,
  coalesce(session_rollup.selected_webhook_status, 'none') as selected_webhook_status,
  session_rollup.selected_bot_handle,
  coalesce(session_rollup.active_session_count, 0) as active_session_count,
  coalesce(session_rollup.queued_session_count, 0) as queued_session_count,
  coalesce(session_rollup.paused_session_count, 0) as paused_session_count,
  coalesce(session_rollup.mocked_session_count, 0) as mocked_session_count,
  coalesce(authorization_rollup.active_owner_authorization_count, 0) as active_owner_authorization_count,
  coalesce(challenge_rollup.open_challenge_count, 0) as open_challenge_count,
  coalesce(challenge_rollup.recent_agent_issue_count_15m, 0) as recent_agent_issue_count_15m,
  case
    when coalesce(authorization_rollup.active_owner_authorization_count, 0) > 0
      then 'already_linked'
    when coalesce(session_rollup.active_session_count, 0) = 0
      then 'no_active_session'
    when coalesce(session_rollup.active_session_count, 0) > 1
      then 'duplicate_active_sessions'
    when coalesce(challenge_rollup.recent_agent_issue_count_15m, 0) >= 3
      then 'agent_issue_rate_limited'
    else 'ready_to_issue_owner_link'
  end as owner_link_issue_diagnostic,
  session_rollup.latest_session_created_at
from agent_scope
left join session_rollup
  on session_rollup.agent_id = agent_scope.agent_id
left join authorization_rollup
  on authorization_rollup.agent_id = agent_scope.agent_id
left join challenge_rollup
  on challenge_rollup.agent_id = agent_scope.agent_id
order by agent_scope.agent_created_at desc;
