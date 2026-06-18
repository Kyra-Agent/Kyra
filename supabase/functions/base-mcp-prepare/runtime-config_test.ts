import {
  createBaseMcpPrepareRuntimeConfig,
  isBaseMcpPrepareEnabled,
  normalizeBaseMcpEndpoint,
  parseBaseMcpTimeoutMs,
} from "./runtime-config.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

Deno.test("base-mcp runtime gate enables only on exact true", () => {
  for (const value of ["", "false", "TRUE", " true", "true "]) {
    assertEquals(isBaseMcpPrepareEnabled(value), false);
  }

  assertEquals(isBaseMcpPrepareEnabled("true"), true);
});

Deno.test("base-mcp runtime config stays disabled without reading provider config", () => {
  const reads: string[] = [];
  const config = createBaseMcpPrepareRuntimeConfig((key) => {
    reads.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(reads.join(","), "KYRA_BASE_MCP_PREP_ENABLED");
});

Deno.test("base-mcp runtime config trims optional provider fields when enabled", () => {
  const values = new Map([
    ["KYRA_BASE_MCP_PREP_ENABLED", "true"],
    ["KYRA_BASE_MCP_ENDPOINT", "  https://base-mcp.test  "],
    ["KYRA_BASE_MCP_PROVIDER_PROTOCOL", "kyra_status_v1"],
    ["KYRA_BASE_MCP_API_KEY", "  secret-value  "],
    ["KYRA_BASE_MCP_TIMEOUT_MS", "4500"],
  ]);
  const config = createBaseMcpPrepareRuntimeConfig((key) =>
    values.get(key) ?? ""
  );

  assertEquals(config.enabled, true);

  if (config.enabled) {
    assertEquals(config.endpoint, "https://base-mcp.test/");
    assertEquals(config.providerProtocol, "kyra_status_v1");
    assertEquals(config.apiKey, "secret-value");
    assertEquals(config.timeoutMs, 4500);
  }
});

Deno.test("base-mcp runtime protocol enables only the reviewed adapter contract", () => {
  for (const value of ["", "KYRA_STATUS_V1", " kyra_status_v1", "mcp"]) {
    const config = createBaseMcpPrepareRuntimeConfig((key) => {
      if (key === "KYRA_BASE_MCP_PREP_ENABLED") return "true";
      if (key === "KYRA_BASE_MCP_PROVIDER_PROTOCOL") return value;
      return "";
    });

    if (config.enabled) {
      assertEquals(config.providerProtocol, null);
    }
  }
});

Deno.test("base-mcp runtime timeout defaults and caps safely", () => {
  assertEquals(parseBaseMcpTimeoutMs(""), 2500);
  assertEquals(parseBaseMcpTimeoutMs("not-a-number"), 2500);
  assertEquals(parseBaseMcpTimeoutMs("0"), 2500);
  assertEquals(parseBaseMcpTimeoutMs("-1"), 2500);
  assertEquals(parseBaseMcpTimeoutMs("2500.5"), 2500);
  assertEquals(parseBaseMcpTimeoutMs("6000"), 5000);
  assertEquals(parseBaseMcpTimeoutMs("1"), 1);
});

Deno.test("base-mcp runtime endpoint accepts only valid HTTPS URLs", () => {
  assertEquals(normalizeBaseMcpEndpoint(""), null);
  assertEquals(normalizeBaseMcpEndpoint("not-a-url"), null);
  assertEquals(normalizeBaseMcpEndpoint("http://base-mcp.test"), null);
  assertEquals(normalizeBaseMcpEndpoint("ftp://base-mcp.test"), null);
  assertEquals(normalizeBaseMcpEndpoint("https://mcp.base.org/"), null);
  assertEquals(
    normalizeBaseMcpEndpoint("  https://base-mcp.test/v1  "),
    "https://base-mcp.test/v1",
  );
});
