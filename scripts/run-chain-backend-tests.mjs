import { spawnSync } from "node:child_process";

const testFiles = [
  "supabase/functions/_shared/chain-runtime_test.ts",
  "supabase/functions/chain-status-provider/core_test.ts",
  "supabase/functions/chain-status-provider/runtime-config_test.ts",
  "supabase/functions/chain-action-prepare/core_test.ts",
  "supabase/functions/chain-action-prepare/provider-adapter_test.ts",
  "supabase/functions/chain-action-prepare/provider-contract_test.ts",
  "supabase/functions/chain-action-prepare/rate-limit_test.ts",
  "supabase/functions/chain-action-prepare/runtime-config_test.ts",
  "supabase/functions/chain-action-prepare/storage-adapter_test.ts",
];

for (const testFile of testFiles) {
  const result = spawnSync("deno", ["test", testFile], {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: "pipe",
    windowsHide: true,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Chain backend tests passed serially.");
