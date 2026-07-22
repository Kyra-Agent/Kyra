# Kyra Chain Action Prepare

Default-off signed-in owner route for chain-neutral read-only preparation.

The first allowlisted action is `chain_status_check`. The function binds the
authenticated owner, workspace, persisted agent, reviewed chain key and chain
ID, request freshness, persistent rate limit, exact provider response, and an
owner-only sanitized prepared-action row.

It does not accept or emit recipients, token amounts, calldata, approvals,
wallet addresses, signatures, signed payloads, private keys, seed phrases,
Telegram tokens, transaction hashes, or raw provider errors. Telegram and
public profiles cannot call this route.

The runtime stays inert unless `KYRA_CHAIN_ACTION_PREPARE_ENABLED=true` and the
endpoint, endpoint hostname, shared secret, provider protocol, chain key, and
chain ID all pass exact validation.
