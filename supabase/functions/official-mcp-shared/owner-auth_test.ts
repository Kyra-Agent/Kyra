import {
  authenticateOfficialMcpOwner,
  OfficialMcpSafeError,
  readOfficialMcpBearerAuthorization,
} from "./owner-auth.ts";

const validOwnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function assert(condition: unknown, message = "Assertion failed."): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

async function assertSafeError(
  action: () => unknown | Promise<unknown>,
  expected: { status: number; code: string },
) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof OfficialMcpSafeError);
    assertEquals(error.status, expected.status);
    assertEquals(error.code, expected.code);
    assert(!error.safeMessage.includes(validOwnerId));
    assert(!error.safeMessage.includes("secret-token"));
    assert(!error.message.includes(validOwnerId));
    assert(!error.message.includes("secret-token"));
    return;
  }

  throw new Error("Expected safe error.");
}

Deno.test("owner auth rejects missing and malformed bearer headers", async () => {
  for (
    const authorization of [
      null,
      "",
      "Basic secret-token",
      "Bearer",
      "Bearer ",
      "Bearer    ",
      "Bearer secret-token extra",
      "Token secret-token",
    ]
  ) {
    const request = new Request("https://kyra.local", {
      headers: authorization === null ? {} : { authorization },
    });

    await assertSafeError(
      () => readOfficialMcpBearerAuthorization(request),
      { status: 401, code: "unauthorized" },
    );
  }
});

Deno.test("owner auth parses bearer scheme case-insensitively", () => {
  for (const scheme of ["Bearer", "bearer", "BEARER", "BeArEr"]) {
    const request = new Request("https://kyra.local", {
      headers: { authorization: `${scheme} secret-token` },
    });

    assertEquals(
      readOfficialMcpBearerAuthorization(request),
      "Bearer secret-token",
    );
  }
});

Deno.test("owner auth does not call dependency for malformed authorization", async () => {
  let called = false;

  await assertSafeError(
    () =>
      authenticateOfficialMcpOwner("Basic secret-token", {
        getUser: async () => {
          called = true;
          return { id: validOwnerId };
        },
      }),
    { status: 401, code: "unauthorized" },
  );

  assertEquals(called, false);
});

Deno.test("owner auth rejects dependency failure and malformed user payloads", async () => {
  await assertSafeError(
    () =>
      authenticateOfficialMcpOwner("Bearer secret-token", {
        getUser: async () => {
          throw new Error("database unavailable");
        },
      }),
    { status: 401, code: "unauthorized" },
  );

  for (
    const payload of [
      null,
      [],
      {},
      { id: "" },
      { id: ` ${validOwnerId}` },
      { id: `${validOwnerId} ` },
      { id: "aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaaa" },
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaZ" },
      { id: validOwnerId.toUpperCase() },
      { user: { id: 1 } },
      { data: { user: { id: null } } },
    ]
  ) {
    await assertSafeError(
      () =>
        authenticateOfficialMcpOwner("Bearer secret-token", {
          getUser: async () => payload,
        }),
      { status: 401, code: "unauthorized" },
    );
  }
});

Deno.test("owner auth returns only canonical owner id", async () => {
  for (
    const payload of [
      { id: validOwnerId, email: "owner@example.test" },
      { user: { id: validOwnerId, role: "authenticated" } },
      { data: { user: { id: validOwnerId, aud: "authenticated" } } },
    ]
  ) {
    const result = await authenticateOfficialMcpOwner("Bearer secret-token", {
      getUser: async (authorization) => {
        assertEquals(authorization, "Bearer secret-token");
        return payload;
      },
    });

    assertEquals(JSON.stringify(result), JSON.stringify({ ownerUserId: validOwnerId }));
  }
});
