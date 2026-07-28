# Kyra Telegram Webhook

Production status: active for owner-linked read-only commands and multilingual natural-language planning.

The webhook verifies Telegram delivery, resolves the active agent session and backend-only bot secret, authorizes the linked owner chat, claims each update once, loads the deployed template and module stack, and sends either a deterministic command response or a validated LLM-assisted reply.

## Supported Surface

- `/help`
- `/status`
- `/agent`
- `/actions`
- `/modules`
- `/policy`
- bounded read-only planning, briefing, copy, and risk-review prompts

Replies use the deployed template, module stack, user request, and detected language. Eligible natural-language requests may use the configured backend-only OpenAI-compatible provider. Provider output is schema-, scope-, safety-, and quality-validated before delivery. Invalid, unavailable, or unsafe provider output falls back to deterministic template-aware content without opening execution access.

## Request Pipeline

1. Verify the Telegram webhook secret header.
2. Resolve the exact active agent session.
3. Parse the bounded update and consume owner-link challenges when applicable.
4. Verify linked-chat authorization.
5. Atomically claim the update with a bounded retry lease.
6. Load sanitized template and module context.
7. Classify read-only versus execution-like intent.
8. Generate and validate the deterministic or LLM-assisted response.
9. Resolve the backend-only bot token and deliver once.
10. Record metadata-only delivery state.

## Security Contract

- Request bodies, chat content, prompts, replies, bot tokens, webhook secrets, challenge material, provider payloads, wallet data, and transaction material are not copied into logs or retry state.
- Delivery state stores bounded identifiers, status, attempt count, lease timestamps, and delivery timestamps only.
- Concurrent workers cannot deliver the same claimed update.
- LLM endpoint, model, and API key are read only inside the Edge Function after webhook, session, authorization, claim, and provider gates pass.
- Runtime gates enable only for exact reviewed values and fail closed.
- Telegram cannot create approvals, prepared actions, wallet prompts, signatures, Robinhood Chain calls, or transaction submissions.

## Execution Boundary

Wallet, approval, swap, transfer, contract, and transaction intent is classified before the LLM path. Telegram may return a risk review, plan, or checklist, but `canExecuteFromTelegram` and direct draft or submission authority remain false. All signing and submission stay in the authenticated private owner workspace.

The production webhook, template context, multilingual LLM path, retry-safe delivery, and owner-link flow are live. Expansion into Telegram write or execution commands is explicitly out of scope for the current release.
