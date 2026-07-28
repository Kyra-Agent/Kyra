import { HttpError } from "./core.ts";
import type {
  TelegramAgentBrainProvider,
  TelegramAgentBrainRequest,
} from "./agent-brain.ts";

export type TelegramAgentBrainProviderFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiCompatibleTelegramAgentBrainProviderOptions {
  apiKey: unknown;
  model: unknown;
  endpoint?: unknown;
  fetch?: TelegramAgentBrainProviderFetch;
  timeoutMs?: number;
}

const defaultResponsesEndpoint = "https://api.openai.com/v1/responses";
const defaultProviderTimeoutMs = 20000;
const maxProviderTimeoutMs = 30000;
const maxApiKeyLength = 4096;
const maxModelLength = 128;
const maxEndpointLength = 2048;
const maxPromptMessageLength = 3000;
const maxPromptMessages = 6;
const maxAgentBrainCompletionTokens = 700;

export function createOpenAiCompatibleTelegramAgentBrainProvider(
  options: OpenAiCompatibleTelegramAgentBrainProviderOptions,
): TelegramAgentBrainProvider {
  const apiKey = readProviderApiKey(options.apiKey);
  const model = readProviderModel(options.model);
  const endpoint = readProviderEndpoint(options.endpoint);
  const fetchProvider = options.fetch ?? fetch;
  const timeoutMs = readProviderTimeoutMs(options.timeoutMs);

  return {
    async complete(request) {
      const payload = buildOpenAiCompatibleAgentBrainPayload(
        request,
        model,
        endpoint,
      );
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchProvider(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw mapProviderStatus(response.status);
        }

        let body: unknown;

        try {
          body = await response.json();
        } catch {
          throw invalidProviderResponse();
        }

        return { text: readProviderResponseText(body) };
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw providerFailure(
            "agent_brain_timeout",
            "Kyra agent brain request timed out.",
          );
        }

        throw providerFailure(
          "agent_brain_network_error",
          "Kyra agent brain could not reach its provider.",
        );
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

export function buildOpenAiCompatibleAgentBrainPayload(
  request: TelegramAgentBrainRequest,
  model: unknown,
  endpoint?: unknown,
) {
  const checkedModel = readProviderModel(model);
  const checkedRequest = assertProviderRequest(request);
  const checkedEndpoint = readProviderEndpoint(endpoint);
  const messages = checkedRequest.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (isChatCompletionsEndpoint(checkedEndpoint)) {
    return {
      model: checkedModel,
      messages,
      max_tokens: maxAgentBrainCompletionTokens,
      temperature: 0.2,
      reasoning: {
        effort: "none",
        exclude: true,
      },
      metadata: {
        kyra_surface: "telegram",
        kyra_mode: checkedRequest.mode,
      },
    };
  }

  return {
    model: checkedModel,
    input: messages,
    max_output_tokens: maxAgentBrainCompletionTokens,
    temperature: 0.2,
    metadata: {
      kyra_surface: "telegram",
      kyra_mode: checkedRequest.mode,
    },
  };
}

function isChatCompletionsEndpoint(endpoint: string) {
  return /\/chat\/completions\/?$/i.test(new URL(endpoint).pathname);
}

function assertProviderRequest(request: TelegramAgentBrainRequest) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw invalidProviderRequest();
  }

  if (request.mode !== "read_only") {
    throw invalidProviderRequest();
  }

  if (
    !Number.isSafeInteger(request.maxOutputCharacters) ||
    request.maxOutputCharacters < 1 ||
    request.maxOutputCharacters > 3000
  ) {
    throw invalidProviderRequest();
  }

  if (
    !Array.isArray(request.messages) ||
    !request.messages.length ||
    request.messages.length > maxPromptMessages
  ) {
    throw invalidProviderRequest();
  }

  const messages = request.messages.map((message) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      throw invalidProviderRequest();
    }

    const role = message.role;
    const content = message.content;

    if (role !== "system" && role !== "user") {
      throw invalidProviderRequest();
    }

    if (
      typeof content !== "string" ||
      !content.trim() ||
      content.length > maxPromptMessageLength
    ) {
      throw invalidProviderRequest();
    }

    return {
      role,
      content: content.trim(),
    };
  });

  return {
    mode: request.mode,
    maxOutputCharacters: request.maxOutputCharacters,
    messages,
  };
}

function readProviderApiKey(value: unknown) {
  if (typeof value !== "string") {
    throw providerUnavailable();
  }

  const apiKey = value.trim();

  if (!apiKey || apiKey.length > maxApiKeyLength) {
    throw providerUnavailable();
  }

  return apiKey;
}

function readProviderModel(value: unknown) {
  if (typeof value !== "string") {
    throw providerUnavailable();
  }

  const model = value.trim();

  if (
    !model ||
    model.length > maxModelLength ||
    !/^[A-Za-z0-9._:/-]+$/.test(model)
  ) {
    throw providerUnavailable();
  }

  return model;
}

function readProviderEndpoint(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return defaultResponsesEndpoint;
  }

  if (typeof value !== "string" || value.length > maxEndpointLength) {
    throw providerUnavailable();
  }

  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    throw providerUnavailable();
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw providerUnavailable();
  }

  return url.toString();
}

export function readProviderTimeoutMs(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return defaultProviderTimeoutMs;
  }

  return Math.min(Math.trunc(value), maxProviderTimeoutMs);
}

function readProviderResponseText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidProviderResponse();
  }

  const body = value as Record<string, unknown>;
  assertCompleteProviderResponse(body);

  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  const outputText = readOutputArrayText(body.output);
  if (outputText) {
    return outputText;
  }

  const chatCompletionText = readChatCompletionText(body.choices);
  if (chatCompletionText) {
    return chatCompletionText;
  }

  throw invalidProviderResponse();
}

function assertCompleteProviderResponse(body: Record<string, unknown>) {
  if ("status" in body && body.status !== "completed") {
    if (body.status === "incomplete") {
      throw incompleteProviderResponse();
    }

    throw invalidProviderResponse();
  }

  if (
    "incomplete_details" in body &&
    body.incomplete_details !== null &&
    body.incomplete_details !== undefined
  ) {
    throw incompleteProviderResponse();
  }

  if (!Array.isArray(body.choices) || !body.choices.length) {
    return;
  }

  const firstChoice = body.choices[0];

  if (
    !firstChoice ||
    typeof firstChoice !== "object" ||
    Array.isArray(firstChoice) ||
    !("finish_reason" in firstChoice)
  ) {
    return;
  }

  const finishReason = (firstChoice as Record<string, unknown>)
    .finish_reason;

  if (finishReason === "length") {
    throw incompleteProviderResponse();
  }

  if (typeof finishReason !== "string" || finishReason !== "stop") {
    throw invalidProviderResponse();
  }
}

function readOutputArrayText(value: unknown) {
  if (!Array.isArray(value)) {
    return "";
  }

  const parts: string[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const content = (item as Record<string, unknown>).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (
        contentItem &&
        typeof contentItem === "object" &&
        !Array.isArray(contentItem)
      ) {
        const text = (contentItem as Record<string, unknown>).text;
        if (typeof text === "string" && text.trim()) {
          parts.push(text.trim());
        }
      }
    }
  }

  return parts.join("\n").trim();
}

function readChatCompletionText(value: unknown) {
  if (!Array.isArray(value) || !value.length) {
    return "";
  }

  const firstChoice = value[0];

  if (
    !firstChoice ||
    typeof firstChoice !== "object" ||
    Array.isArray(firstChoice)
  ) {
    return "";
  }

  const message = (firstChoice as Record<string, unknown>).message;

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return "";
  }

  const content = (message as Record<string, unknown>).content;

  return typeof content === "string" ? content.trim() : "";
}

function mapProviderStatus(status: number) {
  if (status === 400) {
    return providerFailure(
      "agent_brain_request_rejected",
      "Kyra agent brain request was rejected by its provider.",
    );
  }

  if (status === 401 || status === 403) {
    return providerFailure(
      "agent_brain_auth_failed",
      "Kyra agent brain provider authentication failed.",
    );
  }

  if (status === 404) {
    return providerFailure(
      "agent_brain_model_unavailable",
      "Kyra agent brain model is unavailable.",
    );
  }

  if (status === 402) {
    return providerFailure(
      "agent_brain_payment_required",
      "Kyra agent brain provider requires available credit.",
    );
  }

  if (status === 408 || status === 409) {
    return providerFailure(
      "agent_brain_upstream_timeout",
      "Kyra agent brain provider timed out.",
    );
  }

  if (status === 429) {
    return providerFailure(
      "agent_brain_rate_limited",
      "Kyra agent brain provider rate limit was reached.",
    );
  }

  if (status >= 500) {
    return providerFailure(
      "agent_brain_upstream_error",
      "Kyra agent brain provider is temporarily unavailable.",
    );
  }

  return invalidProviderResponse();
}

function invalidProviderRequest(): never {
  throw new HttpError(
    500,
    "server_error",
    "Kyra agent brain provider request is invalid.",
  );
}

function invalidProviderResponse(): never {
  throw new HttpError(
    502,
    "agent_brain_provider_invalid_response",
    "Kyra agent brain provider returned an invalid response.",
  );
}

function incompleteProviderResponse(): never {
  throw new HttpError(
    502,
    "agent_brain_incomplete_response",
    "Kyra agent brain provider returned an incomplete response.",
  );
}

function providerFailure(code: string, message: string): never {
  throw new HttpError(503, code, message);
}

function providerUnavailable(): never {
  throw new HttpError(
    503,
    "agent_brain_unavailable",
    "Kyra agent brain is unavailable.",
  );
}
