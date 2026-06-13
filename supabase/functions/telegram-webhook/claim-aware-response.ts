import {
  assertTelegramUpdateClaimResult,
  type TelegramUpdateClaimResult,
} from "./idempotency.ts";
import {
  buildTelegramReadOnlyCommandResponse,
  type TelegramReadOnlyCommandResponse,
} from "./read-only-response.ts";

export type TelegramClaimedReadOnlyResponsePlan =
  | {
    status: "claimed";
    shouldDeliver: true;
    response: TelegramReadOnlyCommandResponse;
  }
  | {
    status: "duplicate";
    shouldDeliver: false;
  };

export function planTelegramClaimedReadOnlyResponse(
  claimResult: unknown,
  command: unknown,
  text?: unknown,
): TelegramClaimedReadOnlyResponsePlan {
  const claim = assertTelegramUpdateClaimResult(claimResult);

  if (isDuplicateClaim(claim)) {
    return {
      status: "duplicate",
      shouldDeliver: false,
    };
  }

  return {
    status: "claimed",
    shouldDeliver: true,
    response: buildTelegramReadOnlyCommandResponse(command, text),
  };
}

function isDuplicateClaim(claim: TelegramUpdateClaimResult) {
  return claim.status === "duplicate";
}
