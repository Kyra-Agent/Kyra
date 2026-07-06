import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

const seed = read("supabase/seed.sql");
const deployAgent = read("supabase/functions/deploy-agent/index.ts");
const templateContext = read(
  "supabase/functions/telegram-webhook/template-context.ts",
);
const templateContextTest = read(
  "supabase/functions/telegram-webhook/template-context_test.ts",
);
const templateContextLookupTest = read(
  "supabase/functions/telegram-webhook/template-context-lookup_test.ts",
);
const frontendDeployService = read("src/services/supabaseDeployService.ts");
const catalogForwardReview = read(
  "supabase/agent_template_catalog_safety_copy_forward_review.sql",
);
const catalogVerifier = read(
  "supabase/verify_agent_template_catalog_safety_copy.sql",
);
const catalogAudit = read("docs/phase-6-supabase-catalog-copy-audit.md");
const readme = read("README.md");

const reviewedCopyTargets = [
  ["Supabase seed", seed],
  ["Deploy agent function", deployAgent],
  ["Frontend deploy service", frontendDeployService],
  ["Template context tests", templateContextTest],
  ["Template context lookup tests", templateContextLookupTest],
  ["Catalog forward review SQL", catalogForwardReview],
  ["Catalog audit doc", catalogAudit],
  ["README", readme],
];

assertIncludes("Supabase seed", seed, "Personal wallet readiness agent");
assertIncludes("Supabase seed", seed, "Rule-based action readiness agent");
assertIncludes(
  "Template context tests",
  templateContextTest,
  "Personal wallet readiness agent",
);
assertIncludes(
  "Template context tests",
  templateContextTest,
  "Rule-based action readiness agent",
);
assertIncludes(
  "Template context lookup tests",
  templateContextLookupTest,
  "Rule-based action readiness agent",
);
assertIncludes(
  "README",
  readme,
  "Personal wallet readiness and action review agent",
);
assertIncludes("README", readme, "Rule-based action readiness agent");
assertIncludes(
  "Catalog forward review SQL",
  catalogForwardReview,
  "Personal wallet readiness agent",
);
assertIncludes(
  "Catalog forward review SQL",
  catalogForwardReview,
  "Rule-based action readiness agent",
);
assertIncludes(
  "Catalog verifier SQL",
  catalogVerifier,
  "verify_agent_template_catalog_safety_copy",
);
assertIncludes(
  "Catalog audit doc",
  catalogAudit,
  "live Supabase catalog fix applied and verified",
);
assertIncludes("Catalog audit doc", catalogAudit, "returned zero rows");
assertIncludes("Catalog audit doc", catalogAudit, "stale=false");

assertIncludes("Supabase seed", seed, "approval-gated Base readiness");
assertIncludes("Supabase seed", seed, "swap review");
assertIncludes("Supabase seed", seed, "transfer review");
assertIncludes("Supabase seed", seed, "conditional review");
assertIncludes("Supabase seed", seed, "owner-approved actions");
assertIncludes("Deploy agent function", deployAgent, "Swap review draft");
assertIncludes(
  "Deploy agent function",
  deployAgent,
  "review 10 USDC to ETH swap",
);
assertIncludes(
  "Deploy agent function",
  deployAgent,
  "USDC -> WETH review route on Base",
);
assertIncludes("Deploy agent function", deployAgent, "review_draft: true");
assertIncludes(
  "Deploy agent function",
  deployAgent,
  "demo review draft persisted with wallet execution disabled",
);
assertIncludes(
  "Frontend deploy service",
  frontendDeployService,
  "demo review draft persisted with wallet execution disabled",
);
assertIncludes(
  "Catalog forward review SQL",
  catalogForwardReview,
  "review 10 USDC to ETH swap",
);
assertIncludes(
  "Catalog forward review SQL",
  catalogForwardReview,
  "where id = 'launcher'",
);
assertIncludes(
  "Catalog verifier SQL",
  catalogVerifier,
  "or id = 'launcher'",
);

for (
  const action of [
    "swap review",
    "transfer review",
    "conditional review",
    "dca plan",
    "stop loss check",
    "lp review",
    "lend review",
  ]
) {
  assertIncludes("Template context classifier", templateContext, `"${action}"`);
}

for (
  const forbidden of [
    "Personal wallet action agent",
    "Rule-based action agent",
    "approval-driven execution",
    "swaps, sends, action logs",
    "conditional swaps",
    "rule-driven execution",
    "Swap prepared",
    "USDC -> WETH via Base liquidity route",
    "demo approval request persisted with wallet approval required",
  ]
) {
  for (const [sourceName, source] of reviewedCopyTargets) {
    assert(
      !source.includes(forbidden),
      `${sourceName} must not include stale catalog copy: ${forbidden}`,
    );
  }
}

console.log("Supabase catalog copy checks passed.");
