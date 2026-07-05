import type {
  Phase8PersistedExecutionResult,
} from "../types/phase8ResultPersistence";

const phase8ResultPersistenceKey = "kyra.phase8.ownerExecutionResults.v1";
const maxStoredResults = 8;

export function loadPhase8PersistedExecutionResults(
  ownerUserId: string | null | undefined,
): Phase8PersistedExecutionResult[] {
  if (!ownerUserId || typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(phase8ResultPersistenceKey);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((record) =>
      isPersistedResultForOwner(record, ownerUserId)
    );
  } catch {
    return [];
  }
}

export function savePhase8PersistedExecutionResult(
  record: Phase8PersistedExecutionResult,
): Phase8PersistedExecutionResult[] {
  if (typeof window === "undefined") {
    return [record];
  }

  const existing = loadPhase8PersistedExecutionResults(record.ownerUserId);
  const next = [
    record,
    ...existing.filter((item) => item.id !== record.id),
  ].slice(0, maxStoredResults);

  window.sessionStorage.setItem(
    phase8ResultPersistenceKey,
    JSON.stringify(next),
  );

  return next;
}

export function clearPhase8PersistedExecutionResults(
  ownerUserId: string | null | undefined,
) {
  if (!ownerUserId || typeof window === "undefined") {
    return [];
  }

  const existing = loadPhase8PersistedExecutionResults(ownerUserId);
  const remaining = existing.filter((record) => record.ownerUserId !== ownerUserId);
  window.sessionStorage.setItem(
    phase8ResultPersistenceKey,
    JSON.stringify(remaining),
  );

  return remaining;
}

function isPersistedResultForOwner(
  value: unknown,
  ownerUserId: string,
): value is Phase8PersistedExecutionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<Phase8PersistedExecutionResult>;
  return record.ownerUserId === ownerUserId &&
    record.visibility === "owner-only" &&
    typeof record.id === "string" &&
    typeof record.workspaceId === "string" &&
    typeof record.agentId === "string" &&
    typeof record.preparedActionId === "string" &&
    typeof record.submissionNonce === "string" &&
    typeof record.txHash === "string" &&
    typeof record.txHashLabel === "string" &&
    typeof record.updatedAt === "string" &&
    (
      record.status === "submitted" ||
      record.status === "confirmed" ||
      record.status === "failed"
    );
}
