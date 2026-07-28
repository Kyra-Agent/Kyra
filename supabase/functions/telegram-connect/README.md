# Kyra Telegram Connect

Production status: active for authenticated private agent deployment flows.

This function validates a BotFather token, stores it through Kyra's backend-only secret boundary, stages the owned Telegram session, registers the webhook, and activates the exact session only when every reviewed runtime gate and dependency passes.

## Connection Sequence

1. Validate the Supabase account session and exact agent ownership.
2. Validate the submitted bot token with Telegram `getMe`.
3. Store the token through the approved backend secret store.
4. Update the existing owned Telegram session to a bounded queued state.
5. Generate and store a webhook-secret reference without returning the secret.
6. Register the configured Kyra webhook with Telegram.
7. Activate the exact queued session and return safe bot metadata only.

## Safety Contract

- The token is accepted only through an authenticated private flow and is cleared from frontend state after submission.
- Raw tokens, token references, webhook secrets, owner IDs, workspace IDs, session IDs, Telegram bot IDs, and raw provider errors are never returned or logged.
- Session persistence never creates authority outside the owned agent.
- Partial failures trigger best-effort webhook deletion and secret revocation; incomplete sessions remain non-active for recovery.
- Runtime gates enable only for exact reviewed values and fail closed when dependencies are missing.
- Connection never enables wallet signing, approval, or transaction submission from Telegram.

The function is deployed and active. Telegram operation still depends on the production runtime gates, backend secrets, schema, webhook receiver, and owner-chat authorization remaining healthy.
