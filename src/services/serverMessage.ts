// The transaction and swap Edge Functions only return fixed, user-facing
// messages, so a refused request can show the backend's own reason.
export function readServerMessage(payload: unknown) {
  const message = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).message
    : null;
  return typeof message === "string" && message.length > 0 && message.length <= 200
    ? message
    : null;
}
