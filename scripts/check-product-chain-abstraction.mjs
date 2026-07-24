import { readdirSync, readFileSync, statSync } from "node:fs";

const registryPath = "src/config/productChains.ts";
const registry = readFileSync(registryPath, "utf8");
for (const expected of [
  'id: 4663',
  'hexId: "0x1237"',
  'id: 46630',
  'hexId: "0xb626"',
  "selectProductChainForRuntime",
  "return robinhoodChain",
  "return robinhoodTestnetChain",
  'productionRpcPolicy: "backend_secret_required"',
]) {
  if (!registry.includes(expected)) throw new Error("Chain registry missing: " + expected);
}

function walk(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path + "/" + entry.name) : [path + "/" + entry.name]
  );
}

const duplicates = walk("src")
  .filter((path) => /\.(ts|tsx)$/.test(path) && path !== registryPath)
  .flatMap((path) => {
    const hits = readFileSync(path, "utf8").match(/\b(?:4663|46630)\b|0x(?:1237|b626)\b/gi);
    return hits ? hits.map((hit) => path + ": " + hit) : [];
  });
if (duplicates.length) throw new Error("Chain facts duplicated outside registry: " + duplicates.join(", "));
console.log("Robinhood chain abstraction passed.");
