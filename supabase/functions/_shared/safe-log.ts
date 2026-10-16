// The only reviewed logger for Edge Function runtime code. It accepts short
// snake_case identifiers and nothing else, so user text, tokens, ids, and
// model output can never be written to platform logs.
const safeIdentifierPattern = /^[a-z][a-z0-9_]{0,63}$/;

export function logSafeEvent(event: string, code: string) {
  const safeEvent = safeIdentifierPattern.test(event) ? event : "invalid_event";
  const safeCode = safeIdentifierPattern.test(code) ? code : "invalid_code";

  console.warn(JSON.stringify({ event: safeEvent, code: safeCode }));
}
