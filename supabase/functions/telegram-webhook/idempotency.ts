import { HttpError } from "./core.ts";

export interface TelegramUpdateClaimResult {
  claimed: boolean;
  status: "claimed" | "duplicate";
}

export function assertTelegramUpdateClaimResult(
  value: unknown,
): TelegramUpdateClaimResult {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram update claim result.");
    }

    const keys = Object.keys(value).sort();

    if (keys.join(",") !== "claimed,status") {
      throw new Error("Unexpected Telegram update claim result.");
    }

    if (value.claimed === true && value.status === "claimed") {
      return { claimed: true, status: "claimed" };
    }

    if (value.claimed === false && value.status === "duplicate") {
      return { claimed: false, status: "duplicate" };
    }

    throw new Error("Unexpected Telegram update claim result.");
  } catch (error) {
    throw sanitizeTelegramUpdateClaimError(error);
  }
}

export function shouldProcessTelegramUpdateClaim(value: unknown) {
  return assertTelegramUpdateClaimResult(value).claimed;
}

export function sanitizeTelegramUpdateClaimError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram update claim validation failed.",
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
