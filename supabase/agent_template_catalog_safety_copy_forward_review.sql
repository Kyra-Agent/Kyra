-- Phase 6 safety-copy review patch.
-- Apply only after review. This updates public agent template catalog copy so
-- backend data cannot imply live wallet or onchain execution.

begin;

update public.agent_templates
set
  role = 'Personal wallet readiness agent',
  summary = 'A private Telegram-native agent for wallet checks, swap reviews, transfer reviews, action logs, and approval-gated Base readiness.',
  best_for = 'Traders, founders, and Base users who want a safe command layer for wallet review workflows.',
  actions = '["balance", "swap review", "transfer review", "portfolio", "tx history", "price alert"]'::jsonb,
  terminal_seed = 'review 10 USDC to ETH swap'
where id = 'operator';

update public.agent_templates
set
  role = 'Rule-based action readiness agent',
  summary = 'An advanced agent for conditional swap reviews, DCA plans, stop loss checks, and controlled automation drafts with hard approval limits.',
  best_for = 'Power users who want rule-driven planning with strict safety controls before any future execution path.',
  actions = '["conditional review", "dca plan", "stop loss check", "lp review", "lend review"]'::jsonb
where id = 'executor';

update public.agent_templates
set
  best_for = 'Projects and operators who need sharper positioning, launch messaging, and market-aware plans before pushing announcements or owner-approved actions.'
where id = 'strategist';

delete from public.agent_templates
where id = 'launcher'
  and not exists (
    select 1
    from public.agent_instances
    where template_id = 'launcher'
  );

commit;
