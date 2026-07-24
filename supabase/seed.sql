insert into public.agent_templates (
  id,
  name,
  role,
  status,
  summary,
  best_for,
  actions,
  modules,
  terminal_seed
) values
(
  'operator',
  'Operator',
  'Personal wallet readiness agent',
  'mvp',
  'A private Telegram-native agent for wallet checks, swap reviews, transfer reviews, action logs, and approval-gated Robinhood Chain readiness.',
  'Traders, founders, and Robinhood Chain users who want a safe command layer for wallet review workflows.',
  '["balance", "swap review", "transfer review", "portfolio", "tx history", "price alert"]'::jsonb,
  '["NIRA-01", "NOVA-04", "NYX-05"]'::jsonb,
  'review 10 USDC to ETH swap'
),
(
  'scout',
  'Scout',
  'Recon and launch monitor',
  'mvp',
  'A research-forward agent that watches new launches, token activity, and Robinhood Chain ecosystem signals before summarizing what matters.',
  'Users tracking launches, new tokens, project signals, and onchain opportunities.',
  '["launch monitor", "token scan", "watchlist", "market brief", "project summary"]'::jsonb,
  '["NIRA-01", "VEXA-02", "ASTRA-03", "NOVA-04", "NYX-05"]'::jsonb,
  'scan new Robinhood Chain launches'
),
(
  'steward',
  'Steward',
  'Project and community agent',
  'mvp',
  'A public-facing agent for token communities that can answer project questions, verify holders, and surface token context.',
  'Token teams, creator coins, Robinhood Chain communities, and project founders.',
  '["faq", "holder verify", "token info", "announcement", "tx summary"]'::jsonb,
  '["NIRA-01", "ASTRA-03", "NOVA-04", "NYX-05"]'::jsonb,
  'verify holder access'
),
(
  'executor',
  'Executor',
  'Rule-based action readiness agent',
  'advanced',
  'An advanced agent for conditional swap reviews, DCA plans, stop loss checks, and controlled automation drafts with hard approval limits.',
  'Power users who want rule-driven planning with strict safety controls before any future execution path.',
  '["conditional review", "dca plan", "stop loss check", "lp review", "lend review"]'::jsonb,
  '["NIRA-01", "NOVA-04", "NYX-05"]'::jsonb,
  'set dca 25 USDC into ETH daily'
),
(
  'strategist',
  'Strategist',
  'Market and campaign intelligence agent',
  'mvp',
  'A planning agent that turns token, market, and community context into launch narratives, campaign plans, and decision-ready briefs.',
  'Projects and operators who need sharper positioning, launch messaging, and market-aware plans before pushing announcements or owner-approved actions.',
  '["market brief", "campaign plan", "narrative map", "launch copy", "community pulse"]'::jsonb,
  '["ASTRA-03", "NOVA-04", "VEXA-02"]'::jsonb,
  'draft market-aware campaign plan'
),
(
  'custom',
  'Custom',
  'Build your own agent',
  'mvp',
  'Choose the personality, modules, actions, and safety limits for a Kyra agent built around a specific workflow.',
  'Teams that want a tailored agent without starting from a blank page.',
  '["choose modules", "choose actions", "custom prompt", "safety limits"]'::jsonb,
  '["NIRA-01", "NYX-05"]'::jsonb,
  'compile custom agent profile'
)
on conflict (id) do update set
  name = excluded.name,
  role = excluded.role,
  status = excluded.status,
  summary = excluded.summary,
  best_for = excluded.best_for,
  actions = excluded.actions,
  modules = excluded.modules,
  terminal_seed = excluded.terminal_seed;

delete from public.agent_templates
where id = 'launcher'
  and not exists (
    select 1
    from public.agent_instances
    where template_id = 'launcher'
  );
