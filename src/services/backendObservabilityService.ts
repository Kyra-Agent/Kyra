import { sanitizeSupabaseMessage } from "./supabaseRestClient";

export type BackendEventKind = "deploy" | "reset" | "agent-remove" | "telegram-disconnect" | "dashboard-refresh" | "function-health";
export type BackendEventStatus = "running" | "success" | "error" | "blocked" | "info";

export interface BackendEvent {
  id: string;
  kind: BackendEventKind;
  status: BackendEventStatus;
  message: string;
  source?: string;
  code?: string;
  timestamp: string;
}

const STORAGE_KEY = "kyra.backend.events.v1";
const MAX_EVENTS = 8;
const eventTarget = new EventTarget();

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function sanitizeEventText(value: string) {
  return sanitizeSupabaseMessage(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "email_[hidden]")
    .slice(0, 220);
}

function readStoredEvents(): BackendEvent[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as BackendEvent[];

    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

function writeStoredEvents(events: BackendEvent[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
  } catch {
    // Observability should never block the demo flow.
  }
}

export function getBackendEvents() {
  return readStoredEvents();
}

export function getLatestBackendEvent(kind?: BackendEventKind) {
  return readStoredEvents().find((event) => !kind || event.kind === kind) ?? null;
}

export function recordBackendEvent(event: Omit<BackendEvent, "id" | "timestamp">) {
  const nextEvent: BackendEvent = {
    ...event,
    id: `${event.kind}-${Date.now().toString(36)}`,
    message: sanitizeEventText(event.message),
    code: event.code ? sanitizeEventText(event.code) : undefined,
    source: event.source ? sanitizeEventText(event.source) : undefined,
    timestamp: new Date().toISOString(),
  };
  const events = [nextEvent, ...readStoredEvents()].slice(0, MAX_EVENTS);

  writeStoredEvents(events);
  eventTarget.dispatchEvent(new Event("change"));

  return nextEvent;
}

export function subscribeBackendEvents(callback: () => void) {
  eventTarget.addEventListener("change", callback);

  return () => eventTarget.removeEventListener("change", callback);
}
