import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const auth = read("src/services/supabaseAuthService.ts");
const observability = read("src/services/backendObservabilityService.ts");
const restClient = read("src/services/supabaseRestClient.ts");
const gitignore = read(".gitignore");

assert(
  auth.includes("window.sessionStorage") &&
    auth.includes("storage.setItem(AUTH_STORAGE_KEY") &&
    !auth.includes("window.localStorage.setItem(AUTH_STORAGE_KEY") &&
    !auth.includes("window.localStorage.getItem(AUTH_STORAGE_KEY"),
  "Authentication tokens must use sessionStorage, never persistent localStorage.",
);
assert(
  auth.includes("window.localStorage.removeItem(AUTH_STORAGE_KEY)"),
  "Legacy persistent auth sessions must be removed.",
);
assert(
  observability.includes("function getSessionStorage()") &&
    observability.includes("return window.sessionStorage") &&
    observability.includes("storage.getItem(STORAGE_KEY)") &&
    observability.includes("storage.setItem(STORAGE_KEY") &&
    !observability.includes("window.localStorage.getItem(STORAGE_KEY)") &&
    !observability.includes("window.localStorage.setItem(STORAGE_KEY"),
  "Owner observability events must remain session-scoped and storage-safe.",
);
for (const marker of [
  "openrouter_[hidden]",
  "telegram_token_[hidden]",
  "transaction_[hidden]",
  "wallet_[hidden]",
]) {
  assert(restClient.includes(marker), `Missing sensitive-error sanitizer: ${marker}`);
}
assert(
  gitignore.includes(".env.*") && gitignore.includes("*.local"),
  "Local environment and credential files must stay ignored.",
);

console.log("Auth and private storage checks passed.");
