import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const propertiesPath = path.join(root, "data", "properties.json");
const sourcesPath = path.join(root, "data", "sources.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isHttpsUrl(value) {
  return typeof value === "string" && value.startsWith("https://");
}

const properties = readJson(propertiesPath);
const sources = readJson(sourcesPath);

assert(Array.isArray(properties), "data/properties.json must be an array.");
assert(Array.isArray(sources), "data/sources.json must be an array.");
assert(properties.length > 0, "data/properties.json must contain at least one listing.");
assert(sources.length > 0, "data/sources.json must contain at least one source.");

const sourceIds = new Set(sources.map((source) => source.id));

for (const source of sources) {
  assert(source.id, "Each source must have id.");
  assert(source.name, `Source ${source.id} must have name.`);
  assert(isHttpsUrl(source.url), `Source ${source.id} must have an https url.`);
}

for (const item of properties) {
  assert(item.id, "Each listing must have id.");
  assert(item.title, `Listing ${item.id} must have title.`);
  assert(item.source, `Listing ${item.id} must have source.`);
  assert(item.sourceId, `Listing ${item.id} must have sourceId.`);
  assert(sourceIds.has(item.sourceId), `Listing ${item.id} has unknown sourceId: ${item.sourceId}.`);
  assert(item.address, `Listing ${item.id} must have address.`);
  assert(item.area, `Listing ${item.id} must have area.`);
  assert(item.areaGroup, `Listing ${item.id} must have areaGroup.`);
  assert(item.type, `Listing ${item.id} must have type.`);
  assert(Number.isFinite(Number(item.rent)), `Listing ${item.id} must have numeric rent.`);
  assert(Number.isFinite(Number(item.layout)), `Listing ${item.id} must have numeric layout.`);
  assert(Number.isFinite(Number(item.walk)), `Listing ${item.id} must have numeric walk.`);
  assert(isHttpsUrl(item.listingUrl), `Listing ${item.id} must have an https listingUrl.`);
  assert(isHttpsUrl(item.sourceUrl), `Listing ${item.id} must have an https sourceUrl.`);
  assert(Array.isArray(item.tags), `Listing ${item.id} must have tags array.`);
}

console.log(`Data validation passed: ${properties.length} listings, ${sources.length} sources.`);
