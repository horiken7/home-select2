import fs from "node:fs/promises";
import path from "node:path";

const scrapePath = path.join(process.cwd(), "scripts", "scrape-rentals.mjs");
let source = await fs.readFile(scrapePath, "utf8");

const newParseElevator = [
  "function parseElevator(text) {",
  "  const normalized = normalizeText(text)",
  "    .replace(/[：:]/g, ' ')",
  "    .replace(/[○◎◯]/g, ' 有 ')",
  "    .replace(/[×✕]/g, ' 無 ');",
  "",
  "  const negativePatterns = [",
  "    /(?:エレベーター|エレベータ|EV|エレベータ設備)\\s*(?:なし|無し|無|ない|ナシ|非対応|未設置|設置なし|－|-)/i,",
  "    /(?:なし|無し|無|ない|ナシ|非対応|未設置|設置なし|－|-)\\s*(?:エレベーター|エレベータ|EV)/i,",
  "    /(?:エレベーター|エレベータ|EV)[^。、,]{0,12}(?:なし|無し|無|ない|ナシ|非対応|未設置|設置なし|－|-)/i",
  "  ];",
  "  if (negativePatterns.some((pattern) => pattern.test(normalized))) return 'エレベーターなし';",
  "",
  "  const positivePatterns = [",
  "    /(?:エレベーター|エレベータ|EV)\\s*(?:あり|有|付き|付|設置|完備|対応)/i,",
  "    /(?:あり|有|付き|付|設置|完備|対応)\\s*(?:エレベーター|エレベータ|EV)/i,",
  "    /(?:エレベーター|エレベータ|EV)[^。、,]{0,12}(?:あり|有|付き|付|設置|完備|対応)/i,",
  "    /(?:設備|共用設備|建物設備)[^。、,]{0,40}(?:エレベーター|エレベータ|EV)/i",
  "  ];",
  "  if (positivePatterns.some((pattern) => pattern.test(normalized))) return 'エレベーターあり';",
  "",
  "  return 'EV要確認';",
  "}"
].join("\n");

source = source.replace(/function parseElevator\(text\) \{[\s\S]*?\n\}/, newParseElevator);

const newCollectDetailData = [
  "async function collectDetailData(context, listingUrl) {",
  "  if (!isValidHttpsUrl(listingUrl) || listingUrl.endsWith('#') || listingUrl.includes('/company/')) return { text: '', imageUrl: '' };",
  "  const detailPage = await context.newPage();",
  "  try {",
  "    await detailPage.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: DETAIL_TIMEOUT_MS });",
  "    await detailPage.waitForTimeout(1500);",
  "    const bodyText = await safeText(detailPage.locator('body'));",
  "    const attributeText = await detailPage.evaluate(() => {",
  "      const keywords = /(エレベーター|エレベータ|EV|設備|共用設備|建物設備|アイコン|有|無|あり|なし|無し|設置|完備)/i;",
  "      const parts = [];",
  "      const attrs = ['alt', 'title', 'aria-label', 'class', 'id', 'data-name', 'data-label'];",
  "      document.querySelectorAll('img, [alt], [title], [aria-label], table, dl, ul, li, section, div').forEach((el) => {",
  "        const attrText = attrs.map((attr) => el.getAttribute?.(attr) || '').join(' ');",
  "        const ownText = el.innerText || el.textContent || '';",
  "        const combined = `${attrText} ${ownText}`.replace(/\\s+/g, ' ').trim();",
  "        if (combined && keywords.test(combined)) parts.push(combined.slice(0, 600));",
  "      });",
  "      return parts.slice(0, 120).join(' ');",
  "    }).catch(() => '');",
  "    const text = truncate(`${bodyText} ${attributeText}`, 7000);",
  "    const imageUrl = await collectPageImageUrl(detailPage, detailPage.url());",
  "    return { text, imageUrl };",
  "  } catch {",
  "    return { text: '', imageUrl: '' };",
  "  } finally {",
  "    await detailPage.close().catch(() => {});",
  "  }",
  "}"
].join("\n");

source = source.replace(/async function collectDetailData\(context, listingUrl\) \{[\s\S]*?\n\}/, newCollectDetailData);

await fs.writeFile(scrapePath, source, "utf8");
console.log("Elevator detection patched: detail page attributes and equipment areas are used.");
