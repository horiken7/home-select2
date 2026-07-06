import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const propertiesPath = path.join(root, "data", "properties.json");

function isBadUrl(url) {
  if (!url || typeof url !== "string") return true;
  if (!url.startsWith("https://")) return true;
  if (url.endsWith("#")) return true;
  if (url.includes("/company/")) return true;
  return false;
}

function isDisplayable(item) {
  const title = String(item?.title || "");
  if (!item) return false;
  if (Number(item.layout) < 2) return false;
  if (title.includes("会社紹介")) return false;
  if (title.includes("店舗紹介")) return false;
  if (isBadUrl(item.listingUrl) && isBadUrl(item.sourceUrl)) return false;
  return true;
}

function fixUrls(item) {
  const cleaned = { ...item };
  if (isBadUrl(cleaned.listingUrl) && !isBadUrl(cleaned.sourceUrl)) {
    cleaned.listingUrl = cleaned.sourceUrl;
    cleaned.matchStatus = "source_link";
    cleaned.status = cleaned.status || "条件要確認 / 公式検索導線";
    cleaned.tags = Array.from(new Set([...(cleaned.tags || []), "リンク要確認"]));
  }
  return cleaned;
}

const raw = JSON.parse(await fs.readFile(propertiesPath, "utf8"));
const cleaned = raw
  .filter(isDisplayable)
  .map(fixUrls)
  .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

await fs.writeFile(propertiesPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
console.log(`Cleaned rental data: ${raw.length} -> ${cleaned.length}`);
