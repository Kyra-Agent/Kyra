import {
  createQualificationRequests,
  QualificationError,
  qualifyZeroExProvider,
} from "./protected-swap-provider-qualification.mjs";

function readInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name]?.trim() || String(fallback);
  if (!/^[0-9]+$/u.test(raw)) throw new QualificationError(`invalid_${name}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new QualificationError(`invalid_${name}`);
  }
  return value;
}

function readPositiveAtomicAmount(name, fallback) {
  const value = process.env[name]?.trim() || fallback;
  if (!/^[1-9][0-9]*$/u.test(value)) {
    throw new QualificationError(`invalid_${name}`);
  }
  return value;
}

async function main() {
  if (
    process.env.KYRA_PROTECTED_SWAP_EXECUTION_ENABLED?.trim() === "true" ||
    process.env.VITE_KYRA_PROTECTED_SWAP_ENABLED?.trim() === "true"
  ) {
    throw new QualificationError("qualification_requires_default_off_gates");
  }

  const apiKey = process.env.KYRA_ZEROX_API_KEY?.trim() ?? "";
  const taker = process.env.KYRA_ZEROX_QUALIFICATION_TAKER?.trim() ?? "";
  const requests = createQualificationRequests({
    taker,
    ethSellAmountAtomic: readPositiveAtomicAmount(
      "KYRA_ZEROX_QUALIFICATION_ETH_AMOUNT_ATOMIC",
      "100000000000000",
    ),
    kyraSellAmountAtomic: readPositiveAtomicAmount(
      "KYRA_ZEROX_QUALIFICATION_KYRA_AMOUNT_ATOMIC",
      "1000000000000000000",
    ),
    slippageBps: readInteger(
      "KYRA_ZEROX_QUALIFICATION_SLIPPAGE_BPS",
      50,
      10,
      300,
    ),
  });
  const report = await qualifyZeroExProvider({
    apiKey,
    requests,
    timeoutMs: readInteger(
      "KYRA_ZEROX_QUALIFICATION_TIMEOUT_MS",
      3500,
      1000,
      5000,
    ),
  });

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.complete) process.exitCode = 1;
}

main().catch((error) => {
  const code = error instanceof QualificationError
    ? error.code
    : "qualification_failed";
  process.stderr.write(`Protected swap provider qualification failed: ${code}.\n`);
  process.exitCode = 1;
});
