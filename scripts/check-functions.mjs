import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const functionEntrypoints = [
  "supabase/functions/deploy-agent/index.ts",
  "supabase/functions/reset-demo-workspace/index.ts",
];

const denoCandidates = [
  process.env.DENO_BIN,
  "deno",
  process.platform === "win32" ? "deno.exe" : undefined,
  process.env.USERPROFILE ? join(process.env.USERPROFILE, ".deno", "bin", "deno.exe") : undefined,
  process.env.HOME ? join(process.env.HOME, ".deno", "bin", "deno") : undefined,
].filter(Boolean);

function commandExists(command) {
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command);
  }

  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  return result.status === 0;
}

const denoBin = denoCandidates.find(commandExists);

if (!denoBin) {
  console.error("Deno is required to check Supabase Edge Functions.");
  console.error("Install Deno, or set DENO_BIN to the deno executable path.");
  process.exit(1);
}

for (const entrypoint of functionEntrypoints) {
  const result = spawnSync(denoBin, ["check", entrypoint], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
