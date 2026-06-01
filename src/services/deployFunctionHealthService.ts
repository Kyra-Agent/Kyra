import { appConfig } from "../config/appConfig";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

export type DeployFunctionHealthStatus =
  | "not-configured"
  | "checking"
  | "ready"
  | "missing-secret"
  | "unavailable"
  | "error";

interface DeployFunctionHealthPayload {
  ok?: boolean;
  status?: string;
  message?: string;
}

export interface DeployFunctionHealthResult {
  status: Exclude<DeployFunctionHealthStatus, "checking">;
  message: string;
}

export function getDeployFunctionHealthLabel(status: DeployFunctionHealthStatus) {
  switch (status) {
    case "ready":
      return "edge ready";
    case "missing-secret":
      return "missing secret";
    case "unavailable":
      return "fallback active";
    case "error":
      return "health error";
    case "checking":
      return "checking";
    case "not-configured":
    default:
      return "edge scaffolded";
  }
}

export function getDeployFunctionHealthTone(status: DeployFunctionHealthStatus) {
  if (status === "ready") {
    return "ready";
  }

  if (status === "missing-secret" || status === "error") {
    return "error";
  }

  return status === "checking" ? "locked" : "standby";
}

async function parseHealthPayload(response: Response): Promise<DeployFunctionHealthPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as DeployFunctionHealthPayload;
  } catch {
    return {
      message: text,
    };
  }
}

export async function fetchDeployFunctionHealth(): Promise<DeployFunctionHealthResult> {
  if (!appConfig.functions.deployAgentConfigured) {
    return {
      status: "not-configured",
      message: "Deploy function URL is not configured.",
    };
  }

  try {
    const apiKey = getSupabaseApiKey();
    const response = await fetch(appConfig.functions.deployAgentUrl, {
      headers: {
        Accept: "application/json",
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const payload = await parseHealthPayload(response);

    if (response.ok && payload.ok !== false && payload.status === "ready") {
      return {
        status: "ready",
        message: "deploy-agent Edge Function is reachable and configured.",
      };
    }

    if (response.status === 404) {
      return {
        status: "unavailable",
        message: "deploy-agent is not deployed yet. RLS fallback remains active.",
      };
    }

    if (response.status === 503 || payload.status === "missing_secret") {
      return {
        status: "missing-secret",
        message: "deploy-agent is deployed but a required function secret is missing.",
      };
    }

    return {
      status: "error",
      message: sanitizeSupabaseMessage(payload.message ?? `Health check failed with ${response.status}.`),
    };
  } catch (error) {
    return {
      status: "unavailable",
      message:
        error instanceof Error
          ? sanitizeSupabaseMessage(error.message)
          : "deploy-agent health check failed.",
    };
  }
}
