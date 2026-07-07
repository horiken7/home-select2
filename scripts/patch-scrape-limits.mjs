import fs from "node:fs/promises";
import path from "node:path";

const scrapePath = path.join(process.cwd(), "scripts", "scrape-rentals.mjs");
let source = await fs.readFile(scrapePath, "utf8");

const replacements = [
  ["const MAX_OUTPUT_ITEMS = 50;", "const MAX_OUTPUT_ITEMS = 200;"],
  ["const MAX_OUTPUT_ITEMS = 100;", "const MAX_OUTPUT_ITEMS = 200;"]
];

for (const [from, to] of replacements) {
  source = source.replace(from, to);
}

await fs.writeFile(scrapePath, source, "utf8");
console.log("Scrape output limit patched to 200 items for this run.");
