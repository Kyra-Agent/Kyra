import { HttpError } from "./core.ts";
import {
  buildTelegramTemplateContext,
  buildTelegramTemplateContextReply,
  classifyTemplateAction,
} from "./template-context.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertThrowsHttpError(
  action: () => unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

function assertNoSensitiveMaterial(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "1234567890:abcdefghijklmnopqrstuvwxyz",
    "sb_secret_private",
    "token_secret_ref",
    "webhook_secret",
    "owner_user_id",
    "workspace_id",
    "telegramUserId",
    "telegramChatId",
    "api.telegram.org",
    "<script>",
    "`",
  ];

  for (const fragment of forbidden) {
    assert(
      !serialized.includes(fragment),
      `Serialized value leaked ${fragment}.`,
    );
  }
}

const seedTemplates = [
  {
    templateId: "operator",
    name: "Operator",
    role: "Personal wallet readiness agent",
    summary:
      "A private Telegram-native agent for wallet checks, swap reviews, transfer reviews, action logs, and approval-gated Robinhood Chain readiness.",
    actions: [
      "balance",
      "swap review",
      "transfer review",
      "portfolio",
      "tx history",
      "price alert",
    ],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
  },
  {
    templateId: "scout",
    name: "Scout",
    role: "Recon and launch monitor",
    summary:
      "A research-forward agent that watches new launches, token activity, and Robinhood Chain ecosystem signals before summarizing what matters.",
    actions: [
      "launch monitor",
      "token scan",
      "watchlist",
      "market brief",
      "project summary",
    ],
    modules: ["NIRA-01", "VEXA-02", "ASTRA-03", "NOVA-04", "NYX-05"],
  },
  {
    templateId: "steward",
    name: "Steward",
    role: "Project and community agent",
    summary:
      "A public-facing agent for token communities that can answer project questions, verify holders, and surface token context.",
    actions: [
      "faq",
      "holder verify",
      "token info",
      "announcement",
      "tx summary",
    ],
    modules: ["NIRA-01", "ASTRA-03", "NOVA-04", "NYX-05"],
  },
  {
    templateId: "executor",
    name: "Executor",
    role: "Rule-based action readiness agent",
    summary:
      "An advanced agent for conditional swap reviews, DCA plans, stop loss checks, and controlled automation drafts with hard approval limits.",
    actions: [
      "conditional review",
      "dca plan",
      "stop loss check",
      "lp review",
      "lend review",
    ],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
  },
  {
    templateId: "strategist",
    name: "Strategist",
    role: "Market and campaign intelligence agent",
    summary:
      "A planning agent that turns token, market, and community context into launch narratives, campaign plans, and decision-ready briefs.",
    actions: [
      "market brief",
      "campaign plan",
      "narrative map",
      "launch copy",
      "community pulse",
    ],
    modules: ["ASTRA-03", "NOVA-04", "VEXA-02"],
  },
  {
    templateId: "custom",
    name: "Custom",
    role: "Build your own agent",
    summary:
      "Choose the personality, modules, actions, and safety limits for a Kyra agent built around a specific workflow.",
    actions: [
      "choose modules",
      "choose actions",
      "custom prompt",
      "safety limits",
    ],
    modules: ["NIRA-01", "NYX-05"],
  },
];

Deno.test("telegram template context supports every current template safely", () => {
  for (const template of seedTemplates) {
    const { context, text } = buildTelegramTemplateContextReply(template);

    assertEquals(context.templateId, template.templateId);
    assertEquals(context.name, template.name);
    assertEquals(context.actions.length, template.actions.length);
    assert(context.modules.length > 0, "Template modules must be present.");
    assert(
      text.includes(context.name),
      "Telegram context reply must mention the template name.",
    );
    assert(
      text.includes("Telegram is read-only."),
      "Telegram context must keep the safety boundary visible.",
    );
    assert(text.length <= 700, "Telegram context reply must stay bounded.");
    assertNoSensitiveMaterial({ context, text });
  }
});

Deno.test("telegram template context returns distinct command replies", () => {
  const agentReply =
    buildTelegramTemplateContextReply(seedTemplates[4], "agent")
      .text;
  const actionsReply = buildTelegramTemplateContextReply(
    seedTemplates[4],
    "actions",
  ).text;
  const modulesReply = buildTelegramTemplateContextReply(
    seedTemplates[4],
    "modules",
  ).text;

  assert(
    agentReply.includes("Next: /actions or /modules"),
    "Agent reply must route users to focused command details.",
  );
  assert(
    actionsReply.includes("Strategist actions"),
    "Actions reply must have an actions-specific heading.",
  );
  assert(
    actionsReply.includes("Ready in Telegram: market brief, campaign plan"),
    "Actions reply must focus on read-only actions.",
  );
  assert(
    modulesReply.includes("Strategist template module stack"),
    "Modules reply must have a modules-specific heading.",
  );
  assert(
    modulesReply.includes(
      "Active: ASTRA-03 (Research Agent), VEXA-02 (Recon Agent)",
    ),
    "Modules reply must focus on active modules.",
  );
  assert(
    modulesReply.includes("Standby: NOVA-04 (Data Agent)"),
    "Modules reply must include standby modules.",
  );

  assert(agentReply !== actionsReply, "Agent and actions replies must differ.");
  assert(agentReply !== modulesReply, "Agent and modules replies must differ.");
  assert(
    actionsReply !== modulesReply,
    "Actions and modules replies must differ.",
  );
  assertNoSensitiveMaterial({ agentReply, actionsReply, modulesReply });
});

Deno.test("telegram template context presents numeric agent names as agent labels", () => {
  const { context, text } = buildTelegramTemplateContextReply({
    ...seedTemplates[4],
    name: "666",
  });

  assertEquals(context.name, "Agent 666");
  assert(
    text.startsWith("Agent 666\n"),
    "Numeric display names must not render as bare numbers.",
  );
});

Deno.test("telegram template context gates executor wallet actions for phase 6", () => {
  const context = buildTelegramTemplateContext(seedTemplates[3]);

  assertEquals(context.templateId, "executor");
  assertEquals(context.readOnlyActions.length, 0);
  assertEquals(
    context.gatedActions.join(","),
    "conditional review,dca plan,stop loss check,lp review,lend review",
  );

  for (const action of context.actions) {
    assertEquals(action.availability, "phase6_wallet_gated");
  }
});

Deno.test("telegram template context keeps strategist actions read-only ready", () => {
  const context = buildTelegramTemplateContext(seedTemplates[4]);

  assertEquals(context.templateId, "strategist");
  assertEquals(context.gatedActions.length, 0);
  assertEquals(
    context.readOnlyActions.join(","),
    "market brief,campaign plan,narrative map,launch copy,community pulse",
  );
});

Deno.test("telegram template action classifier separates read-only dashboard and phase6 actions", () => {
  assertEquals(classifyTemplateAction("market brief"), "read_only_ready");
  assertEquals(classifyTemplateAction("announcement"), "dashboard_gated");
  assertEquals(classifyTemplateAction("swap review"), "phase6_wallet_gated");
  assertEquals(classifyTemplateAction("dca plan"), "phase6_wallet_gated");
});

Deno.test("telegram template context exposes module statuses without execution claims", () => {
  const context = buildTelegramTemplateContext(seedTemplates[1]);
  const activeModules = context.modules
    .filter((module) => module.telegramStatus === "active")
    .map((module) => module.name);
  const guardModules = context.modules
    .filter((module) => module.telegramStatus === "guard")
    .map((module) => module.name);
  const standbyModules = context.modules
    .filter((module) => module.telegramStatus === "standby")
    .map((module) => module.name);

  assert(activeModules.includes("NIRA-01"), "NIRA must be active.");
  assert(activeModules.includes("VEXA-02"), "VEXA must be active.");
  assert(activeModules.includes("ASTRA-03"), "ASTRA must be active.");
  assert(guardModules.includes("NYX-05"), "NYX must remain guard-scoped.");
  assert(standbyModules.includes("NOVA-04"), "NOVA must remain data standby.");
});

Deno.test("telegram template context sanitizes unsafe template fields", () => {
  const { context, text } = buildTelegramTemplateContextReply({
    templateId: "safe-template",
    name: "Kyra <script> 1234567890:abcdefghijklmnopqrstuvwxyz owner_user_id",
    role: "workspace_id strategist\nwebhook_secret",
    summary: "token_secret_ref and api.telegram.org should be hidden",
    actions: ["market brief", "token_secret_ref", "swap"],
    modules: ["NIRA-01", "api.telegram.org", "NYX-05"],
  });

  assertEquals(context.templateId, "safe-template");
  assert(context.gatedActions.includes("swap"), "Swap must stay gated.");
  assertNoSensitiveMaterial({ context, text });
});

Deno.test("telegram template context rejects malformed input without echoing raw values", () => {
  const rawTemplateId = "bad workspace_id";
  const error = assertThrowsHttpError(
    () =>
      buildTelegramTemplateContext({
        templateId: rawTemplateId,
        name: "Kyra",
        role: "role",
        summary: "summary",
        actions: ["market brief"],
        modules: ["NIRA-01"],
      }),
    400,
    "invalid_template_context",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.message, "Telegram template context is invalid.");
  assert(!serialized.includes(rawTemplateId), "Error must not echo raw input.");
});
