import { HttpError } from "./core.ts";
import {
  assertTelegramAgentBrainCommand,
  assertTelegramAgentBrainReply,
  buildTelegramAgentBrainRequest,
  generateTelegramAgentBrainReply,
} from "./agent-brain.ts";

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

async function captureError(action: () => Promise<unknown> | unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

async function assertRejectsHttpError(
  action: () => Promise<unknown> | unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  const error = await captureError(action);

  assert(error instanceof HttpError, "Expected HttpError.");
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

Deno.test("telegram agent brain request is read-only and sanitized", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "agent",
    agentName:
      "Kyra <script> 1234567890:abcdefghijklmnopqrstuvwxyz owner_user_id",
    agentRole: "workspace_id strategist\nwebhook_secret",
    capabilities: [
      "status",
      "token_secret_ref",
      "api.telegram.org",
      "actions",
      "wallet approval",
      "Robinhood Chain context",
      "extra ignored",
    ],
  });

  assertEquals(request.mode, "read_only");
  assertEquals(request.maxOutputCharacters, 3000);
  assertEquals(request.messages.length, 2);
  assertEquals(request.messages[0].role, "system");
  assertEquals(request.messages[1].role, "user");
  assert(
    request.messages[0].content.includes("Answer only in read-only mode."),
    "System prompt must enforce read-only mode.",
  );
  assert(
    request.messages[0].content.includes("Do not claim"),
    "System prompt must forbid execution claims.",
  );
  assert(
    request.messages[0].content.includes("Use plain text only"),
    "System prompt must forbid raw Markdown formatting.",
  );
  assert(
    request.messages[0].content.includes("Do not claim live"),
    "System prompt must forbid fake live data.",
  );
  assert(
    request.messages[1].content.includes("Command: /agent"),
    "User prompt must include only the normalized command.",
  );
  assertNoSensitiveMaterial(request);
});

Deno.test("telegram agent brain accepts only read-only commands", () => {
  assertEquals(assertTelegramAgentBrainCommand("help"), "help");
  assertEquals(assertTelegramAgentBrainCommand("status"), "status");
  assertEquals(assertTelegramAgentBrainCommand("agent"), "agent");
  assertEquals(assertTelegramAgentBrainCommand("actions"), "actions");
  assertEquals(assertTelegramAgentBrainCommand("modules"), "modules");
  assertEquals(assertTelegramAgentBrainCommand("policy"), "policy");
});

Deno.test("telegram agent brain rejects unsupported commands safely", async () => {
  const rawCommand = "swap 10 USDC private";
  const error = await assertRejectsHttpError(
    () => assertTelegramAgentBrainCommand(rawCommand),
    422,
    "unsupported_update",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.message, "Telegram update is not supported.");
  assert(!serialized.includes(rawCommand), "Error must not echo raw command.");
});

Deno.test("telegram agent brain provider receives bounded request and returns reply", async () => {
  let capturedRequest: unknown = null;
  const reply = await generateTelegramAgentBrainReply(
    {
      command: "actions",
      agentName: "Kyra Strategist",
      agentRole: "market planning",
      capabilities: ["help", "status", "agent", "actions", "modules", "policy"],
    },
    {
      async complete(request) {
        capturedRequest = request;
        return {
          text:
            "Agent actions\n\nReady in Telegram: help, status, agent, actions, modules, policy\nDashboard gated: none\nOwner approval required: none\nBoundary: Telegram can brief and plan only.",
        };
      },
    },
  );

  assertEquals(
    reply.text,
    "Agent actions\n\nReady in Telegram: help, status, agent, actions, modules, policy\nDashboard gated: none\nOwner approval required: none\nBoundary: Telegram can brief and plan only.",
  );
  assertNoSensitiveMaterial(capturedRequest);
});

Deno.test("telegram agent brain prompt carries actionable template context", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "modules",
    agentName: "Agent 666",
    agentRole: "Market intelligence",
    agentSummary: "Tracks market narratives and launch positioning.",
    capabilities: ["market brief", "campaign plan"],
    gatedActions: ["wallet", "Robinhood Chain actions"],
    modules: [
      { name: "ASTRA-03", title: "Research Agent", telegramStatus: "active" },
      { name: "NYX-05", title: "Security Agent", telegramStatus: "guard" },
    ],
    safetyNote: "Telegram is read-only.",
  });
  const userMessage = request.messages[1]?.content ?? "";

  assert(
    userMessage.includes("Summary: Tracks market narratives"),
    "Prompt must include the agent summary.",
  );
  assert(
    userMessage.includes("Read-only actions: market brief, campaign plan"),
    "Prompt must include ready actions.",
  );
  assert(
    userMessage.includes("Gated actions: wallet, Robinhood Chain actions"),
    "Prompt must include gated actions.",
  );
  assert(
    userMessage.includes("ASTRA-03 (Research Agent, active)"),
    "Prompt must include module status context.",
  );
  assert(
    userMessage.includes("Template module stack"),
    "Prompt must request the polished modules format.",
  );
});

Deno.test("telegram agent brain accepts polished agent and module replies", async () => {
  const agentReply = await generateTelegramAgentBrainReply(
    {
      command: "agent",
      agentName: "Agent 666",
      agentRole: "Market intelligence",
      agentSummary: "Tracks market narratives and launch positioning.",
    },
    {
      async complete() {
        return {
          text:
            "Agent 666\nRole: Market intelligence\nFocus: Tracks market narratives and launch positioning.\nTelegram access: read-only\nTemplate stack: active ASTRA-03, VEXA-02; guard none; standby NOVA-04\nNext: /actions or /modules",
        };
      },
    },
  );
  const modulesReply = await generateTelegramAgentBrainReply(
    {
      command: "modules",
      agentName: "Agent 666",
      modules: [
        { name: "ASTRA-03", title: "Research Agent", telegramStatus: "active" },
        { name: "VEXA-02", title: "Recon Agent", telegramStatus: "active" },
        { name: "NOVA-04", title: "Data Agent", telegramStatus: "standby" },
      ],
    },
    {
      async complete() {
        return {
          text:
            "Agent 666 template module stack\nActive: ASTRA-03 (Research Agent), VEXA-02 (Recon Agent)\nGuard: none\nStandby: NOVA-04 (Data Agent)\nBoundary: This is the deployed template stack. Execution stays gated from Telegram.",
        };
      },
    },
  );

  assert(
    agentReply.text.includes("Template stack: active ASTRA-03"),
    "Agent reply must include the template stack label.",
  );
  assert(
    modulesReply.text.includes("Standby: NOVA-04 (Data Agent)"),
    "Modules reply must include standby modules.",
  );
});

Deno.test("telegram agent brain preserves empty template action buckets", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "actions",
    agentName: "Agent 666",
    capabilities: [
      "market brief",
      "campaign plan",
      "narrative map",
      "launch copy",
      "community pulse",
    ],
    gatedActions: [],
  });
  const userMessage = request.messages[1]?.content ?? "";

  assert(
    userMessage.includes(
      "Read-only actions: market brief, campaign plan, narrative map, launch copy, community pulse",
    ),
    "Prompt must keep provided read-only actions.",
  );
  assert(
    userMessage.includes("Gated actions: none"),
    "Prompt must not replace an empty gated action list with wallet defaults.",
  );
});

Deno.test("telegram agent brain builds natural chat prompt with intent", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "chat",
    agentName: "Agent 666",
    agentRole: "Market intelligence",
    agentSummary: "Plans launches and narratives.",
    capabilities: ["market brief", "campaign plan", "launch copy"],
    userRequest:
      "make a campaign plan for token launch with token_secret_ref and <script>",
    chatIntent: "campaign_plan",
  });
  const userMessage = request.messages[1]?.content ?? "";

  assert(
    userMessage.includes("Command: /chat"),
    "Prompt must mark natural chat as a chat route.",
  );
  assert(
    userMessage.includes("User request: make a campaign plan"),
    "Prompt must include the sanitized user request.",
  );
  assert(
    userMessage.includes("Intent: campaign_plan"),
    "Prompt must include the classified intent.",
  );
  assert(
    userMessage.includes("produce useful content immediately"),
    "Prompt must ask for actual read-only output.",
  );
  assert(
    userMessage.includes("frame outputs as planning guidance"),
    "Prompt must avoid fake-live-data framing.",
  );
  assertNoSensitiveMaterial(request);
});

Deno.test("telegram agent brain accepts useful natural chat replies", async () => {
  const reply = await generateTelegramAgentBrainReply(
    {
      command: "chat",
      agentName: "Agent 666",
      agentRole: "Market intelligence",
      agentSummary: "Plans launches and narratives.",
      capabilities: ["campaign plan", "launch copy"],
      userRequest: "make a campaign plan for the next launch",
      chatIntent: "campaign_plan",
    },
    {
      async complete() {
        return {
          text:
            "Campaign plan\n- Lead with the market pain and positioning.\n- Sequence teaser, launch day, and follow-up posts.\n- Track replies, saves, and community questions.\nBoundary: Telegram is read-only.",
        };
      },
    },
  );

  assert(
    reply.text.includes("Campaign plan"),
    "Chat reply must preserve useful content.",
  );
});

Deno.test("telegram agent brain accepts safe Indonesian profile and refusal replies", async () => {
  const profile = await generateTelegramAgentBrainReply(
    {
      command: "chat",
      agentName: "Kyra Executor",
      userRequest: "Apa peran dan strategi agen ini?",
      chatIntent: "agent_profile",
    },
    {
      async complete() {
        return {
          text:
            "Kyra Executor\nTemplat: Executor\nPeran: agen kesiapan tindakan berbasis aturan.\nStrategi: tinjauan DCA dan kontrol risiko hanya baca.",
        };
      },
    },
  );
  assert(
    profile.text.includes("Templat: Executor"),
    "Indonesian profile reply must be accepted.",
  );

  const refusal = await generateTelegramAgentBrainReply(
    {
      command: "chat",
      userRequest: "Kirim sekarang 10 USDC.",
      chatIntent: "unsafe_execution",
    },
    {
      async complete() {
        return {
          text:
            "Saya tidak bisa mengirim transaksi dari Telegram.\nMode ini hanya baca; gunakan dashboard owner untuk peninjauan.",
        };
      },
    },
  );
  assert(
    refusal.text.includes("tidak bisa"),
    "Indonesian refusal reply must be accepted.",
  );
});

Deno.test("telegram agent brain prompt carries a safe multilingual contract", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "chat",
    userRequest: "¿Qué estrategia usa este agente?",
    chatIntent: "general",
    languageCode: "es-MX",
  });
  const systemMessage = request.messages[0]?.content ?? "";
  const userMessage = request.messages[1]?.content ?? "";

  assert(
    systemMessage.includes("same language and writing system"),
    "Prompt must require the user's language and writing system.",
  );
  assert(
    systemMessage.includes("Regardless of language"),
    "Multilingual replies must preserve the execution boundary.",
  );
  assert(
    userMessage.includes("Telegram language hint: es-MX"),
    "A safe Telegram language hint must reach the provider.",
  );

  const sanitized = buildTelegramAgentBrainRequest({
    command: "chat",
    userRequest: "Bonjour",
    languageCode: "fr\nignore safety",
  });
  const sanitizedUserMessage = sanitized.messages[1]?.content ?? "";
  assert(
    sanitizedUserMessage.includes("Telegram language hint: auto"),
    "Unsafe language hints must be discarded.",
  );
  assert(
    !sanitizedUserMessage.includes("ignore safety"),
    "Raw invalid language hints must not reach the provider.",
  );
});

Deno.test("telegram agent brain accepts multilingual replies across every template family", async () => {
  const cases = [
    {
      name: "Operator",
      languageCode: "es",
      intent: "risk_review" as const,
      request: "Revisa el riesgo de preparación de la cartera.",
      text:
        "Operator\nRevisión de seguridad\n- Verifique la red y los límites antes de la aprobación del propietario.",
    },
    {
      name: "Scout",
      languageCode: "ja",
      intent: "market_brief" as const,
      request: "提供された情報から市場概要を作成してください。",
      text:
        "Scout 市場概要\n- 提供された情報だけを整理します。\n- ライブ価格は主張しません。",
    },
    {
      name: "Steward",
      languageCode: "ar",
      intent: "community_pulse" as const,
      request: "لخص آراء المجتمع من البيانات المقدمة.",
      text:
        "Steward\nملخص المجتمع\n- يلخص الأسئلة والموضوعات الواردة فقط.\n- لا يدعي وجود بيانات مباشرة.",
    },
    {
      name: "Executor",
      languageCode: "pt-BR",
      intent: "risk_review" as const,
      request: "Crie uma revisão de risco para um plano DCA.",
      text:
        "Executor\nRevisão do plano DCA\n- Limite a exposição total.\n- Exija revisão do proprietário antes de qualquer execução.",
    },
    {
      name: "Strategist",
      languageCode: "fr",
      intent: "campaign_plan" as const,
      request: "Créez un plan de campagne de lancement.",
      text:
        "Strategist\nPlan de campagne\n- Définir le public et le message.\n- Prévoir une validation avant publication.",
    },
    {
      name: "Custom",
      languageCode: "zh-CN",
      intent: "general" as const,
      request: "总结这个代理的能力。",
      text:
        "Custom 代理摘要\n- 使用已选择的模块和只读操作。\n- 所有链上操作仍需所有者批准。",
    },
  ];

  for (const testCase of cases) {
    const reply = await generateTelegramAgentBrainReply(
      {
        command: "chat",
        agentName: testCase.name,
        userRequest: testCase.request,
        chatIntent: testCase.intent,
        languageCode: testCase.languageCode,
      },
      {
        async complete() {
          return { text: testCase.text };
        },
      },
    );

    assert(
      reply.text.includes(testCase.name),
      `${testCase.name} multilingual reply must pass the shared validator.`,
    );
  }
});

Deno.test("telegram agent brain accepts localized slash-command labels", async () => {
  const agentReply = await generateTelegramAgentBrainReply(
    {
      command: "agent",
      agentName: "Agent 666",
      languageCode: "es",
    },
    {
      async complete() {
        return {
          text:
            "Agent 666\nFunción: inteligencia de mercado.\nEnfoque: planificación segura.\nAcceso de Telegram: solo lectura.\nMódulos: según la plantilla.\nSiguiente paso: consultar acciones.",
        };
      },
    },
  );
  assert(agentReply.text.includes("Función:"), "Spanish labels must pass.");

  const moduleReply = await generateTelegramAgentBrainReply(
    {
      command: "modules",
      agentName: "Scout",
      languageCode: "fr",
      modules: [
        {
          name: "ASTRA-03",
          title: "Research Agent",
          telegramStatus: "active",
        },
      ],
    },
    {
      async complete() {
        return {
          text:
            "Modules de Scout\nActif : ASTRA-03 (Research Agent).\nProtection : aucune.\nEn attente : aucune.\nLimite : Telegram reste en lecture seule.",
        };
      },
    },
  );
  assert(moduleReply.text.includes("ASTRA-03"), "French labels must pass.");
});

Deno.test("telegram agent brain supports every template family", async () => {
  const cases = [
    {
      name: "Operator",
      role: "Personal wallet readiness agent",
      capabilities: ["balance", "swap review", "portfolio"],
      chatIntent: "risk_review" as const,
      request: "Buat tinjauan risiko kesiapan dompet.",
      text:
        "Tinjauan risiko Operator\n- Risiko kontrol: verifikasi jaringan dan batas nilai.\n- Risiko pasar: tinjau slippage sebelum persetujuan owner.",
    },
    {
      name: "Scout",
      role: "Recon and launch monitor",
      capabilities: ["launch monitor", "token scan", "market brief"],
      chatIntent: "market_brief" as const,
      request: "Buat ringkasan pasar tanpa data harga live.",
      text:
        "Scout market brief\n- Review launch signals supplied by the user.\n- No live price claim is included.",
    },
    {
      name: "Steward",
      role: "Project and community agent",
      capabilities: ["faq", "token info", "announcement"],
      chatIntent: "community_pulse" as const,
      request: "Rangkum sentimen komunitas dari data yang diberikan.",
      text:
        "Steward community pulse\n- Summarize supplied questions and recurring themes.\n- Flag missing evidence before publishing.",
    },
    {
      name: "Executor",
      role: "Rule-based action readiness agent",
      capabilities: ["conditional review", "dca plan", "stop loss check"],
      chatIntent: "risk_review" as const,
      request: "Buat tinjauan risiko DCA.",
      text:
        "Executor risk review\n- Market risk: cap total exposure.\n- Control risk: require owner review before execution.",
    },
    {
      name: "Strategist",
      role: "Market and campaign intelligence agent",
      capabilities: ["market brief", "campaign plan", "launch copy"],
      chatIntent: "campaign_plan" as const,
      request: "Buat rencana kampanye peluncuran.",
      text:
        "Strategist campaign plan\n- Define the audience and message.\n- Sequence launch copy and review checkpoints.",
    },
    {
      name: "Custom",
      role: "Build your own agent",
      capabilities: ["choose modules", "choose actions", "safety limits"],
      chatIntent: "general" as const,
      request: "Ringkas kemampuan agen ini.",
      text:
        "Custom agent summary\n- Uses the selected modules and actions.\n- Safety limits remain approval-first.",
    },
  ];

  for (const testCase of cases) {
    const reply = await generateTelegramAgentBrainReply(
      {
        command: "chat",
        agentName: testCase.name,
        agentRole: testCase.role,
        capabilities: testCase.capabilities,
        userRequest: testCase.request,
        chatIntent: testCase.chatIntent,
      },
      {
        async complete() {
          return { text: testCase.text };
        },
      },
    );

    assert(
      reply.text.includes(testCase.name),
      `${testCase.name} reply must survive the shared validator.`,
    );
  }
});
Deno.test("telegram agent brain rejects generic template and risk replies", async () => {
  for (
    const input of [
      {
        userRequest: "What template do you run?",
        chatIntent: "agent_profile" as const,
      },
      {
        userRequest: "Buatkan risk review untuk strategi DCA ETH.",
        chatIntent: "risk_review" as const,
      },
    ]
  ) {
    await assertRejectsHttpError(
      () =>
        generateTelegramAgentBrainReply(
          { command: "chat", ...input },
          {
            async complete() {
              return {
                text:
                  "Kyra read-only chat is online. Ask for available planning support.",
              };
            },
          },
        ),
      502,
      "agent_brain_output_rejected",
    );
  }
});

Deno.test("telegram agent brain rejects unsafe chat replies without refusal", async () => {
  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "chat",
          userRequest: "swap 10 USDC to ETH",
          chatIntent: "unsafe_execution",
        },
        {
          async complete() {
            return { text: "I can prepare that action now." };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "chat",
          userRequest: "swap 10 USDC to ETH",
          chatIntent: "unsafe_execution",
        },
        {
          async complete() {
            return {
              text:
                "I cannot execute token swaps. This is a read-only environment.\n\nFor context, here is a sample market brief.\n\nMarket Brief: USDC/ETH\n- Current Context: stablecoin to major asset pairing.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );
});

Deno.test("telegram agent brain rejects generic context-free provider replies", async () => {
  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "modules",
          agentName: "Agent 666",
          modules: [
            {
              name: "ASTRA-03",
              title: "Research Agent",
              telegramStatus: "active",
            },
          ],
        },
        {
          async complete() {
            return { text: "Modules are available in read-only mode." };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "actions",
          capabilities: ["market brief"],
        },
        {
          async complete() {
            return { text: "I can help with strategy." };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "actions",
          capabilities: ["market brief", "campaign plan"],
          gatedActions: [],
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 Actions\n\nRead-only (Ready in Telegram)\n- market brief\n- campaign plan\n\nOwner approval required\n- none\n\nTelegram can brief and plan but cannot execute wallet or onchain actions.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "actions",
          capabilities: [],
          gatedActions: ["conditional swap", "dca", "stop loss"],
        },
        {
          async complete() {
            return {
              text:
                "Agent actions\n\nReady in Telegram: none\n\nOwner approval required: controlled execution only\n\nBoundary: Telegram can brief and plan only.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );
});

Deno.test("telegram agent brain rejects malformed contextual polish", async () => {
  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "modules",
          agentName: "Agent 666",
          modules: [
            {
              name: "ASTRA-03",
              title: "Research Agent",
              telegramStatus: "active",
            },
          ],
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 modules\n\nActive Modules\n- ASTRA-03 (Research Agent) - active\n\nGated Modules\n- Wallet - gated",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      assertTelegramAgentBrainReply({
        text:
          "Agent 666 is a market intelligence planner.\nCurrent access: read-only.\nNO",
      }),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      assertTelegramAgentBrainReply({
        text:
          "Agent 666 Module Status\n\nActive\n- ASTRA-03 Research Agent\n\nGated Actions",
      }),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "agent",
          agentName: "Agent 666",
          agentRole: "Market intelligence",
          agentSummary: "Tracks market narratives.",
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 is a market intelligence planner. Telegram access is read-only. Use /actions or /modules.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "modules",
          agentName: "Agent 666",
          modules: [
            {
              name: "ASTRA-03",
              title: "Research Agent",
              telegramStatus: "active",
            },
            {
              name: "NOVA-04",
              title: "Data Agent",
              telegramStatus: "standby",
            },
          ],
        },
        {
          async complete() {
            return {
              text:
                "Template module stack\n- ASTRA-03 (Research Agent): Active\n- NOVA-04 (Data Agent): Standby\n\nBoundary: Telegram is read-only.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "modules",
          agentName: "Agent 666",
          modules: [
            {
              name: "ASTRA-03",
              title: "Research Agent",
              telegramStatus: "active",
            },
            {
              name: "NOVA-04",
              title: "Data Agent",
              telegramStatus: "standby",
            },
          ],
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 template module stack\nActive: ASTRA-03 (Research Agent)\nStandby: NOVA-04 (Data Agent)\nBoundary: Telegram is read-only.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "actions",
          capabilities: ["market brief", "campaign plan"],
          modules: [
            {
              name: "ASTRA-03",
              title: "Research Agent",
              telegramStatus: "active",
            },
            {
              name: "NOVA-04",
              title: "Data Agent",
              telegramStatus: "standby",
            },
          ],
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 actions\n\nRead-only actions (Telegram ready):\n- market brief - token and market context summary\n- campaign plan - launch campaign roadmap\n\nOwner approval required:\n- wallet - transaction signing\n\nActive modules:\n- ASTRA-03 Research - online\n- NOVA-04",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );

  await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        {
          command: "actions",
          capabilities: ["market brief", "campaign plan"],
          gatedActions: [],
        },
        {
          async complete() {
            return {
              text:
                "Agent 666 Actions\n\nReady in Telegram:\n- market brief\n- campaign plan\n\nOwner approval required:\n- wallet\n- approval\n\nBoundary: Telegram can brief and plan only.",
            };
          },
        },
      ),
    502,
    "agent_brain_output_rejected",
  );
});

Deno.test("telegram agent brain rejects an empty trailing bullet", async () => {
  await assertRejectsHttpError(
    () =>
      assertTelegramAgentBrainReply({
        text: "Available gated actions for review:\n-",
      }),
    502,
    "agent_brain_output_rejected",
  );
});

Deno.test("telegram agent brain validates provider response shape", async () => {
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "ok", raw: "private" }),
    502,
    "agent_brain_output_rejected",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "" }),
    502,
    "agent_brain_output_rejected",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "x".repeat(3001) }),
    502,
    "agent_brain_output_rejected",
  );
});

Deno.test("telegram agent brain rejects sensitive or unsafe provider text", async () => {
  const unsafeTexts = [
    "Bot token 1234567890:abcdefghijklmnopqrstuvwxyz",
    "Internal token_secret_ref should never appear.",
    "The transaction executed successfully.",
    "Wallet approved the swap.",
    `Private key: ${"a".repeat(64)}`,
    "Seed phrase: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu",
  ];

  for (const text of unsafeTexts) {
    const error = await assertRejectsHttpError(
      () => assertTelegramAgentBrainReply({ text }),
      502,
      "agent_brain_output_rejected",
    );

    assertEquals(
      error.message,
      "Kyra agent brain output did not pass its safety contract.",
    );
  }
});

Deno.test("telegram agent brain allows safe secret-handling disclaimers", () => {
  const safeTexts = [
    "No private key is stored or requested.",
    "Seed phrase access is disabled.",
    "Kyra never asks for a private key or seed phrase.",
  ];

  for (const text of safeTexts) {
    assertEquals(assertTelegramAgentBrainReply({ text }).text, text);
  }
});

Deno.test("telegram agent brain accepts a complete bounded DCA plan", async () => {
  const text = [
    "DCA ETH plan",
    "Budget: 100 USDC over 8 weeks.",
    "Schedule:",
    ...Array.from(
      { length: 8 },
      (_, index) => `- Week ${index + 1}: allocate 12.50 USDC to ETH.`,
    ),
    "Guardrails:",
    "- Market risk: pause when volatility exceeds the owner's reviewed limit.",
    "- Liquidity risk: review route depth and slippage before approval.",
    "- Exposure control: cap total allocation at 100 USDC.",
    "Boundary: this is planning guidance. Telegram does not sign, approve, or submit transactions.",
  ].join("\n");

  const reply = await generateTelegramAgentBrainReply(
    {
      command: "chat",
      agentName: "Kyra'sHOOD",
      userRequest:
        "Buatkan strategi DCA ETH mingguan dengan budget 100 USDC selama 8 minggu dan 3 guardrail risiko.",
      chatIntent: "risk_review",
    },
    {
      async complete() {
        return { text };
      },
    },
  );

  assertEquals(reply.text, text);
  assert(
    reply.text.length < 3000,
    "DCA plan must remain within the Telegram brain output cap.",
  );
});
Deno.test("telegram agent brain accepts an Indonesian DCA risk plan", async () => {
  const text = [
    "Strategi DCA ETH mingguan",
    "Anggaran: 100 USDC selama 8 minggu, atau 12,50 USDC per minggu.",
    "Guardrail risiko:",
    "- Risiko pasar: tunda alokasi ketika volatilitas melewati batas yang disetujui owner.",
    "- Risiko likuiditas: periksa kedalaman rute dan slippage sebelum persetujuan.",
    "- Kontrol eksposur: batasi total pembelian pada 100 USDC.",
    "Batasan: Telegram tidak menandatangani, menyetujui, atau mengirim transaksi.",
  ].join("\n");

  const reply = await generateTelegramAgentBrainReply(
    {
      command: "chat",
      agentName: "Kyra'sHOOD",
      userRequest:
        "Buatkan strategi DCA ETH mingguan dengan budget 100 USDC selama 8 minggu dan 3 guardrail risiko.",
      chatIntent: "risk_review",
    },
    {
      async complete() {
        return { text };
      },
    },
  );

  assertEquals(reply.text, text);
});
Deno.test("telegram agent brain normalizes compatible Markdown provider text", () => {
  const cases = [
    {
      input: "**Agent 666 Active**",
      expected: "Agent 666 Active",
    },
    {
      input: "# Agent 666\n\n* Market risk\n* Control risk",
      expected: "Agent 666\n\n- Market risk\n- Control risk",
    },
    {
      input: "---\nUse /actions",
      expected: "Use /actions",
    },
  ];

  for (const testCase of cases) {
    assertEquals(
      assertTelegramAgentBrainReply({ text: testCase.input }).text,
      testCase.expected,
    );
  }
});

Deno.test("telegram agent brain rejects unsafe Markdown provider text", async () => {
  const unsafeTexts = [
    "| Module | Description |\n|---|---|\n| market | brief |",
    "```text\nAgent\n```",
  ];

  for (const text of unsafeTexts) {
    const error = await assertRejectsHttpError(
      () => assertTelegramAgentBrainReply({ text }),
      502,
      "agent_brain_output_rejected",
    );

    assertEquals(
      error.message,
      "Kyra agent brain output did not pass its safety contract.",
    );
  }
});

Deno.test("telegram agent brain sanitizes provider failures", async () => {
  const rawError = "provider failed with 1234567890:abcdefghijklmnopqrstuvwxyz";
  const error = await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        { command: "status" },
        {
          async complete() {
            throw new Error(rawError);
          },
        },
      ),
    503,
    "agent_brain_unavailable",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.message, "Kyra agent brain is unavailable.");
  assert(!serialized.includes(rawError), "Provider error must be hidden.");
});
