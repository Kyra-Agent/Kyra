import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  testKyraTokenAddress,
  withUnpublishedOfficialKyraToken,
} from "./official-token-test-fixture.ts";
import {
  configureOfficialKyraTokenAddressForTests,
  createTransferTransactionShape,
  encodeKyraTransferData,
  getOfficialKyraTokenAddress,
  publishedOfficialKyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
  transferTransactionPolicyVersion,
} from "./transfer-transaction-policy.ts";
import {
  createSwapQuoteRequest,
  readSwapToken,
  swapQuotePolicyVersion,
  zeroExNativeTokenAddress,
} from "./swap-quote-policy.ts";
import { createExactAllowanceTransaction } from "./swap-execution-policy.ts";

const sender = "0x1111111111111111111111111111111111111111" as const;
const recipient = "0x2222222222222222222222222222222222222222" as const;
const spender = "0x3333333333333333333333333333333333333333" as const;

function kyraTransferInput() {
  return {
    sender,
    recipient,
    assetKind: "erc20",
    tokenAddress: testKyraTokenAddress,
    tokenSymbol: "KYRA",
    tokenDecimals: 18,
    amountAtomic: "1000000000000000000",
    valueWei: "0",
    data: encodeKyraTransferData(recipient, 1_000_000_000_000_000_000n),
    policyVersion: transferTransactionPolicyVersion,
  };
}

function swapQuoteInput(sellToken: string, buyToken: string) {
  return {
    workspaceId: "2094f3e1-3657-4754-98b9-470e8d72e14a",
    agentId: "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799",
    requestId: "swap:official-token:0001",
    chainKey: robinhoodMainnetChainKey,
    chainId: robinhoodMainnetChainId,
    taker: sender,
    sellToken,
    buyToken,
    sellAmount: "1000000000000000",
    slippageBps: 50,
    policyVersion: swapQuotePolicyVersion,
  };
}

Deno.test("keeps the official KYRA contract unpublished", () => {
  assertEquals(publishedOfficialKyraTokenAddress, null);
});

Deno.test("accepts only checksummed official token test fixtures", () => {
  assertThrows(() =>
    configureOfficialKyraTokenAddressForTests(
      testKyraTokenAddress.toLowerCase(),
    )
  );
  assertEquals(getOfficialKyraTokenAddress(), testKyraTokenAddress);
});

Deno.test("covers configured KYRA policy paths through the fixture", () => {
  assertEquals(createTransferTransactionShape(kyraTransferInput()).ok, true);
  assertEquals(
    createSwapQuoteRequest(
      swapQuoteInput(zeroExNativeTokenAddress, testKyraTokenAddress),
    ).ok,
    true,
  );
  assertEquals(readSwapToken(testKyraTokenAddress)?.symbol, "KYRA");
});

Deno.test("fails every KYRA path closed while the contract is unpublished", () => {
  withUnpublishedOfficialKyraToken(() => {
    assertEquals(getOfficialKyraTokenAddress(), null);

    const transfer = createTransferTransactionShape(kyraTransferInput());
    assertEquals(transfer, { ok: false, error: "unsupported_asset" });

    for (
      const [sellToken, buyToken] of [
        [zeroExNativeTokenAddress, testKyraTokenAddress],
        [testKyraTokenAddress, zeroExNativeTokenAddress],
      ]
    ) {
      assertEquals(
        createSwapQuoteRequest(swapQuoteInput(sellToken, buyToken)),
        { ok: false, error: "official_token_unavailable" },
      );
    }
    assertEquals(readSwapToken(testKyraTokenAddress), null);
    assertEquals(readSwapToken(zeroExNativeTokenAddress)?.symbol, "ETH");

    for (const amountAtomic of ["1", "0"]) {
      assertEquals(
        createExactAllowanceTransaction({
          tokenAddress: testKyraTokenAddress,
          spenderAddress: spender,
          amountAtomic,
        }),
        null,
      );
    }
  });
  assertEquals(getOfficialKyraTokenAddress(), testKyraTokenAddress);
});
