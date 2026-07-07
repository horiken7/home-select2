import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const propertiesPath = path.join(root, "data", "properties.json");

function normalizeUrl(url) {
  return String(url || "").replace(/#$/, "");
}

function isBadUrl(url) {
  if (!url || typeof url !== "string") return true;
  if (!url.startsWith("https://")) return true;
  if (url.endsWith("#")) return true;
  if (url.includes("/company/")) return true;
  return false;
}

function isUr(item) {
  return item?.sourceId === "ur" || String(item?.source || "").includes("UR");
}

function hasAnyValidUrl(item) {
  return !isBadUrl(item?.listingUrl) || !isBadUrl(item?.sourceUrl);
}

function hasConcreteDetailUrl(item) {
  if (isBadUrl(item?.listingUrl)) return false;
  if (isBadUrl(item?.sourceUrl)) return false;
  if (normalizeUrl(item.listingUrl) === normalizeUrl(item.sourceUrl)) return false;
  if (item.matchStatus === "source_link") return false;
  return true;
}

function isDisplayable(item) {
  const title = String(item?.title || "");
  if (!item) return false;
  if (Number(item.layout || 2) < 2) return false;
  if (title.includes("会社紹介")) return false;
  if (title.includes("店舗紹介")) return false;
  if (isUr(item)) return hasAnyValidUrl(item);
  if (!hasConcreteDetailUrl(item)) return false;
  return true;
}

function fixUrls(item) {
  const tags = Array.from(new Set([...(item.tags || []).filter((tag) => tag !== "リンク要確認" && tag !== "検索導線"), "個別物件リンク"]));
  if (isUr(item)) {
    return {
      ...item,
      type: "public",
      matchStatus: hasConcreteDetailUrl(item) ? "detail_link" : "ur_link",
      tags: Array.from(new Set([...tags, "UR", "UR・公的賃貸"]))
    };
  }
  return {
    ...item,
    matchStatus: "detail_link",
    tags
  };
}

const raw = JSON.parse(await fs.readFile(propertiesPath, "utf8"));
const cleaned = raw
  .filter(isDisplayable)
  .map(fixUrls)
  .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

await fs.writeFile(propertiesPath, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");
console.log(`Cleaned rental data with UR kept: ${raw.length} -> ${cleaned.length}`);
