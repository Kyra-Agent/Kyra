import { isServerExpiryWithinLifetime, maxServerClockSkewMs } from "../src/services/serverExpiry.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const now = Date.parse("2026-10-21T03:21:10.000Z");
const tenMinutes = 10 * 60 * 1000;

Deno.test("server expiry accepts a fresh intent when the visitor clock runs slow", () => {
  // The owner's computer was 2.3 seconds behind the server.
  assert(
    isServerExpiryWithinLifetime(now + tenMinutes + 2_300, tenMinutes, now),
    "A few seconds of drift must not reject a valid intent.",
  );
  assert(
    isServerExpiryWithinLifetime(now + tenMinutes, tenMinutes, now),
    "An exact 10-minute expiry is valid.",
  );
});

Deno.test("server expiry still rejects expired and far-future intents", () => {
  assert(!isServerExpiryWithinLifetime(now, tenMinutes, now), "Expired intents are rejected.");
  assert(
    !isServerExpiryWithinLifetime(now + tenMinutes + maxServerClockSkewMs + 1, tenMinutes, now),
    "Expiries beyond the lifetime plus drift are rejected.",
  );
  assert(!isServerExpiryWithinLifetime(Number.NaN, tenMinutes, now), "Unparseable expiries are rejected.");
});
