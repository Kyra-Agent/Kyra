-- verify_agent_template_catalog_safety_copy
-- Verifier for agent_template_catalog_safety_copy_forward_review.sql.
-- Returns zero rows when the reviewed catalog copy is clean.

select
  id,
  role,
  summary,
  best_for,
  terminal_seed
from public.agent_templates
where
  role in (
    'Personal wallet action agent',
    'Rule-based action agent'
  )
  or summary ilike any (array[
    '%approval-driven execution%',
    '%swaps, sends%',
    '%conditional swaps%'
  ])
  or best_for ilike any (array[
    '%rule-driven execution%',
    '%onchain actions%'
  ])
  or terminal_seed = 'swap 10 USDC to ETH'
  or id = 'launcher';
