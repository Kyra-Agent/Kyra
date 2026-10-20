import {
  defaultAgentSettings,
  fromAgentSettingsRow,
  toAgentSettingsRow,
  validateAgentSettings,
} from "./agent-settings.ts";

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

const strategistActions = [
  "market brief",
  "campaign plan",
  "narrative map",
  "launch copy",
  "community pulse",
];

Deno.test("agent settings default when nothing is sent", () => {
  const result = validateAgentSettings(undefined, strategistActions);

  assert(result.ok, "Missing settings must be valid.");
  if (result.ok) {
    assertEquals(
      JSON.stringify(result.settings),
      JSON.stringify(defaultAgentSettings()),
    );
  }
});

Deno.test("agent settings accept a full valid owner setup", () => {
  const result = validateAgentSettings({
    persona: "friendly",
    instructions: "  Focus on the ABC launch.\r\n\r\n\r\nKeep it short.  ",
    knowledge: "Token: ABC\nUnlock: March 1",
    enabledActions: ["campaign plan", "launch copy", "swap", "campaign plan"],
    enabledModules: ["ASTRA-03", "FAKE-99"],
    riskProfile: "conservative",
    maxReviewUsd: "500",
  }, strategistActions);

  assert(result.ok, "Valid settings must pass.");
  if (result.ok) {
    assertEquals(result.settings.persona, "friendly");
    assertEquals(
      result.settings.instructions,
      "Focus on the ABC launch.\n\nKeep it short.",
    );
    assertEquals(result.settings.enabledActions.join(","), "campaign plan,launch copy");
    assertEquals(result.settings.enabledModules.join(","), "ASTRA-03");
    assertEquals(result.settings.riskProfile, "conservative");
    assertEquals(result.settings.maxReviewUsd, 500);
  }
});

Deno.test("agent settings store all template actions as an empty selection", () => {
  const result = validateAgentSettings(
    { enabledActions: strategistActions },
    strategistActions,
  );

  assert(result.ok && result.settings.enabledActions.length === 0, "All actions means no filter.");
});

Deno.test("agent settings reject invalid values with the field name", () => {
  const cases: Array<[unknown, string]> = [
    [{ persona: "pirate" }, "persona"],
    [{ instructions: "x".repeat(1001) }, "instructions"],
    [{ knowledge: "x".repeat(4001) }, "knowledge"],
    [{ knowledge: 42 }, "knowledge"],
    [{ enabledActions: ["swap"] }, "enabledActions"],
    [{ enabledActions: "campaign plan" }, "enabledActions"],
    [{ enabledModules: ["FAKE-99"] }, "enabledModules"],
    [{ riskProfile: "yolo" }, "riskProfile"],
    [{ maxReviewUsd: 0 }, "maxReviewUsd"],
    [{ maxReviewUsd: 12.5 }, "maxReviewUsd"],
    [[], "settings"],
  ];

  for (const [input, field] of cases) {
    const result = validateAgentSettings(input, strategistActions);
    assert(!result.ok, `Expected ${JSON.stringify(input)} to be rejected.`);
    if (!result.ok) {
      assertEquals(result.field, field);
    }
  }
});

Deno.test("agent settings redact secrets in owner text", () => {
  const result = validateAgentSettings({
    instructions: "bot 123456789:AAabcdefghijklmnopqrstuvwxyz012345",
    knowledge: "api sk-or-v1-abcdefghijklmnopqrstuvwxyz",
  }, strategistActions);

  assert(result.ok, "Text with secrets is still saved, redacted.");
  if (result.ok) {
    assert(!result.settings.instructions.includes("123456789:AA"), "Bot token must be redacted.");
    assert(!result.settings.knowledge.includes("sk-or-v1"), "API key must be redacted.");
  }
});

Deno.test("agent settings round-trip through a database row", () => {
  const result = validateAgentSettings({
    persona: "bold",
    knowledge: "FAQ",
    riskProfile: "aggressive",
    maxReviewUsd: 250,
  }, strategistActions);

  assert(result.ok, "Settings must validate.");
  if (result.ok) {
    const restored = fromAgentSettingsRow(toAgentSettingsRow(result.settings));
    assertEquals(JSON.stringify(restored), JSON.stringify(result.settings));
  }

  const broken = fromAgentSettingsRow({ persona: "x", max_review_usd: -1 });
  assertEquals(broken.persona, "professional");
  assertEquals(broken.maxReviewUsd, null);
});
