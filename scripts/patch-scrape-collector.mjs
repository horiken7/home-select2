import fs from "node:fs/promises";
import path from "node:path";

const scrapePath = path.join(process.cwd(), "scripts", "scrape-rentals.mjs");
let source = await fs.readFile(scrapePath, "utf8");

source = source
  .replace("const MAX_CARDS_PER_SOURCE = 50;", "const MAX_CARDS_PER_SOURCE = 100;")
  .replace("const MAX_OUTPUT_ITEMS = 50;", "const MAX_OUTPUT_ITEMS = 200;");

const newCollector = `async function collectCandidateCards(page, source) {
  const locators = [
    ".cassetteitem",
    ".property-card",
    ".mod-mergeBuilding",
    "[class*=property]",
    "[class*=bukken]",
    "[class*=room]",
    "article",
    "li",
    ".box",
    ".item",
    "tr"
  ];
  const items = [];
  const seenUrls = new Set();
  let detailFetches = 0;

  for (const selector of locators) {
    const count = await page.locator(selector).count().catch(() => 0);
    if (!count) continue;

    const max = Math.min(count, MAX_CARDS_PER_SOURCE);
    for (let i = 0; i < max; i += 1) {
      if (items.length >= MAX_CARDS_PER_SOURCE) break;
      const node = page.locator(selector).nth(i);
      const listText = truncate(await safeText(node), 1200);
      if (listText.length < 25) continue;

      const detailLink = await pickDetailLink(node, source);
      const listingUrl = detailLink.url;
      if (!listingUrl || seenUrls.has(listingUrl)) continue;
      seenUrls.add(listingUrl);

      let detailData = { text: "", imageUrl: "" };
      if (detailFetches < MAX_DETAIL_FETCHES_PER_SOURCE) {
        detailFetches += 1;
        detailData = await collectDetailData(page.context(), listingUrl);
      }

      const imageUrl = detailData.imageUrl || await collectImageUrl(node, source.url);
      const combinedText = \`\${listText} \${detailData.text}\`;
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
        id: \`\${source.id}-\${items.length + 1}-\${Math.abs(hashCode(title + listingUrl))}\`,
        title,
        source: source.name,
        sourceId: source.id,
        status: "個別物件リンク取得 / 条件要確認",
        address: area,
        area,
        areaGroup: areaGroupFromArea(area),
        type: ["ur", "nicety"].includes(source.id) ? "public" : "private",
        rent,
        rentLabel: rent === 999 ? "家賃要確認" : \`\${rent}万円目安\`,
        layout: parsedLayout.rank,
        layoutLabel: parsedLayout.label,
        walk,
        walkLabel: walk === 999 ? "徒歩要確認" : \`徒歩\${walk}分目安\`,
        floorLabel,
        elevatorLabel,
        specialNotes,
        score: 0,
        tags,
        note: "Playwrightで自動抽出した候補です。家賃、間取り、空室、入居審査は必ずリンク先で確認してください。",
        listingUrl,
        sourceUrl: source.url,
        imageUrl,
        matchStatus: "detail_link"
      };
      item.score = scoreListing(item);
      items.push(item);
    }
  }

  return dedupe(items);
}
`;

const pattern = /async function collectCandidateCards\(page, source\) \{[\s\S]*?\n\}\n\nfunction hashCode/;
if (!pattern.test(source)) {
  throw new Error("collectCandidateCards function was not found for patching.");
}

source = source.replace(pattern, `${newCollector}\nfunction hashCode`);
await fs.writeFile(scrapePath, source, "utf8");
console.log("Scrape collector patched to scan all candidate selectors before dedupe.");
