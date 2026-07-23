import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source = readFileSync("src/types/robinhoodTestnetCloseout.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(output, { module, exports: module.exports });
const { evaluateRobinhoodTestnetCloseout } = module.exports;

const baseline = {
  enabled: true,
  ownerSignedIn: true,
  selectedAgent: true,
  chainStatusPrepared: false,
  walletConnected: false,
  reviewedActionReady: false,
  ownerWindowArmed: false,
  submitterReady: false,
  transactionStatus: "not_started",
};

const chainRequired = evaluateRobinhoodTestnetCloseout(baseline);
assert.equal(chainRequired.nextAction, "check_chain_status");
assert.equal(chainRequired.steps[2].status, "current");
assert.equal(chainRequired.steps[3].status, "pending");

const walletRequired = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
});
assert.equal(walletRequired.nextAction, "connect_wallet");

const reviewReady = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
  walletConnected: true,
  reviewedActionReady: true,
});
assert.equal(reviewReady.status, "ready_for_review");
assert.equal(reviewReady.nextAction, "open_review_window");

const submitReady = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
  walletConnected: true,
  reviewedActionReady: true,
  ownerWindowArmed: true,
  submitterReady: true,
});
assert.equal(submitReady.status, "ready_to_submit");
assert.equal(submitReady.nextAction, "submit_transaction");

const waiting = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
  walletConnected: true,
  reviewedActionReady: true,
  ownerWindowArmed: true,
  submitterReady: true,
  transactionStatus: "pending_receipt",
});
assert.equal(waiting.status, "waiting_for_receipt");
assert.equal(waiting.nextAction, "wait_for_receipt");

const refreshedWaiting = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  transactionStatus: "pending_receipt",
});
assert.equal(refreshedWaiting.status, "waiting_for_receipt");
assert.equal(refreshedWaiting.nextAction, "wait_for_receipt");
assert.equal(refreshedWaiting.steps[2].status, "complete");
assert.equal(refreshedWaiting.steps[6].status, "complete");
assert.equal(refreshedWaiting.steps[7].status, "current");

const refreshedComplete = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  transactionStatus: "confirmed",
});
assert.equal(refreshedComplete.status, "complete");
assert.ok(refreshedComplete.steps.every((step) => step.status === "complete"));
const complete = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
  walletConnected: true,
  reviewedActionReady: true,
  ownerWindowArmed: true,
  submitterReady: true,
  transactionStatus: "confirmed",
});
assert.equal(complete.status, "complete");
assert.equal(complete.nextAction, "complete");
assert.ok(complete.steps.every((step) => step.status === "complete"));

const failed = evaluateRobinhoodTestnetCloseout({
  ...baseline,
  chainStatusPrepared: true,
  walletConnected: true,
  reviewedActionReady: true,
  ownerWindowArmed: true,
  submitterReady: true,
  transactionStatus: "failed",
});
assert.equal(failed.status, "failed");
assert.equal(failed.nextAction, "retry_transaction");
assert.equal(failed.steps[6].status, "failed");

console.log("Robinhood testnet closeout workflow tests passed.");