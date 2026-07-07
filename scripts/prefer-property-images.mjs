import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const propertiesPath = path.join(root, "data", "properties.json");
const TIMEOUT_MS = 15000;
const MAX_ITEMS = 50;

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

function isUrItem(item) {
  return item?.sourceId === "ur" || String(item?.source || "").includes("UR");
}

function getUrCodes(item) {
  const text = `${item?.listingUrl || ""} ${item?.sourceUrl || ""}`;
  return Array.from(text.matchAll(/90_[0-9]{4}/g)).map((match) => match[0]);
}

function imageText(candidate) {
  return `${candidate.url} ${candidate.alt} ${candidate.title} ${candidate.className} ${candidate.parentText}`.toLowerCase();
}

function isClearlyPromotional(candidate) {
  const text = imageText(candidate);
  const badWords = [
    "logo", "icon", "sprite", "banner", "bnr", "campaign", "advert", "mainvisual", "main-visual", "ogp", "sns",
    "twitter", "facebook", "loading", "loader", "blank", "noimage", "no-image", "dummy", "placeholder", "map", "staff",
    "brand", "ci_01", "yuruyaka", "kurashi", "tsunagaru", "de-a-ru", "ur-de-a-ru", "person", "people", "model", "talent", "cast"
  ];
  return badWords.some((word) => text.includes(word));
}

function propertyContextScore(candidate, item) {
  const text = imageText(candidate);
  let score = 0;
  if (["間取り", "madori", "floorplan", "floor-plan", "floor_plan", "layout", "plan", "roomplan"].some((word) => text.includes(word.toLowerCase()))) score += 260;
  if (["外観", "gaikan", "building", "exterior", "建物"].some((word) => text.includes(word.toLowerCase()))) score += 220;
  if (["室内", "内観", "living", "kitchen", "bath", "toilet", "room", "interior", "photo", "gallery", "設備"].some((word) => text.includes(word.toLowerCase()))) score += 160;

  if (isUrItem(item)) {
    const codes = getUrCodes(item);
    if (codes.some((code) => text.includes(code.toLowerCase()))) score += 180;
    if (candidate.url.includes("ur-net.go.jp")) score += 60;
    if (candidate.url.includes("90_")) score += 80;
    if (candidate.url.toLowerCase().includes("jkss")) score += 60;
  }

  return score;
}

function imageScore(candidate, item) {
  if (!isHttps(candidate.url)) return -999;
  if (isClearlyPromotional(candidate)) return -999;

  let score = 20 + propertyContextScore(candidate, item);

  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(candidate.url)) score += 30;
  if (candidate.width >= 400 || candidate.height >= 300) score += 35;
  if (candidate.width >= 800 || candidate.height >= 600) score += 45;
  if (candidate.width <= 120 && candidate.height <= 120) score -= 120;

  if (isUrItem(item) && candidate.url.includes("ur-net.go.jp")) score += 80;

  return score;
}

async function collectCandidates(page) {
  return page.evaluate(() => {
    const items = [];
    const add = (url, element, hint = "") => {
      if (!url) return;
      const parent = element?.closest?.("figure, article, li, div, section, table, dl") || element?.parentElement || document.body;
      const grandParent = parent?.parentElement || document.body;
      items.push({
        url,
        alt: element?.getAttribute?.("alt") || "",
        title: element?.getAttribute?.("title") || "",
        className: `${element?.className || ""} ${parent?.className || ""} ${grandParent?.className || ""} ${hint}`,
        parentText: `${parent?.innerText || ""} ${grandParent?.innerText || ""} ${hint}`.slice(0, 500),
        width: Number(element?.getAttribute?.("width") || element?.naturalWidth || 0),
        height: Number(element?.getAttribute?.("height") || element?.naturalHeight || 0)
      });
    };

    const imageAttrs = ["src", "data-src", "data-original", "data-lazy", "data-main", "data-large", "data-image", "data-url", "data-img", "data-full", "data-file", "data-path"];
    document.querySelectorAll("img").forEach((img) => {
      imageAttrs.forEach((attr) => add(img.getAttribute(attr), img, attr));
      const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
      srcset.split(",").forEach((entry) => add(entry.trim().split(/\s+/)[0], img, "srcset"));
    });

    document.querySelectorAll("source[srcset]").forEach((source) => {
      const img = source.closest("picture")?.querySelector("img") || source;
      source.getAttribute("srcset").split(",").forEach((entry) => add(entry.trim().split(/\s+/)[0], img, "source"));
    });

    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(href)) add(href, a, "image-link");
    });

    document.querySelectorAll("[style*='background-image']").forEach((el) => {
      const match = String(el.getAttribute("style") || "").match(/url\(['"]?([^'")]+)['"]?\)/i);
      if (match) add(match[1], el, "background-image");
    });

    const html = document.documentElement.outerHTML;
    Array.from(html.matchAll(/["'(:=]\s*([^"'()<>\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'()<>\s]*)?)/gi)).forEach((match) => add(match[1], document.body, "html-url"));
    Array.from(html.matchAll(/(?:src|data-src|data-original|data-url|image|img|photo|madori|layout)["']?\s*[:=]\s*["']([^"']+)["']/gi)).forEach((match) => add(match[1], document.body, "html-attr"));

    document.querySelectorAll("noscript").forEach((node) => {
      const noscriptHtml = node.textContent || "";
      Array.from(noscriptHtml.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)).forEach((match) => add(match[1], node, "noscript"));
    });

    return items;
  });
}

function getExtraUrUrls(item) {
  if (!isUrItem(item)) return [];
  const urls = [];
  const listing = String(item.listingUrl || "");
  if (listing.includes("_room.html")) {
    urls.push(listing.replace(/_room\.html.*$/, ".html"));
  }
  return urls.filter(Boolean);
}

async function collectFromUrl(context, item, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2500);
    const rawCandidates = await collectCandidates(page);
    return rawCandidates
      .map((candidate) => ({ ...candidate, url: absoluteUrl(candidate.url, page.url()) }))
      .filter((candidate) => isHttps(candidate.url));
  } catch {
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

async function pickBestImage(context, item) {
  if (!isHttps(item.listingUrl)) return "";
  const urls = Array.from(new Set([item.listingUrl, ...getExtraUrUrls(item)]));
  const allCandidates = [];

  for (const url of urls) {
    allCandidates.push(...await collectFromUrl(context, item, url));
  }

  const ranked = allCandidates
    .map((candidate) => ({ ...candidate, score: imageScore(candidate, item) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.url || "";
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
    const currentCandidate = { url: item.imageUrl || "", alt: "", title: "", className: "", parentText: `${item.title || ""} ${item.source || ""}`, width: 0, height: 0 };
    const currentLooksBad = isClearlyPromotional(currentCandidate);

    if (bestImageUrl && bestImageUrl !== item.imageUrl) {
      updated.push({
        ...item,
        imageUrl: bestImageUrl,
        imagePriority: "property_photo_or_floorplan",
        imageNote: "建物外観・室内・間取り画像を優先して再選択"
      });
      changed += 1;
    } else {
      updated.push({
        ...item,
        imageUrl: currentLooksBad ? "" : item.imageUrl,
        imagePriority: currentLooksBad ? "removed_non_property_image" : item.imagePriority || "unchanged",
        imageNote: currentLooksBad ? "物件と無関係な広告・ブランド画像を除外" : item.imageNote
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
