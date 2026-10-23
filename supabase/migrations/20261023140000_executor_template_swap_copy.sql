begin;

-- The Executor card described swaps and DCA as planning drafts with a
-- "future execution path". Owners now run them: /swap and due DCA or price
-- rules open a live Uniswap quote they confirm in their own wallet. The
-- example used USDC and an amount above the swap cap.
update public.agent_templates
set role = 'Rule-based swap agent',
    summary = 'A swap agent for ETH and USDG on Uniswap: /swap from Telegram, DCA schedules, and stop-loss or take-profit prompts, each confirmed in your own wallet within hard limits.',
    best_for = 'Owners who want rule-driven swaps without handing over keys: Kyra prompts, your wallet decides.',
    terminal_seed = '/dca 0.001 ETH daily'
where id = 'executor';

commit;
