import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const dataDir = path.join(root, "data");
const sourcesPath = path.join(dataDir, "sources.json");
const propertiesPath = path.join(dataDir, "properties.json");
const diagnosticsPath = path.join(dataDir, "scrape-diagnostics.json");

const DEFAULT_TIMEOUT_MS = 30000;
const DETAIL_TIMEOUT_MS = 15000;
const MAX_TEXT_LENGTH = 260;
const MAX_DETAIL_FETCHES_PER_SOURCE = 50;
const MAX_CARDS_PER_SOURCE = 50;
const MAX_OUTPUT_ITEMS = 50;

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function truncate(value, length = MAX_TEXT_LENGTH) {
  const text = normalizeText(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";
  const first = String(value).split(",")[0].trim().split(" ")[0].replace(/^['"]|['"]$/g, "");
  if (!first || first.startsWith("data:") || first.startsWith("blob:") || first.startsWith("mailto:") || first.startsWith("tel:")) return "";
  try {
    return new URL(first, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeUrl(url) {
  return String(url || "").replace(/#$/, "");
}

function isValidHttpsUrl(value) {
  return typeof value === "string" && value.startsWith("https://");
}

function isLikelyImageUrl(value) {
  if (!isValidHttpsUrl(value)) return false;
  const lower = value.toLowerCase();
  if (["logo", "icon", "sprite", "banner", "loading", "loader", "blank", "noimage", "no-image", "dummy", "placeholder", "map", "ci_01"].some((word) => lower.includes(word))) return false;
  return true;
}

function isSearchOrNonDetailUrl(url, source) {
  const lower = String(url || "").toLowerCase();
  const sourceUrl = normalizeUrl(source.url).toLowerCase();
  if (!isValidHttpsUrl(url)) return true;
  if (normalizeUrl(lower) === sourceUrl) return true;
  if (lower.endsWith("#")) return true;
  if (lower.includes("/company/") || lower.includes("/shop/") || lower.includes("/contact") || lower.includes("/inquiry")) return true;
  if (lower.includes("/list/") || lower.includes("/result/") || lower.includes("/search/") || lower.includes("/theme/")) return true;
  if (lower.includes("contentmode=senior") || lower.includes("currenttabindex=") || lower.includes("listtype=")) return true;
  if (lower.includes("/kt_57/") || lower.includes("/featured/kourei/")) return true;
  return false;
}

function detailUrlScore(url, text, source) {
  if (isSearchOrNonDetailUrl(url, source)) return -999;
  const lower = url.toLowerCase();
  const label = normalizeText(text);
  let score = 20;
  if (label.includes("詳細")) score += 35;
  if (label.includes("物件")) score += 20;
  if (label.includes("部屋")) score += 12;
  if (/\d{5,}/.test(lower)) score += 8;
  if (source.id === "homemate" && /\/dtl-/i.test(url)) score += 140;
  if (source.id === "ur" && /\/\d{2}_\d{4}(_room)?\.html/i.test(url)) score += 140;
  if (source.id === "athome" && /\/chintai\/\d+/i.test(lower)) score += 140;
  if (source.id === "able" && /(\/detail\/|detail\.do|\/chintai\/detail\/|bk=|\/senior\/detail\/|\/chintai\/.+\/[a-z0-9_-]*\d{5,})/i.test(lower)) score += 140;
  if (source.id === "f-takken" && /(\/detail|\/bukken\/|\/property\/|\/rent\/houses\/.+\/[0-9]+|\/items\/[0-9]+)/i.test(lower)) score += 140;
  if (lower.includes("detail")) score += 30;
  if (lower.includes("room")) score += 12;
  return score;
}

function parseRent(text) {
  const normalized = normalizeText(text).replace(/,/g, "");
  const candidates = [
    /(?:賃料|家賃|月額賃料|月額)\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?)\s*万円/,
    /([0-9]+(?:\.[0-9]+)?)\s*万円/
  ];
  for (const pattern of candidates) {
    const match = normalized.match(pattern);
    if (match) return Number(match[1]);
  }
  const yen = normalized.match(/(?:賃料|家賃|月額賃料|月額)?\s*[:：]?\s*([0-9]{5,6})\s*円/);
  if (yen) return Math.round(Number(yen[1]) / 10000 * 10) / 10;
  return 999;
}

function parseWalk(text) {
  const normalized = normalizeText(text);
  const patterns = [
    /(?:徒歩|歩)\s*([0-9]+)\s*分/,
    /駅\s*徒歩\s*([0-9]+)\s*分/,
    /バス\s*([0-9]+)\s*分\s*徒歩\s*([0-9]+)\s*分/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (match[2]) return Number(match[1]) + Number(match[2]);
    return Number(match[1]);
  }
  return 999;
}

function parseLayout(text) {
  const normalized = normalizeText(text).toUpperCase();
  const match = normalized.match(/([1-5])\s*(?:S)?(?:LDK|DK|K)/);
  if (!match) return { rank: 2, label: "2LDK以上 / 要確認", flexible: true };
  const roomCount = Number(match[1]);
  const labelMatch = normalized.match(/[1-5]\s*(?:S)?(?:LDK|DK|K)/);
  return { rank: roomCount, label: labelMatch ? labelMatch[0].replace(/\s+/g, "") : `${roomCount}部屋以上`, flexible: false };
}

function parseFloor(text) {
  const normalized = normalizeText(text);
  const patterns = [
    /([地下B]?[0-9]+)\s*階\s*\/\s*([0-9]+)\s*階建/,
    /([地下B]?[0-9]+)\s*階\s*部分/,
    /所在階\s*[:：]?\s*([地下B]?[0-9]+)\s*階(?:\s*\/\s*([0-9]+)\s*階建)?/,
    /階数\s*[:：]?\s*([地下B]?[0-9]+)\s*階/,
    /\s([地下B]?[0-9]+)\s*階\s+[1-5]\s*(?:S)?(?:LDK|DK|K)/i
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (match[2]) return `${match[1]}階 / ${match[2]}階建`;
    return `${match[1]}階`;
  }
  return "階数要確認";
}

function parseElevator(text) {
  const normalized = normalizeText(text);
  if (/エレベーター\s*(なし|無)|EV\s*(なし|無)|エレベータ\s*(なし|無)|エレベーター無|エレベータ無/i.test(normalized)) return "エレベーターなし";
  if (/エレベーター|エレベータ|EV有|EVあり|EV付き/i.test(normalized)) return "エレベーターあり";
  return "EV要確認";
}

function extractSpecialNotes(text, source, context) {
  const normalized = normalizeText(text);
  const notes = [];
  const push = (note) => { if (note && !notes.includes(note)) notes.push(note); };
  if (source.id === "ur") push("UR・公的賃貸候補");
  else push("高齢者入居可・相談可の検索結果から取得");
  const keywords = ["保証人不要", "礼金なし", "敷金なし", "仲介手数料なし", "更新料なし", "角部屋", "南向き", "オートロック", "バス・トイレ別", "追い焚き", "浴室乾燥", "宅配ボックス", "駐車場", "駐輪場", "ペット相談", "二人入居可", "即入居可", "新着", "都市ガス", "インターネット無料"];
  keywords.forEach((keyword) => { if (normalized.includes(keyword)) push(keyword); });
  if (context.rent === 999) push("家賃はリンク先で確認");
  if (context.walk === 999) push("駅徒歩はリンク先で確認");
  if (context.floorLabel === "階数要確認") push("階数はリンク先で確認");
  if (context.elevatorLabel === "EV要確認") push("エレベーターはリンク先で確認");
  if (context.parsedLayout?.flexible) push("間取りはリンク先で確認");
  push("空室・入居審査はリンク先で確認");
  return notes.slice(0, 6);
}

function areaGroupFromArea(area) {
  if (["福岡市西区", "福岡市早良区", "福岡市城南区"].includes(area)) return "priority";
  if (String(area).startsWith("福岡市") || area === "福岡市内") return "fukuoka_city";
  return "suburb";
}

function areaFromText(text) {
  const areaRules = ["福岡市西区", "福岡市早良区", "福岡市城南区", "福岡市中央区", "福岡市博多区", "福岡市東区", "福岡市南区", "糸島市", "春日市", "大野城市", "那珂川市", "古賀市", "新宮町", "粕屋町", "志免町", "太宰府市", "宇美町"];
  return areaRules.find((area) => text.includes(area)) || "福岡県全域";
}

function scoreListing(item) {
  let score = 50;
  if (item.areaGroup === "priority") score += 30;
  if (item.areaGroup === "fukuoka_city") score += 18;
  if (item.type === "public") score += 16;
  if (item.tags?.some((tag) => tag.includes("高齢者"))) score += 12;
  if (Number(item.rent) <= 10) score += 8;
  if (Number(item.walk) <= 15) score += 8;
  if (item.elevatorLabel === "エレベーターあり") score += 4;
  if (item.floorLabel && item.floorLabel !== "階数要確認") score += 2;
  if (item.listingUrl && item.listingUrl !== item.sourceUrl) score += 4;
  if (item.imageUrl) score += 2;
  return Math.min(score, 100);
}

function makeFallbackSourceLink(source) {
  const area = source.id === "ur" ? "福岡市内" : source.id === "f-takken" ? "福岡市周辺" : "福岡県全域";
  const type = source.id === "ur" ? "public" : "private";
  const tags = source.id === "ur" ? ["UR", "保証人不要", "初期費用重視", "検索導線", "階数要確認", "EV要確認"] : ["高齢者相談可", "検索導線", "条件要確認", "画像要確認", "階数要確認", "EV要確認"];
  const item = {
    id: `${source.id}-source-link`, title: `${source.name} 公式検索`, source: source.name, sourceId: source.id,
    status: "検索導線 / 実物件はリンク先で確認", address: source.description, area, areaGroup: areaGroupFromArea(area), type,
    rent: source.id === "homemate" ? 12 : 10, rentLabel: source.id === "homemate" ? "12万円以下まで確認" : "10万円以下で検索",
    layout: 2, layoutLabel: "2LDK以上を確認", walk: 999, walkLabel: "物件ごとに確認", floorLabel: "階数要確認", elevatorLabel: "EV要確認",
    specialNotes: ["個別物件リンクを取得できなかったため候補カードには表示しません"], score: source.id === "ur" ? 92 : 76,
    tags, note: "個別物件リンクを取得できなかったため、検索導線として保持しています。候補カードには表示しません。", listingUrl: source.url, sourceUrl: source.url, imageUrl: "", matchStatus: "source_link"
  };
  item.score = scoreListing(item);
  return item;
}

async function safeText(locator) {
  try { return normalizeText(await locator.innerText({ timeout: 1200 })); } catch { return ""; }
}

async function pickDetailLink(node, source) {
  const anchors = node.locator("a[href]");
  const count = Math.min(await anchors.count().catch(() => 0), 30);
  let best = { url: "", text: "", score: -999, locator: null };
  for (let i = 0; i < count; i += 1) {
    const anchor = anchors.nth(i);
    const href = await anchor.getAttribute("href").catch(() => null);
    const url = absoluteUrl(href, source.url);
    const text = await safeText(anchor);
    const score = detailUrlScore(url, text, source);
    if (score > best.score) best = { url, text, score, locator: anchor };
  }
  return best.score >= 45 ? best : { url: "", text: "", score: best.score, locator: null };
}

async function collectImageUrl(node, baseUrl) {
  const imageCandidates = ["img", "source[srcset]", "[data-bg]", "[data-background]", "[style*=background-image]"];
  for (const selector of imageCandidates) {
    const target = node.locator(selector).first();
    const count = await target.count().catch(() => 0);
    if (!count) continue;
    const attrs = ["src", "data-src", "data-original", "data-lazy", "data-srcset", "srcset", "data-bg", "data-background"];
    for (const attr of attrs) {
      const value = await target.getAttribute(attr).catch(() => null);
      const absolute = absoluteUrl(value, baseUrl);
      if (isLikelyImageUrl(absolute)) return absolute;
    }
    const style = await target.getAttribute("style").catch(() => null);
    const match = style?.match(/url\(['"]?([^'")]+)['"]?\)/i);
    const styleUrl = absoluteUrl(match?.[1], baseUrl);
    if (isLikelyImageUrl(styleUrl)) return styleUrl;
  }
  return "";
}

async function collectPageImageUrl(page, baseUrl) {
  const metaSelectors = ['meta[property="og:image"]', 'meta[property="og:image:secure_url"]', 'meta[name="twitter:image"]', 'link[rel="image_src"]'];
  for (const selector of metaSelectors) {
    const loc = page.locator(selector).first();
    const count = await loc.count().catch(() => 0);
    if (!count) continue;
    const value = await loc.getAttribute("content").catch(() => null) || await loc.getAttribute("href").catch(() => null);
    const absolute = absoluteUrl(value, baseUrl);
    if (isLikelyImageUrl(absolute)) return absolute;
  }
  return collectImageUrl(page.locator("body"), baseUrl);
}

async function collectDetailData(context, listingUrl) {
  if (!isValidHttpsUrl(listingUrl) || listingUrl.endsWith("#") || listingUrl.includes("/company/")) return { text: "", imageUrl: "" };
  const detailPage = await context.newPage();
  try {
    await detailPage.goto(listingUrl, { waitUntil: "domcontentloaded", timeout: DETAIL_TIMEOUT_MS });
    await detailPage.waitForTimeout(1500);
    const bodyText = truncate(await safeText(detailPage.locator("body")), 3500);
    const imageUrl = await collectPageImageUrl(detailPage, detailPage.url());
    return { text: bodyText, imageUrl };
  } catch {
    return { text: "", imageUrl: "" };
  } finally {
    await detailPage.close().catch(() => {});
  }
}

async function collectCandidateCards(page, source) {
  const locators = ["article", "li", ".cassetteitem", ".property-card", ".mod-mergeBuilding", ".box", ".item", "[class*=property]", "[class*=bukken]", "[class*=room]"];
  for (const selector of locators) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count >= 3) {
      const items = [];
      const max = Math.min(count, MAX_CARDS_PER_SOURCE);
      let detailFetches = 0;
      for (let i = 0; i < max; i += 1) {
        const node = page.locator(selector).nth(i);
        const listText = truncate(await safeText(node), 900);
        if (listText.length < 30) continue;
        const detailLink = await pickDetailLink(node, source);
        const listingUrl = detailLink.url;
        if (!listingUrl) continue;

        let detailData = { text: "", imageUrl: "" };
        if (detailFetches < MAX_DETAIL_FETCHES_PER_SOURCE) {
          detailFetches += 1;
          detailData = await collectDetailData(page.context(), listingUrl);
        }
        const imageUrl = detailData.imageUrl || await collectImageUrl(node, source.url);
        const combinedText = `${listText} ${detailData.text}`;
        const titleCandidate = detailLink.text || await safeText(detailLink.locator || node.locator("a[href]").first());
        const title = truncate(titleCandidate || combinedText.split(" ").slice(0, 8).join(" "), 60);
        const area = areaFromText(combinedText);
        const parsedLayout = parseLayout(combinedText);
        const rent = parseRent(combinedText);
        const walk = parseWalk(combinedText);
        const floorLabel = parseFloor(combinedText);
        const elevatorLabel = parseElevator(combinedText);
        const specialNotes = extractSpecialNotes(combinedText, source, { rent, walk, parsedLayout, imageUrl, listingUrl, floorLabel, elevatorLabel });
        const tags = [source.name, "個別物件リンク", imageUrl ? "画像取得" : "画像要確認", parsedLayout.flexible ? "間取り要確認" : "", floorLabel === "階数要確認" ? "階数要確認" : "", elevatorLabel].filter(Boolean);
        if (source.id === "ur") tags.push("UR", "保証人不要");
        if (["able", "f-takken", "homemate"].includes(source.id)) tags.push("高齢者相談可");
        const item = {
          id: `${source.id}-${i + 1}-${Math.abs(hashCode(title + listingUrl))}`,
          title, source: source.name, sourceId: source.id, status: "個別物件リンク取得 / 条件要確認", address: area, area, areaGroup: areaGroupFromArea(area), type: source.id === "ur" ? "public" : "private",
          rent, rentLabel: rent === 999 ? "家賃要確認" : `${rent}万円目安`, layout: parsedLayout.rank, layoutLabel: parsedLayout.label,
          walk, walkLabel: walk === 999 ? "徒歩要確認" : `徒歩${walk}分目安`, floorLabel, elevatorLabel, specialNotes, score: 0, tags,
          note: "Playwrightで自動抽出した候補です。家賃、間取り、空室、入居審査は必ずリンク先で確認してください。", listingUrl, sourceUrl: source.url, imageUrl, matchStatus: "detail_link"
        };
        item.score = scoreListing(item);
        items.push(item);
      }
      if (items.length) return dedupe(items);
    }
  }
  return [];
}

function hashCode(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.listingUrl || `${item.title}-${item.address}-${item.rentLabel}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapeSource(page, source) {
  const startedAt = new Date().toISOString();
  try {
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: DEFAULT_TIMEOUT_MS });
    await page.waitForTimeout(2500);
    const title = await page.title().catch(() => "");
    const items = await collectCandidateCards(page, source);
    const outputItems = items.length ? items : [makeFallbackSourceLink(source)];
    return { ok: true, sourceId: source.id, sourceName: source.name, url: source.url, title, startedAt, finishedAt: new Date().toISOString(), itemCount: outputItems.length, detailCount: outputItems.filter((item) => item.matchStatus === "detail_link").length, imageCount: outputItems.filter((item) => Boolean(item.imageUrl)).length, items: outputItems };
  } catch (error) {
    return { ok: false, sourceId: source.id, sourceName: source.name, url: source.url, startedAt, finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), itemCount: 1, detailCount: 0, imageCount: 0, items: [makeFallbackSourceLink(source)] };
  }
}

async function main() {
  const sources = JSON.parse(await fs.readFile(sourcesPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ja-JP", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" });
  const diagnostics = { generatedAt: new Date().toISOString(), sources: [] };
  const allItems = [];
  for (const source of sources) {
    const page = await context.newPage();
    const result = await scrapeSource(page, source);
    diagnostics.sources.push({ ok: result.ok, sourceId: result.sourceId, sourceName: result.sourceName, url: result.url, title: result.title || "", startedAt: result.startedAt, finishedAt: result.finishedAt, itemCount: result.itemCount, detailCount: result.detailCount || 0, imageCount: result.imageCount || 0, error: result.error || null });
    allItems.push(...result.items);
    await page.close().catch(() => {});
  }
  await browser.close();
  const sorted = dedupe(allItems).sort((a, b) => Number(b.score) - Number(a.score)).slice(0, MAX_OUTPUT_ITEMS);
  await fs.writeFile(propertiesPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  await fs.writeFile(diagnosticsPath, `${JSON.stringify({ ...diagnostics, itemCount: sorted.length, detailCount: sorted.filter((item) => item.matchStatus === "detail_link").length, imageCount: sorted.filter((item) => Boolean(item.imageUrl)).length }, null, 2)}\n`, "utf8");
  console.log(`Scraped ${sorted.length} listing/search records from ${sources.length} sources.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
