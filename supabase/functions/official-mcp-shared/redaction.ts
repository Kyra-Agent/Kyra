const sensitiveMarkers = [
  /authorization[_ -]?code/iu,
  /oauth[_ -]?state/iu,
  /pkce/iu,
  /bearer\s+[^\s]+/iu,
  /access[_ -]?token/iu,
  /refresh[_ -]?token/iu,
  /credential[_ -]?ref/iu,
  /wallet[_ -]?payload/iu,
  /calldata/iu,
  /signature/iu,
  /telegram[_ -]?(?:bot[_ -]?)?token/iu,
  /service[_ -]?role/iu,
  /\bsk-[A-Za-z0-9_-]{16,}\b/u,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/u,
] as const;

export const officialMcpSanitizedFallback =
  "Official Base MCP route is unavailable.";

export function containsOfficialMcpSensitiveText(value: unknown) {
  if (typeof value !== "string") return false;

  return sensitiveMarkers.some((pattern) => pattern.test(value));
}

export function sanitizeOfficialMcpPublicMessage(
  value: unknown,
  fallback = officialMcpSanitizedFallback,
) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 256 ||
    containsOfficialMcpSensitiveText(value)
  ) {
    return fallback;
  }

  return value;
}
