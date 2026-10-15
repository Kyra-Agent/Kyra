# Robinhood Chain Relaunch Runbook

Status: prepared on 2026-10-16. Production is offline and must be
reprovisioned before Kyra can serve users again.

## Why A Relaunch Is Required

- The previous Supabase project no longer resolves. Its database, Auth users,
  Edge Function secrets, and Telegram webhook targets are gone.
- The Netlify site still owns the `kyraagent.xyz` domain but serves `404` for
  every route, including the last published deploy. The owning Netlify team must
  be reactivated or its billing restored.
- The previous official KYRA contract has been retired from the product. Every
  KYRA transfer, allowance, and swap path fails closed until a new contract is
  published (see [Publishing The Official KYRA Contract](#publishing-the-official-kyra-contract)).

Nothing in this runbook enables Telegram signing, public-profile execution,
autonomous execution, swaps, or arbitrary calldata.

## 0. Account Identity

Every outward action must run under the official Kyra identity only.

| Service | Required identity | Check |
| --- | --- | --- |
| GitHub | `Kyra-Agent` | `gh auth status` shows `Kyra-Agent` as the active account |
| Git commits | `Kyra-Agent <289309101+Kyra-Agent@users.noreply.github.com>` | `git config user.name` and `git config user.email` in this repository |
| Netlify | a member of the `kyra-agent` team | `netlify status` lists the `kyra-agent` team |
| Supabase | the Kyra organization owner | `supabase projects list` shows the Kyra organization |

Do not push, deploy, or link while another personal account is active.

## 1. Local Verification

Run the full gate before touching production:

```bash
npm ci
npx tsc --noEmit
npm run check:product
npm run test:all
npm run build:robinhood-mainnet
npm audit --audit-level=high
```

Optionally rehearse the complete backend locally with Docker:

```bash
supabase start
supabase functions serve --env-file <local-functions-env>
npx vite --mode localstack
```

`supabase start` applies every migration to an empty database, which is the
same path a fresh hosted project takes.

## 2. Supabase Project

1. Create a new project in the Kyra organization (region close to users).
2. Link it from this repository:

   ```bash
   supabase link --project-ref <new-project-ref>
   ```

3. Apply the schema. Fresh projects receive the full baseline, every hardening
   migration, the six-template catalog, and the owner-policy scope fix:

   ```bash
   supabase db push
   ```

4. Auth settings: set the Site URL to `https://kyraagent.xyz`, add
   `https://kyraagent.xyz/**` as a redirect URL, and keep email confirmation
   enabled.
5. Set Edge Function secrets. Every key is listed in
   `supabase/functions/.env.example`; gates accept only the exact value `true`.
   Production values for the live product:

   | Area | Keys | Value |
   | --- | --- | --- |
   | Deploy | `KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED` | `true` |
   | Deploy | `KYRA_DEMO_AGENT_LIMIT` | `3` |
   | Telegram connect | `KYRA_TELEGRAM_CONNECT_GETME_ENABLED`, `..._STORE_ENABLED`, `..._SESSION_WRITE_ENABLED`, `..._WEBHOOK_REGISTER_ENABLED` | `true` |
   | Telegram webhook URL | `KYRA_TELEGRAM_WEBHOOK_URL` | `https://<new-project-ref>.supabase.co/functions/v1/telegram-webhook` |
   | Telegram lifecycle | `KYRA_TELEGRAM_LINK_ISSUE_ENABLED`, `KYRA_TELEGRAM_DISCONNECT_ENABLED` | `true` |
   | Telegram webhook | `KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED`, `..._PARSE_ENABLED`, `..._OWNER_LINK_CONSUME_ENABLED`, `..._CHAT_AUTH_ENABLED`, `..._CLAIM_ENABLED`, `..._TEMPLATE_CONTEXT_ENABLED`, `..._DELIVERY_ENABLED` | `true` |
   | Agent brain | `KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_ENABLED`, `..._AGENT_BRAIN_PROVIDER_ENABLED` | `true` |
   | Agent brain | `KYRA_TELEGRAM_AGENT_BRAIN_ENDPOINT`, `KYRA_TELEGRAM_AGENT_BRAIN_MODEL`, `KYRA_TELEGRAM_AGENT_BRAIN_API_KEY` | OpenRouter endpoint, model, dedicated key |
   | Robinhood RPC | `KYRA_ROBINHOOD_MAINNET_RPC_URL`, `KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS` | managed HTTPS RPC and its exact host |
   | Chain identity | `KYRA_CHAIN_KEY`, `KYRA_CHAIN_ID` | `robinhood_mainnet`, `4663` |
   | Chain status | `KYRA_CHAIN_STATUS_PROVIDER_ENABLED`, `KYRA_CHAIN_ACTION_PREPARE_ENABLED` | `true` |
   | Chain status | `KYRA_CHAIN_PROVIDER_SHARED_SECRET`, `KYRA_CHAIN_RPC_PROVIDER` | fresh random secret, `managed_private` |
   | Chain status | `KYRA_CHAIN_STATUS_ENDPOINT`, `KYRA_CHAIN_STATUS_ENDPOINT_HOST` | the new `chain-status-provider` URL and its host |
   | Protected swap | `KYRA_PROTECTED_SWAP_EXECUTION_ENABLED` | `false` until T2 release |

   Load them from a local file that is never committed:

   ```bash
   supabase secrets set --env-file <production-functions-env>
   ```

6. Deploy every Edge Function with the JWT settings in `supabase/config.toml`:

   ```bash
   supabase functions deploy
   ```

## 3. Netlify

1. Restore the `kyra-agent` Netlify team (billing or credits) so the site stops
   returning `404`.
2. Update the site environment:
   - `VITE_SUPABASE_URL` = `https://<new-project-ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = the new project's publishable or anon key
3. Confirm `netlify.toml` still builds `npm run build:robinhood-mainnet`.
4. Trigger a production deploy from the reviewed `main` commit.

## 4. Smoke Test

- `https://kyraagent.xyz/` and `/dashboard` return `200` with security headers.
- Create an account, deploy an agent, and open its public profile while signed
  out.
- Connect a fresh BotFather token, complete owner linking, and confirm `/help`
  and a natural-language reply.
- Connect a Robinhood Chain wallet and confirm the transfer lane reviews native
  ETH only; KYRA stays locked until the contract is published.
- Unauthenticated Edge Function calls return `401`; foreign origins return
  `403`; protected swap execution returns `swap_execution_disabled`.

Previously deployed agents and Telegram bots do not carry over. Bot owners must
reconnect through the deploy flow so a new webhook secret is registered.

## Publishing The Official KYRA Contract

Publish only after the new contract is deployed on Robinhood Chain mainnet and
announced on Kyra's official channels.

1. Set the checksummed address in both product sources:
   - `src/config/transferTransactionPolicy.ts` -> `publishedOfficialKyraTokenAddress`
   - `supabase/functions/_shared/transfer-transaction-policy.ts` -> `publishedOfficialKyraTokenAddress`
2. Add a migration that replaces the retired address in the database transfer
   and swap policy constraints and triggers with the new address, plus its
   verification migration.
3. Update `scripts/check-functions.mjs`, which currently requires both
   constants to stay unpublished.
4. Run the full local gate, deploy the migration and functions, then rebuild
   the frontend.
