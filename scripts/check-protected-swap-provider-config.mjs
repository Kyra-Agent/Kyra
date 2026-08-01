import { readFileSync } from "node:fs";
import { getAddress, isAddress } from "viem";

const requireProvider = process.argv.includes("--require-provider");
const allowExecution = process.argv.includes("--allow-execution");
const requiredProviderKeys = [
  "KYRA_ZEROX_API_KEY",
  "KYRA_ZEROX_SWAP_ALLOWED_TARGETS",
  "KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS",
  "KYRA_ZEROX_ALLOWED_SOURCES",
];

function readExample(path) {
  return new Map(
    readFileSync(path, "utf8")
      .split(/\r?\n/u)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function parseAddressAllowlist(name, value) {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length < 1 || entries.length > 16) {
    throw new Error(`${name} must contain between 1 and 16 addresses.`);
  }

  const normalized = entries.map((entry) => {
    if (!isAddress(entry, { strict: true })) {
      throw new Error(`${name} contains an invalid address.`);
    }
    const address = getAddress(entry).toLowerCase();
    if (address === "0x0000000000000000000000000000000000000000") {
      throw new Error(`${name} contains the zero address.`);
    }
    return address;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${name} contains duplicate addresses.`);
  }
}

function parseSourceAllowlist(value) {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (
    entries.length < 1 ||
    entries.length > 32 ||
    entries.some((entry) => !/^[A-Za-z0-9_.:-]{1,64}$/u.test(entry))
  ) {
    throw new Error(
      "KYRA_ZEROX_ALLOWED_SOURCES must contain between 1 and 32 valid entries.",
    );
  }
  if (new Set(entries).size !== entries.length) {
    throw new Error("KYRA_ZEROX_ALLOWED_SOURCES contains duplicate entries.");
  }
}

const backendExample = readExample("supabase/functions/.env.example");
const frontendExample = readExample(".env.example");

for (const key of requiredProviderKeys) {
  if (!backendExample.has(key) || backendExample.get(key) !== "") {
    throw new Error(`${key} must exist without a value in the backend example.`);
  }
}
if (backendExample.get("KYRA_PROTECTED_SWAP_EXECUTION_ENABLED") !== "false") {
  throw new Error("Backend protected swap execution must default to false.");
}
if (frontendExample.get("VITE_KYRA_PROTECTED_SWAP_ENABLED") !== "false") {
  throw new Error("Frontend protected swap exposure must default to false.");
}

const runtime = new Map(
  [
    ...requiredProviderKeys,
    "KYRA_ZEROX_TIMEOUT_MS",
    "KYRA_PROTECTED_SWAP_EXECUTION_ENABLED",
  ].map((key) => [key, process.env[key]?.trim() ?? ""]),
);
const configuredCount = requiredProviderKeys.filter((key) => runtime.get(key))
  .length;

if (requireProvider || configuredCount > 0) {
  const missing = requiredProviderKeys.filter((key) => !runtime.get(key));
  if (missing.length > 0) {
    throw new Error(
      `Protected swap provider configuration is incomplete: ${missing.join(", ")}.`,
    );
  }

  const apiKey = runtime.get("KYRA_ZEROX_API_KEY");
  if (
    apiKey.length < 8 ||
    /^(change|example|placeholder|test)/iu.test(apiKey)
  ) {
    throw new Error("KYRA_ZEROX_API_KEY does not look production-qualified.");
  }

  parseAddressAllowlist(
    "KYRA_ZEROX_SWAP_ALLOWED_TARGETS",
    runtime.get("KYRA_ZEROX_SWAP_ALLOWED_TARGETS"),
  );
  parseAddressAllowlist(
    "KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS",
    runtime.get("KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS"),
  );
  parseSourceAllowlist(runtime.get("KYRA_ZEROX_ALLOWED_SOURCES"));
}

const timeoutValue = runtime.get("KYRA_ZEROX_TIMEOUT_MS") || "3500";
if (!/^[0-9]+$/u.test(timeoutValue)) {
  throw new Error("KYRA_ZEROX_TIMEOUT_MS must be an integer.");
}
const timeoutMs = Number(timeoutValue);
if (timeoutMs < 1000 || timeoutMs > 5000) {
  throw new Error("KYRA_ZEROX_TIMEOUT_MS must be between 1000 and 5000.");
}

const executionValue =
  runtime.get("KYRA_PROTECTED_SWAP_EXECUTION_ENABLED") || "false";
if (!["false", "true"].includes(executionValue)) {
  throw new Error("KYRA_PROTECTED_SWAP_EXECUTION_ENABLED must be true or false.");
}
if (executionValue === "true" && !allowExecution) {
  throw new Error(
    "Protected swap execution is enabled without --allow-execution audit intent.",
  );
}

const providerStatus = configuredCount === requiredProviderKeys.length
  ? "configured"
  : "not configured";
console.log(
  `Protected swap provider configuration passed (provider: ${providerStatus}; execution: ${executionValue}).`,
);
