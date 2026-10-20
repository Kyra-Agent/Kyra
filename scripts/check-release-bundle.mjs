// Run right before a production deploy of a local `dist` build. Netlify
// injects the release variables (chain target, mainnet window, controlled
// submission) only when it runs the build itself; a plain local build leaves
// them out and silently ships the site with wallet signing turned off.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const assetsDir = join("dist", "assets");
const required = [
  "VITE_KYRA_CHAIN_RELEASE_TARGET",
  "VITE_KYRA_ROBINHOOD_MAINNET_WINDOW",
  "VITE_KYRA_ROBINHOOD_MAINNET_RELEASE",
];

let entry;

try {
  entry = readdirSync(assetsDir).find((name) => /^index-.*\.js$/.test(name));
} catch {
  entry = undefined;
}

if (!entry) {
  console.error("No dist/assets/index-*.js found. Build first.");
  process.exit(1);
}

const bundle = readFileSync(join(assetsDir, entry), "utf8");
const missing = required.filter((key) => !new RegExp(`${key}:\`[^\`]+\``).test(bundle));

if (missing.length) {
  console.error(
    `This build is missing Netlify release variables: ${missing.join(", ")}.\n` +
      "Deploy with `netlify deploy --prod` so Netlify builds with the site variables, " +
      "or load them into the shell before `npm run build:robinhood-mainnet`.",
  );
  process.exit(1);
}

console.log(`Release bundle ${entry} carries the Netlify release variables.`);
