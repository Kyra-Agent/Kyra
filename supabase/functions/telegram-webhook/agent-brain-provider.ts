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
const defaultProviderTimeoutMs = 8000;
const maxApiKeyLength = 4096;
const maxModelLength = 128;
const maxEndpointLength = 2048;
const maxPromptMessageLength = 3000;
const maxPromptMessages = 6;

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
      const payload = buildOpenAiCompatibleAgentBrainPayload(request, model);
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
          throw providerUnavailable();
        }

        throw providerUnavailable();
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

export function buildOpenAiCompatibleAgentBrainPayload(
  request: TelegramAgentBrainRequest,
  model: unknown,
) {
  const checkedModel = readProviderModel(model);
  const checkedRequest = assertProviderRequest(request);

  return {
    model: checkedModel,
    input: checkedRequest.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    max_output_tokens: 220,
    temperature: 0.2,
    metadata: {
      kyra_surface: "telegram",
      kyra_mode: checkedRequest.mode,
    },
  };
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
    request.maxOutputCharacters > 700
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
    !/^[A-Za-z0-9._:-]+$/.test(model)
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

function readProviderTimeoutMs(value: number | undefined) {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return defaultProviderTimeoutMs;
  }

  return Math.min(Math.trunc(value), defaultProviderTimeoutMs);
}

function readProviderResponseText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidProviderResponse();
  }

  const body = value as Record<string, unknown>;

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
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return providerUnavailable();
  }

  if (status === 408 || status === 409 || status === 429 || status >= 500) {
    return providerUnavailable();
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
    "agent_brain_invalid_response",
    "Kyra agent brain returned an invalid response.",
  );
}

function providerUnavailable(): never {
  throw new HttpError(
    503,
    "agent_brain_unavailable",
    "Kyra agent brain is unavailable.",
  );
}
