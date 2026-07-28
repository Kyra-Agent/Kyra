# Kyra Telegram Disconnect

Production status: active for authenticated owner-scoped pause, disconnect, and revoke operations.

## Runtime Contract

- Requires an exact runtime gate, bearer session, valid request body, and owned active Telegram session.
- `pause` claims the owned session through the reviewed service-role RPC and returns a sanitized paused status.
- `disconnect` and `revoke` run the cleanup finalizer: stop webhook delivery, revoke backend-only token and webhook references, and close the owned session state.
- Cleanup is idempotent and partial failures remain sanitized and recoverable.

## Safety Contract

- No BotFather token is accepted through this endpoint.
- Raw token values, token references, webhook secrets, webhook references, Telegram URLs, session IDs, owner IDs, workspace IDs, and operator notes are never returned or logged.
- No database or Telegram operation occurs before authentication, ownership, request, and runtime-gate checks pass.
- Disconnect never creates wallet authority or transaction access.

The production function is deployed and active. Runtime gates still fail closed if the reviewed cleanup dependencies are unavailable.
