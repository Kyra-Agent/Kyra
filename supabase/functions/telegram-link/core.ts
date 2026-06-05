import {
  type AgentOwnershipRecord,
  assertAgentId,
  assertAgentOwnership,
  assertAuthenticatedUserId,
  assertBearerAuthorization,
  assertBodySizeFromHeaders,
  assertJsonContentType,
  assertPostMethod,
  corsHeaders,
  HttpError,
  jsonResponse,
  readJsonObjectBody,
} from "../telegram-connect/core.ts";
import type { TelegramOwnerLinkIssueResult } from "../telegram-connect/owner-link-challenge.ts";
import {
  assertTelegramOwnerLinkChallenge,
  assertTelegramOwnerLinkChallengeHash,
  buildTelegramOwnerLinkDeepLink,
  type TelegramOwnerLinkChallengeMaterial,
  telegramOwnerLinkChallengeTtlMs,
} from "../_shared/telegram-owner-link.ts";
import type { TelegramLinkActiveSession } from "./active-session-lookup.ts";
import type { TelegramLinkIssueRuntimeConfig } from "./runtime-config.ts";

export const maxTelegramLinkBodyBytes = 4096;

export interface TelegramLinkDependencies {
  issueRuntimeConfig?: TelegramLinkIssueRuntimeConfig;
  getEnv?: (key: string) => string;
  getUser?: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
  lookupAgentOwnership?: (
    agentId: string,
    ownerUserId: string,
  ) => Promise<AgentOwnershipRecord | null>;
  lookupActiveTelegramSession?: (
    agentId: string,
  ) => Promise<TelegramLinkActiveSession>;
  createChallengeMaterial?: () => Promise<TelegramOwnerLinkChallengeMaterial>;
  issueOwnerLinkChallenge?: (input: {
    agentId: string;
    telegramSessionId: string;
    issuedByUserId: string;
    challengeHash: string;
    expiresAt: string;
  }) => Promise<TelegramOwnerLinkIssueResult>;
}

const disabledIssueRuntimeConfig: TelegramLinkIssueRuntimeConfig = {
  enabled: false,
};

export async function handleTelegramLinkRequest(
  request: Request,
  dependencies: TelegramLinkDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-link");
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxTelegramLinkBodyBytes);

    const issueRuntimeConfig = dependencies.issueRuntimeConfig ??
      disabledIssueRuntimeConfig;

    if (!issueRuntimeConfig.enabled) {
      return notConfiguredResponse();
    }

    const authorization = assertBearerAuthorization(request);
    const getEnv = requireDependency(dependencies.getEnv);
    const getUser = requireDependency(dependencies.getUser);
    const lookupAgentOwnership = requireDependency(
      dependencies.lookupAgentOwnership,
    );
    const lookupActiveTelegramSession = requireDependency(
      dependencies.lookupActiveTelegramSession,
    );
    const createChallengeMaterial = requireDependency(
      dependencies.createChallengeMaterial,
    );
    const issueOwnerLinkChallenge = requireDependency(
      dependencies.issueOwnerLinkChallenge,
    );
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const user = await getUser(supabaseUrl, anonKey, authorization);
    const userId = assertAuthenticatedUserId(user);
    const body = await readJsonObjectBody(request, maxTelegramLinkBodyBytes);
    const agentId = assertTelegramLinkBody(body);
    let ownership: AgentOwnershipRecord | null;

    try {
      ownership = await lookupAgentOwnership(agentId, userId);
    } catch {
      throw new HttpError(
        500,
        "server_error",
        "Telegram owner-link ownership lookup failed.",
      );
    }

    assertAgentOwnership(agentId, userId, ownership);

    const session = await lookupActiveTelegramSession(agentId);
    const material = await createChallengeMaterial();
    const validatedMaterial = assertChallengeMaterial(material);

    const issueResult = await issueOwnerLinkChallenge({
      agentId,
      telegramSessionId: session.telegramSessionId,
      issuedByUserId: userId,
      challengeHash: validatedMaterial.challengeHash,
      expiresAt: validatedMaterial.expiresAt,
    });
    assertTelegramLinkIssueResult(issueResult);

    return jsonResponse({
      ok: true,
      status: "link_ready",
      message: "Telegram owner-link challenge is ready.",
      telegramLink: buildTelegramOwnerLinkDeepLink(
        session.botHandle,
        validatedMaterial.challenge,
      ),
      expiresAt: validatedMaterial.expiresAt,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: "Telegram owner-link function failed.",
      },
      500,
    );
  }
}

export function assertTelegramLinkBody(body: Record<string, unknown>) {
  if (Object.keys(body).sort().join(",") !== "agentId") {
    throw new HttpError(
      400,
      "invalid_request",
      "Telegram owner-link request is invalid.",
    );
  }

  return assertAgentId(body.agentId);
}

export function assertChallengeMaterial(
  value: unknown,
): TelegramOwnerLinkChallengeMaterial {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram owner-link material.");
    }

    if (
      Object.keys(value).sort().join(",") !==
        "challenge,challengeHash,expiresAt"
    ) {
      throw new Error("Unexpected Telegram owner-link material.");
    }

    const challenge = assertTelegramOwnerLinkChallenge(value.challenge);
    const challengeHash = assertTelegramOwnerLinkChallengeHash(
      value.challengeHash,
    );

    if (typeof value.expiresAt !== "string") {
      throw new Error("Unexpected Telegram owner-link expiry.");
    }

    const expiresAtMs = Date.parse(value.expiresAt);
    const nowMs = Date.now();

    if (
      !Number.isFinite(expiresAtMs) ||
      expiresAtMs <= nowMs ||
      expiresAtMs > nowMs + telegramOwnerLinkChallengeTtlMs
    ) {
      throw new Error("Unexpected Telegram owner-link expiry.");
    }

    return {
      challenge,
      challengeHash,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  } catch {
    throw new HttpError(
      500,
      "server_error",
      "Telegram owner-link challenge generation failed.",
    );
  }
}

export function assertTelegramLinkIssueResult(
  value: unknown,
): TelegramOwnerLinkIssueResult {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).sort().join(",") !== "issued,status" ||
    value.issued !== true ||
    value.status !== "issued"
  ) {
    throw new HttpError(
      500,
      "server_error",
      "Telegram owner-link challenge issue failed.",
    );
  }

  return { issued: true, status: "issued" };
}

function requireDependency<T>(dependency: T | undefined): T {
  if (!dependency) {
    throw new HttpError(
      500,
      "server_error",
      "Telegram owner-link issue is not configured safely.",
    );
  }

  return dependency;
}

function notConfiguredResponse() {
  return jsonResponse(
    {
      ok: false,
      status: "not_configured",
      message: "Telegram owner linking is planned but not enabled yet.",
    },
    501,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
