import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const requestedStart = process.argv[2] ?? "";
const allTests = Object.keys(packageJson.scripts)
  .filter((name) => name.startsWith("test:") && name !== "test:all")
  .sort();
const startIndex = requestedStart ? allTests.indexOf(requestedStart) : 0;
if (requestedStart && startIndex < 0) {
  throw new Error(`Unknown test script: ${requestedStart}`);
}
const tests = allTests.slice(startIndex);

for (const name of tests) {
  console.log(`\n=== ${name} ===`);
  const command = process.platform === "win32"
    ? (process.env.ComSpec ?? "cmd.exe")
    : "npm";
  const args = process.platform === "win32"
    ? ["/d", "/s", "/c", `npm run ${name}`]
    : ["run", name];
  const result = spawnSync(command, args, {
    stdio: "inherit",
    windowsHide: true,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`\nAll ${tests.length} selected Kyra test scripts passed.`);