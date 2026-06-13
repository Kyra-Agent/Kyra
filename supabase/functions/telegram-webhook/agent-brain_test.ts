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
      "Base context",
      "extra ignored",
    ],
  });

  assertEquals(request.mode, "read_only");
  assertEquals(request.maxOutputCharacters, 700);
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
            "Agent actions\n\nReady in Telegram: help, status, agent, actions, modules, policy\nDashboard gated: none\nPhase 6 gated: none\nBoundary: Telegram can brief and plan only.",
        };
      },
    },
  );

  assertEquals(
    reply.text,
    "Agent actions\n\nReady in Telegram: help, status, agent, actions, modules, policy\nDashboard gated: none\nPhase 6 gated: none\nBoundary: Telegram can brief and plan only.",
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
    gatedActions: ["wallet", "Base MCP"],
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
    userMessage.includes("Gated actions: wallet, Base MCP"),
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
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
                "Agent 666 Actions\n\nRead-only (Ready in Telegram)\n- market brief\n- campaign plan\n\nGated (Phase 6 only)\n- none\n\nTelegram can brief and plan but cannot execute wallet or onchain actions.",
            };
          },
        },
      ),
    502,
    "agent_brain_invalid_response",
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
                "Agent actions\n\nReady in Telegram: none\n\nPhase 6 gated: controlled execution only\n\nBoundary: Telegram can brief and plan only.",
            };
          },
        },
      ),
    502,
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
  );

  await assertRejectsHttpError(
    () =>
      assertTelegramAgentBrainReply({
        text:
          "Agent 666 is a market intelligence planner.\nCurrent access: read-only.\nNO",
      }),
    502,
    "agent_brain_invalid_response",
  );

  await assertRejectsHttpError(
    () =>
      assertTelegramAgentBrainReply({
        text:
          "Agent 666 Module Status\n\nActive\n- ASTRA-03 Research Agent\n\nGated Actions",
      }),
    502,
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
    "agent_brain_invalid_response",
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
                "Agent 666 actions\n\nRead-only actions (Telegram ready):\n- market brief - token and market context summary\n- campaign plan - launch campaign roadmap\n\nGated actions (Phase 6):\n- wallet - transaction signing\n\nActive modules:\n- ASTRA-03 Research - online\n- NOVA-04",
            };
          },
        },
      ),
    502,
    "agent_brain_invalid_response",
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
                "Agent 666 Actions\n\nReady in Telegram:\n- market brief\n- campaign plan\n\nPhase 6 gated:\n- wallet\n- approval\n\nBoundary: Telegram can brief and plan only.",
            };
          },
        },
      ),
    502,
    "agent_brain_invalid_response",
  );
});

Deno.test("telegram agent brain validates provider response shape", async () => {
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "ok", raw: "private" }),
    502,
    "agent_brain_invalid_response",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "" }),
    502,
    "agent_brain_invalid_response",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "x".repeat(701) }),
    502,
    "agent_brain_invalid_response",
  );
});

Deno.test("telegram agent brain rejects sensitive or unsafe provider text", async () => {
  const unsafeTexts = [
    "Bot token 1234567890:abcdefghijklmnopqrstuvwxyz",
    "Internal token_secret_ref should never appear.",
    "The transaction executed successfully.",
    "Wallet approved the swap.",
    "Here is a seed phrase.",
  ];

  for (const text of unsafeTexts) {
    const error = await assertRejectsHttpError(
      () => assertTelegramAgentBrainReply({ text }),
      502,
      "agent_brain_invalid_response",
    );

    assertEquals(
      error.message,
      "Kyra agent brain returned an invalid response.",
    );
  }
});

Deno.test("telegram agent brain rejects raw Markdown provider text", async () => {
  const unsafeTexts = [
    "**Agent 666 Active**",
    "# Agent 666",
    "| Module | Description |\n|---|---|\n| market | brief |",
    "---\nUse /actions",
    "```text\nAgent\n```",
  ];

  for (const text of unsafeTexts) {
    const error = await assertRejectsHttpError(
      () => assertTelegramAgentBrainReply({ text }),
      502,
      "agent_brain_invalid_response",
    );

    assertEquals(
      error.message,
      "Kyra agent brain returned an invalid response.",
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
