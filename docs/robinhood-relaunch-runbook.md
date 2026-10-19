# Robinhood Chain Relaunch Runbook

Status: backend relaunched on 2026-10-16; frontend hosting is blocked on
Netlify team billing.

## Relaunch Record - 2026-10-16

- The original Supabase project was restored by its owner and is
  `ACTIVE_HEALTHY`. Its data, Auth users, and Edge Function secrets survived,
  so no new project was created.
- The four relaunch migrations (template catalog seed and verification, owner
  read policy scope and verification) were applied with `supabase db push`;
  both verification migrations passed.
- All fifteen Edge Functions were redeployed from `main` with their JWT
  settings unchanged.
- Read-only production checks passed: the six-template catalog is public,
  anonymous public agent profiles load again, private tables reject anonymous
  reads, unauthenticated function calls return `401`, CORS preflight returns
  `200`, and the Telegram webhook and chain status provider reject requests
  without their secrets.
- The original `kyra-agent` Netlify site is disabled because the owning
  **Kyra-Agent** team subscription was cancelled after a failed payment; the
  cancelled team is read-only and still holds `kyraagent.xyz`.
- A replacement site, `kyraagent` (`https://kyraagent.netlify.app`), was created
  in the active Free team and deployed from `main` with its frontend
  environment variables. Visitor login protection was disabled for that site so
  the product is public. All routes return `200` with the production security
  headers. The latest production deploy is `72efc55` (Motion v2 interface
  layer, which also ships the origin-aware signup redirect).

### Remaining: Move `kyraagent.xyz`

Status on 2026-10-16: the cancelled team cannot be opened from the owning
account (its dashboard is restricted for non-payment and its team pages return
"Page not found"), so the release was requested from Netlify Support with the
"Release a domain from another account" form. Ownership was verified with the
TXT record `verified-for-netlify.kyraagent.xyz`, which must stay in Hostinger
DNS until the domain moves (it is valid for seven days). Once Support releases
the domain, continue from step 2 below and then delete that TXT record.

Re-checked later on 2026-10-16: not released yet. Attaching the domain to
`kyraagent` still fails with `custom_domain must be unique` (held by the old
site `9f030e51-…`), and `https://kyraagent.xyz` serves the disabled site's
Netlify `404`. The TXT record is still published.

Released on 2026-10-19 (support case 1145278). On 2026-10-20 `kyraagent.xyz`
became the primary domain of `kyraagent` with `www.kyraagent.xyz` as an alias
and forced HTTPS. Verified: apex, `/dashboard`, `/how-it-works`, a public
agent route, and `og-card.png` return `200` over HTTPS; `http://` and `www`
redirect `301` to `https://kyraagent.xyz`; CORS allowlists accept the origin.
Remaining owner steps: point the Hostinger `www` CNAME at
`kyraagent.netlify.app` (it still names the old `kyra-agent.netlify.app`),
delete the `verified-for-netlify` TXT record, switch the Supabase Auth Site URL
back to `https://kyraagent.xyz`, and confirm the managed certificate (expiring
2026-10-30) renews.

The general procedure:

1. In the cancelled **Kyra-Agent** team, open the `kyra-agent` project and
   remove `kyraagent.xyz` under Domain management (or delete that project).
   If the dashboard blocks changes, ask Netlify support to release the domain.
2. In the Free team project `kyraagent`, add `kyraagent.xyz` as the primary
   domain. If Netlify asks for ownership verification, add the TXT record it
   shows at Hostinger.
3. At Hostinger, point `www` to `kyraagent.netlify.app` (it currently targets
   the old `kyra-agent.netlify.app`). The apex `A` record `75.2.60.5` stays.
4. Wait for the Let's Encrypt certificate, then confirm
   `https://kyraagent.xyz/` returns `200`.

Until the domain moves, protected transfer and swap calls from
`kyraagent.netlify.app` fail closed because the Edge Function CORS allowlists
only accept `kyraagent.xyz`.

The sections below remain the procedure for a full reprovision, if the hosted
project is ever lost again.

## Why A Relaunch Is Required

- The previous Supabase project stopped resolving while it was paused. Its
  database, Auth users, Edge Function secrets, and Telegram webhook targets
  were unreachable until the owner restored it.
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
