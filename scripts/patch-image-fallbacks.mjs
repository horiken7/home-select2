import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scrapePath = path.join(root, "scripts", "scrape-rentals.mjs");
const preferPath = path.join(root, "scripts", "prefer-property-images.mjs");

let scrape = await fs.readFile(scrapePath, "utf8");

const newLikelyImageUrl = `function isLikelyImageUrl(value) {
  if (!isValidHttpsUrl(value)) return false;
  const lower = value.toLowerCase();
  const badHostsOrPaths = [
    "bat.bing.com",
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "facebook.com/tr",
    "action/0",
    "pageload",
    "event=",
    "evt=",
    "pixel",
    "beacon"
  ];
  if (badHostsOrPaths.some((word) => lower.includes(word))) return false;
  if (["logo", "icon", "sprite", "banner", "loading", "loader", "blank", "noimage", "no-image", "dummy", "placeholder", "map", "ci_01"].some((word) => lower.includes(word))) return false;
  if (/\\.(jpg|jpeg|png|webp)(\\?|$)/i.test(value)) return true;
  if (lower.includes("sumai.r6.ur-net.go.jp") || lower.includes("img.able.co.jp") || lower.includes("apic.homemate.co.jp")) return true;
  return false;
}
`;

scrape = scrape.replace(/function isLikelyImageUrl\(value\) \{[\s\S]*?\n\}/, newLikelyImageUrl.trim());
await fs.writeFile(scrapePath, scrape, "utf8");

let prefer = await fs.readFile(preferPath, "utf8");

if (!prefer.includes("function isInvalidImageUrl")) {
  prefer = prefer.replace(
    `function isLocalImage(url) {
  return typeof url === "string" && url.startsWith("data/images/");
}
`,
    `function isLocalImage(url) {
  return typeof url === "string" && url.startsWith("data/images/");
}

function isInvalidImageUrl(url) {
  if (!url) return true;
  if (isLocalImage(url)) return false;
  const lower = String(url).toLowerCase();
  const trackers = [
    "bat.bing.com",
    "google-analytics.com",
    "googletagmanager.com",
    "doubleclick.net",
    "facebook.com/tr",
    "action/0",
    "pageload",
    "event=",
    "evt=",
    "pixel",
    "beacon"
  ];
  if (trackers.some((word) => lower.includes(word))) return true;
  if (!lower.startsWith("https://")) return true;
  if (/\\.(jpg|jpeg|png|webp)(\\?|$)/i.test(lower)) return false;
  if (lower.includes("sumai.r6.ur-net.go.jp") || lower.includes("img.able.co.jp") || lower.includes("apic.homemate.co.jp")) return false;
  return true;
}
`
  );
}

prefer = prefer.replace(
  `function imageScore(candidate, item) {
  if (!isHttps(candidate.url)) return -999;
  if (isClearlyPromotional(candidate)) return -999;`,
  `function imageScore(candidate, item) {
  if (!isHttps(candidate.url)) return -999;
  if (isInvalidImageUrl(candidate.url)) return -999;
  if (isClearlyPromotional(candidate)) return -999;`
);

const oldBlock = `    const bestImageUrl = await pickBestImage(context, item);
    const urScreenshotUrl = !bestImageUrl && isUrItem(item) ? await screenshotBestUrElement(context, item) : "";
    const selectedImageUrl = bestImageUrl || urScreenshotUrl;
    const currentCandidate = { url: item.imageUrl || "", alt: "", title: "", className: "", parentText: \`${item.title || ""} ${item.source || ""}\`, width: 0, height: 0 };
    const currentLooksBad = isLocalImage(item.imageUrl) ? false : isClearlyPromotional(currentCandidate);`;

const newBlock = `    const bestImageUrl = await pickBestImage(context, item);
    const bestImageIsInvalid = isInvalidImageUrl(bestImageUrl);
    const currentImageIsInvalid = isInvalidImageUrl(item.imageUrl || "");
    const needsUrFallback = isUrItem(item) && (bestImageIsInvalid || currentImageIsInvalid);
    const urScreenshotUrl = needsUrFallback ? await screenshotBestUrElement(context, item) : "";
    const selectedImageUrl = !bestImageIsInvalid ? bestImageUrl : urScreenshotUrl;
    const currentCandidate = { url: item.imageUrl || "", alt: "", title: "", className: "", parentText: \`${item.title || ""} ${item.source || ""}\`, width: 0, height: 0 };
    const currentLooksBad = isLocalImage(item.imageUrl) ? false : (currentImageIsInvalid || isClearlyPromotional(currentCandidate));`;

prefer = prefer.replace(oldBlock, newBlock);

await fs.writeFile(preferPath, prefer, "utf8");
console.log("Image filtering patched: tracking URLs are ignored and UR screenshot fallback is forced when needed.");
