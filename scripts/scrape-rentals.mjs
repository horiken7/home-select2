import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const dataDir = path.join(root, "data");
const sourcesPath = path.join(dataDir, "sources.json");
const propertiesPath = path.join(dataDir, "properties.json");
const diagnosticsPath = path.join(dataDir, "scrape-diagnostics.json");

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TEXT_LENGTH = 260;

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, length = MAX_TEXT_LENGTH) {
  const text = normalizeText(value);
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function isValidHttpsUrl(value) {
  return typeof value === "string" && value.startsWith("https://");
}

function parseRent(text) {
  const normalized = normalizeText(text).replace(/,/g, "");
  const man = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*万円/);
  if (man) return Number(man[1]);
  const yen = normalized.match(/([0-9]{5,6})\s*円/);
  if (yen) return Math.round(Number(yen[1]) / 10000 * 10) / 10;
  return 999;
}

function parseWalk(text) {
  const normalized = normalizeText(text);
  const walk = normalized.match(/(?:徒歩|歩)\s*([0-9]+)\s*分/);
  if (walk) return Number(walk[1]);
  return 999;
}

function parseLayout(text) {
  const normalized = normalizeText(text).toUpperCase();
  const match = normalized.match(/([1-5])\s*(?:S)?(?:LDK|DK|K)/);
  if (!match) return { rank: 2, label: "2LDK以上 / 要確認", flexible: true };
  const roomCount = Number(match[1]);
  const labelMatch = normalized.match(/[1-5]\s*(?:S)?(?:LDK|DK|K)/);
  return {
    rank: roomCount,
    label: labelMatch ? labelMatch[0].replace(/\s+/g, "") : `${roomCount}部屋以上`,
    flexible: false
  };
}

function areaGroupFromArea(area) {
  if (["福岡市西区", "福岡市早良区", "福岡市城南区"].includes(area)) return "priority";
  if (String(area).startsWith("福岡市") || area === "福岡市内") return "fukuoka_city";
  return "suburb";
}

function areaFromText(text) {
  const areaRules = [
    "福岡市西区",
    "福岡市早良区",
    "福岡市城南区",
    "福岡市中央区",
    "福岡市博多区",
    "福岡市東区",
    "福岡市南区",
    "糸島市",
    "春日市",
    "大野城市",
    "那珂川市",
    "古賀市",
    "新宮町",
    "粕屋町",
    "志免町",
    "太宰府市",
    "宇美町"
  ];
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
  if (item.listingUrl && item.listingUrl !== item.sourceUrl) score += 4;
  return Math.min(score, 100);
}

function makeFallbackSourceLink(source) {
  const area = source.id === "ur" ? "福岡市内" : source.id === "f-takken" ? "福岡市周辺" : "福岡県全域";
  const type = source.id === "ur" ? "public" : "private";
  const tags = source.id === "ur"
    ? ["UR", "保証人不要", "初期費用重視", "検索導線"]
    : ["高齢者相談可", "検索導線", "条件要確認"];

  const item = {
    id: `${source.id}-source-link`,
    title: `${source.name} 公式検索`,
    source: source.name,
    sourceId: source.id,
    status: "検索導線 / 実物件はリンク先で確認",
    address: source.description,
    area,
    areaGroup: areaGroupFromArea(area),
    type,
    rent: source.id === "homemate" ? 12 : 10,
    rentLabel: source.id === "homemate" ? "12万円以下まで確認" : "10万円以下で検索",
    layout: 2,
    layoutLabel: "2LDK以上を確認",
    walk: 999,
    walkLabel: "物件ごとに確認",
    score: source.id === "ur" ? 92 : 76,
    tags,
    note: "詳細URLを取得できない場合の公式検索導線です。画像、物件名、住所、ボタンはすべてリンク付きです。",
    listingUrl: source.url,
    sourceUrl: source.url,
    matchStatus: "source_link"
  };
  item.score = scoreListing(item);
  return item;
}

async function safeText(locator) {
  try {
    return normalizeText(await locator.innerText({ timeout: 1200 }));
  } catch {
    return "";
  }
}

async function collectCandidateCards(page, source) {
  const locators = [
    "article",
    "li",
    ".cassetteitem",
    ".property-card",
    ".mod-mergeBuilding",
    ".box",
    ".item",
    "[class*=property]",
    "[class*=bukken]",
    "[class*=room]"
  ];

  for (const selector of locators) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (count >= 3) {
      const items = [];
      const max = Math.min(count, 12);
      for (let i = 0; i < max; i += 1) {
        const node = page.locator(selector).nth(i);
        const text = truncate(await safeText(node), 520);
        if (text.length < 30) continue;

        const linkHandle = node.locator("a[href]").first();
        const href = await linkHandle.getAttribute("href").catch(() => null);
        const listingUrl = href ? new URL(href, source.url).toString() : source.url;
        if (!isValidHttpsUrl(listingUrl)) continue;

        const titleCandidate = await safeText(linkHandle);
        const title = truncate(titleCandidate || text.split(" ").slice(0, 8).join(" "), 60);
        const area = areaFromText(text);
        const parsedLayout = parseLayout(text);
        const rent = parseRent(text);
        const walk = parseWalk(text);
        const tags = [source.name, listingUrl === source.url ? "リンク要確認" : "取得リンク", parsedLayout.flexible ? "間取り要確認" : ""]
          .filter(Boolean);
        if (source.id === "ur") tags.push("UR", "保証人不要");
        if (["able", "f-takken", "homemate"].includes(source.id)) tags.push("高齢者相談可");

        const item = {
          id: `${source.id}-${i + 1}-${Math.abs(hashCode(title + listingUrl))}`,
          title,
          source: source.name,
          sourceId: source.id,
          status: listingUrl === source.url ? "条件要確認 / 公式検索導線" : "自動取得候補 / 条件要確認",
          address: area,
          area,
          areaGroup: areaGroupFromArea(area),
          type: source.id === "ur" ? "public" : "private",
          rent,
          rentLabel: rent === 999 ? "家賃要確認" : `${rent}万円目安`,
          layout: parsedLayout.rank,
          layoutLabel: parsedLayout.label,
          walk,
          walkLabel: walk === 999 ? "徒歩要確認" : `徒歩${walk}分目安`,
          score: 0,
          tags,
          note: "Playwrightで自動抽出した候補です。家賃、間取り、空室、入居審査は必ずリンク先で確認してください。",
          listingUrl,
          sourceUrl: source.url,
          matchStatus: listingUrl === source.url ? "source_link" : "needs_check"
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

    return {
      ok: true,
      sourceId: source.id,
      sourceName: source.name,
      url: source.url,
      title,
      startedAt,
      finishedAt: new Date().toISOString(),
      itemCount: outputItems.length,
      items: outputItems
    };
  } catch (error) {
    return {
      ok: false,
      sourceId: source.id,
      sourceName: source.name,
      url: source.url,
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      itemCount: 1,
      items: [makeFallbackSourceLink(source)]
    };
  }
}

async function main() {
  const sources = JSON.parse(await fs.readFile(sourcesPath, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "ja-JP",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  });

  const diagnostics = {
    generatedAt: new Date().toISOString(),
    sources: []
  };
  const allItems = [];

  for (const source of sources) {
    const page = await context.newPage();
    const result = await scrapeSource(page, source);
    diagnostics.sources.push({
      ok: result.ok,
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      url: result.url,
      title: result.title || "",
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      itemCount: result.itemCount,
      error: result.error || null
    });
    allItems.push(...result.items);
    await page.close().catch(() => {});
  }

  await browser.close();

  const sorted = dedupe(allItems)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 40);

  await fs.writeFile(propertiesPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  await fs.writeFile(diagnosticsPath, `${JSON.stringify({ ...diagnostics, itemCount: sorted.length }, null, 2)}\n`, "utf8");

  console.log(`Scraped ${sorted.length} listing/search records from ${sources.length} sources.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
