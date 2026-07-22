import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { ChainPreparedActionStorageInput } from "./core.ts";
import {
  createChainPreparedActionInsertRow,
  createChainPreparedActionStorageAdapter,
  type ChainPreparedActionInsertRow,
} from "./storage-adapter.ts";

const now = new Date("2026-07-22T10:00:00.000Z");
const input: ChainPreparedActionStorageInput = {
  ownerUserId: "33333333-3333-4333-8333-333333333333",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  agentId: "11111111-1111-4111-8111-111111111111",
  requestId: "chain-status:request-1234",
  requestedAt: now.toISOString(),
  actionKind: "chain_status_check",
  chainKey: "robinhood_testnet",
  chainId: 46630,
  routeSummary: "Robinhood Chain Testnet status check only.",
  valueSummary: "No token spend, gas request, calldata, or signature.",
  risk: "read-only",
  expiryIso: null,
};

Deno.test("chain prepared row stores bounded summary without owner or wallet data", () => {
  const row = createChainPreparedActionInsertRow(input, now);
  const serialized = JSON.stringify(row);
  assertEquals(row.chain_key, input.chainKey);
  assertEquals(row.chain_id, input.chainId);
  assertEquals(row.provider, "chain_rpc");
  assertEquals(row.created_at, input.requestedAt);
  assertEquals(row.updated_at, now.toISOString());
  for (const forbidden of [
    input.ownerUserId,
    '"wallet_address":',
    '"private_key":',
    '"seed_phrase":',
    '"telegram_token":',
    '"api_key":',
    '"tx_hash":',
    '"raw_calldata":',
    '"provider_payload":',
    '"provider_payload_ref":',
  ]) {
    assert(!serialized.includes(forbidden));
  }
});

Deno.test("chain prepared storage upserts idempotently", async () => {
  const rows: ChainPreparedActionInsertRow[] = [];
  const adapter = createChainPreparedActionStorageAdapter({
    from(table) {
      assertEquals(table, "prepared_actions");
      return {
        upsert(row, options) {
          rows.push(row);
          assertEquals(options.onConflict, "workspace_id,agent_id,request_id");
          return {
            select(columns) {
              assertEquals(columns, "id");
              return {
                maybeSingle: async () => ({
                  data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  }, () => now);
  assertEquals((await adapter(input)).ok, true);
  assertEquals(rows.length, 1);
});

Deno.test("chain prepared storage hides database failures", async () => {
  const adapter = createChainPreparedActionStorageAdapter({
    from() {
      return {
        upsert() {
          return {
            select() {
              return {
                maybeSingle: async () => ({
                  data: null,
                  error: { message: "raw provider secret" },
                }),
              };
            },
          };
        },
      };
    },
  });
  await assertRejects(() => adapter(input), Error, "Prepared action storage failed.");
});
