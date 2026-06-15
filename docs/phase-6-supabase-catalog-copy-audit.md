# Phase 6 Supabase Catalog Copy Audit

Status: local fix prepared. Production DB write not applied in this commit.

## Why This Exists

The frontend now normalizes connected Supabase template rows through the
safety-reviewed local catalog, but the source database should still be cleaned
so Telegram context, deploy records, dashboard records, and future backend reads
do not inherit stale execution copy.

## Live Read-Only Audit

Read-only REST audit against `agent_templates` showed stale production rows:

| Template     | Live status                           |
| ------------ | ------------------------------------- |
| `operator`   | stale role and execution-style copy   |
| `executor`   | stale role and execution-style copy   |
| `strategist` | stale `onchain actions` best-for copy |
| `launcher`   | obsolete template still present       |

No secret values were printed during the audit.

## Local Fixes Prepared

- `supabase/seed.sql` now matches the safety-reviewed template catalog.
- `supabase/functions/deploy-agent/index.ts` now creates a swap review draft
  instead of a wallet approval/execution-style request.
- `src/services/supabaseDeployService.ts` now mirrors the same demo review log
  copy for frontend-created records.
- Telegram template context fixtures and classifier now cover `swap review`,
  `transfer review`, and the review-oriented executor actions.
- `scripts/check-supabase-catalog-copy.mjs` blocks stale catalog copy from
  returning.

## Production SQL Review

Prepared SQL:

- `supabase/agent_template_catalog_safety_copy_forward_review.sql`
- `supabase/verify_agent_template_catalog_safety_copy.sql`

Apply only after explicit approval. The verifier should return zero rows after
the forward review SQL is applied.

## Boundary

This does not enable wallet signing, Base MCP execution, Telegram execution, or
production gates. It only cleans catalog copy and demo review metadata.
