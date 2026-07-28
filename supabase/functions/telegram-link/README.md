# Kyra Telegram Owner Link

Production status: active for private owner-chat pairing.

The function issues one short-lived challenge for an authenticated account owner and an active owned Telegram agent session. The owner completes the link in Telegram before read-only commands are authorized.

## Safety Contract

- Requires gateway JWT verification, a valid Supabase session, exact agent ownership, and one active matching Telegram session.
- Challenge material is generated only after all ownership and session checks pass.
- Only the challenge hash is persisted through the service-role issue RPC.
- The raw challenge appears once in the Telegram deep link and is never logged, persisted separately, or returned as a reusable field.
- Abuse controls return fixed sanitized rate-limit responses.
- Owner, workspace, session, challenge hash, token reference, BotFather token, and raw database details are never exposed.
- The function does not access wallet providers, sign, approve, or submit transactions.

The production issue and consume paths are deployed. Missing gates, expired challenges, ownership drift, replay, or session drift fail closed.
