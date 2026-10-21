// Expiry times in backend responses come from the server clock, while
// Date.now() is the visitor's clock. A computer running a few seconds slow
// would otherwise see a fresh 10-minute intent as "more than 10 minutes
// away" and reject a valid response, so allow for ordinary clock drift.
export const maxServerClockSkewMs = 5 * 60 * 1000;

export function isServerExpiryWithinLifetime(
  expiresAt: number,
  lifetimeMs: number,
  now = Date.now(),
) {
  return Number.isFinite(expiresAt) &&
    expiresAt > now &&
    expiresAt <= now + lifetimeMs + maxServerClockSkewMs;
}
