import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const propertiesPath = path.join(root, "data", "properties.json");
const TIMEOUT_MS = 15000;
const MAX_ITEMS = 50;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";
  const first = String(value)
    .split(",")[0]
    .trim()
    .split(" ")[0]
    .replace(/^['"]|['"]$/g, "");
  if (!first || first.startsWith("data:") || first.startsWith("blob:") || first.startsWith("mailto:") || first.startsWith("tel:")) return "";
  try {
    return new URL(first, baseUrl).toString();
  } catch {
    return "";
  }
}

function isHttps(url) {
  return typeof url === "string" && url.startsWith("https://");
}

function looksLikeBadImage(url, context = "") {
  const text = `${url} ${context}`.toLowerCase();
  const badWords = [
    "logo", "icon", "sprite", "banner", "bnr", "campaign", "ad_", "advert", "cm_", "mainvisual", "mv_",
    "ogp", "sns", "twitter", "facebook", "loading", "loader", "blank", "noimage", "no-image", "dummy",
    "placeholder", "map", "staff", "person", "people", "model", "talent", "cast", "campaign", "brand", "ci_01"
  ];
  return badWords.some((word) => text.includes(word));
}

function imageScore(candidate) {
  const text = `${candidate.url} ${candidate.alt} ${candidate.title} ${candidate.className} ${candidate.parentText}`.toLowerCase();
  if (!isHttps(candidate.url)) return -999;
  if (looksLikeBadImage(candidate.url, text)) return -250;

  let score = 20;

  const floorPlanWords = ["間取り", "madori", "floorplan", "floor-plan", "floor_plan", "layout", "plan", "heimen", "roomplan"];
  const exteriorWords = ["外観", "gaikan", "building", "exterior", "appearance", "外装", "建物", "house", "mansion"];
  const roomWords = ["室内", "内観", "living", "kitchen", "bath", "toilet", "room", "interior", "photo", "gallery", "equipment", "設備"];

  if (floorPlanWords.some((word) => text.includes(word))) score += 260;
  if (exteriorWords.some((word) => text.includes(word))) score += 220;
  if (roomWords.some((word) => text.includes(word))) score += 160;

  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(candidate.url)) score += 30;
  if (candidate.width >= 400 || candidate.height >= 300) score += 35;
  if (candidate.width >= 800 || candidate.height >= 600) score += 45;
  if (candidate.width <= 120 && candidate.height <= 120) score -= 120;
  if (text.includes("thumb") || text.includes("thumbnail")) score -= 10;

  return score;
}

async function collectCandidates(page) {
  return page.evaluate(() => {
    const items = [];
    const add = (url, element) => {
      if (!url) return;
      const parent = element.closest("figure, article, li, div, section") || element.parentElement;
      items.push({
        url,
        alt: element.getAttribute("alt") || "",
        title: element.getAttribute("title") || "",
        className: `${element.className || ""} ${parent?.className || ""}`,
        parentText: (parent?.innerText || "").slice(0, 180),
        width: Number(element.getAttribute("width") || element.naturalWidth || 0),
        height: Number(element.getAttribute("height") || element.naturalHeight || 0)
      });
    };

    document.querySelectorAll("img").forEach((img) => {
      ["src", "data-src", "data-original", "data-lazy", "data-main", "data-large", "data-image"].forEach((attr) => add(img.getAttribute(attr), img));
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      srcset.split(",").forEach((entry) => add(entry.trim().split(/\s+/)[0], img));
    });

    document.querySelectorAll("source[srcset]").forEach((source) => {
      const img = source.closest("picture")?.querySelector("img") || source;
      source.getAttribute("srcset").split(",").forEach((entry) => add(entry.trim().split(/\s+/)[0], img));
    });

    document.querySelectorAll("[style*='background-image']").forEach((el) => {
      const match = String(el.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/i);
      if (match) add(match[1], el);
    });

    return items;
  });
}

async function pickBestImage(context, item) {
  if (!isHttps(item.listingUrl)) return "";
  const page = await context.newPage();
  try {
    await page.goto(item.listingUrl, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForTimeout(1200);
    const rawCandidates = await collectCandidates(page);
    const candidates = rawCandidates
      .map((candidate) => ({
        ...candidate,
        url: absoluteUrl(candidate.url, page.url())
      }))
      .filter((candidate) => isHttps(candidate.url));

    const ranked = candidates
      .map((candidate) => ({ ...candidate, score: imageScore(candidate) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    return ranked[0]?.url || "";
  } catch {
    return "";
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  const properties = JSON.parse(await fs.readFile(propertiesPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  });

  let changed = 0;
  const updated = [];

  for (const item of properties.slice(0, MAX_ITEMS)) {
    const bestImageUrl = await pickBestImage(context, item);
    if (bestImageUrl && bestImageUrl !== item.imageUrl) {
      updated.push({
        ...item,
        imageUrl: bestImageUrl,
        imagePriority: "property_photo_or_floorplan",
        imageNote: "建物外観・室内・間取り画像を優先して再選択"
      });
      changed += 1;
    } else {
      const currentLooksBad = looksLikeBadImage(item.imageUrl || "", `${item.title || ""} ${item.source || ""}`);
      updated.push({
        ...item,
        imageUrl: currentLooksBad ? "" : item.imageUrl,
        imagePriority: currentLooksBad ? "removed_promotional_image" : item.imagePriority || "unchanged"
      });
      if (currentLooksBad) changed += 1;
    }
  }

  if (properties.length > MAX_ITEMS) updated.push(...properties.slice(MAX_ITEMS));

  await browser.close();
  await fs.writeFile(propertiesPath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  console.log(`Updated preferred property images: ${changed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
