const state = {
  targetSites: [],
  listings: [],
  loadError: null
};

const qs = (selector) => document.querySelector(selector);
const filters = {
  area: qs("#areaFilter"),
  rent: qs("#rentFilter"),
  layout: qs("#layoutFilter"),
  walk: qs("#walkFilter"),
  type: qs("#typeFilter"),
  priority: qs("#priorityFilter")
};

async function loadJson(path) {
  const response = await fetch(`${path}?v=${Date.now()}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

async function loadData() {
  try {
    const [sources, properties] = await Promise.all([
      loadJson("data/sources.json"),
      loadJson("data/properties.json")
    ]);

    state.targetSites = Array.isArray(sources) ? sources : [];
    state.listings = Array.isArray(properties) ? properties : [];
    state.loadError = null;
  } catch (error) {
    console.error(error);
    state.targetSites = [];
    state.listings = [];
    state.loadError = "データを読み込めませんでした。GitHub Pages上で開いているか、dataフォルダのJSONを確認してください。";
  }

  renderCards();
  renderSources();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function textLink(url, className, text, label) {
  if (!url) return `<span class="${className}">${escapeHtml(text)}</span>`;
  return `<a class="${className}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(label)}">${escapeHtml(text)}</a>`;
}

function badgeClass(tag) {
  if (["UR", "保証人不要", "高齢者相談可", "高齢者入居可", "初期費用重視"].includes(tag)) return "green";
  if (["条件要確認", "要家賃確認", "検索導線", "リンク要確認"].includes(tag)) return "orange";
  if (["取得失敗", "条件外"].includes(tag)) return "red";
  return "";
}

function getFilterValues() {
  return {
    area: filters.area.value,
    rent: Number(filters.rent.value),
    layout: Number(filters.layout.value),
    walk: Number(filters.walk.value),
    type: filters.type.value,
    priority: filters.priority.value
  };
}

function matchesArea(item, area) {
  if (area === "all") return true;
  if (area === "priority") return item.areaGroup === "priority";
  if (area === "fukuoka_city") return ["priority", "fukuoka_city"].includes(item.areaGroup);
  if (area === "suburb") return item.areaGroup === "suburb";
  return true;
}

function matches(item, filter) {
  if (!matchesArea(item, filter.area)) return false;
  if (filter.type !== "all" && item.type !== filter.type) return false;
  if (Number(item.rent) > filter.rent) return false;
  if (Number(item.layout) < filter.layout) return false;
  if (filter.walk < 999 && Number(item.walk) > filter.walk) return false;
  return true;
}

function scoreByPriority(item, priority) {
  let score = Number(item.score) || 0;
  const tags = Array.isArray(item.tags) ? item.tags : [];

  if (priority === "senior" && tags.some((tag) => tag.includes("高齢者"))) score += 8;
  if (priority === "initialCost" && tags.includes("初期費用重視")) score += 10;
  if (priority === "access" && Number(item.walk) <= 15) score += 8;

  return Math.min(score, 100);
}

function renderCards() {
  const container = qs("#cards");
  if (state.loadError) {
    container.innerHTML = `<div class="empty">${escapeHtml(state.loadError)}</div>`;
    qs("#visibleCount").textContent = "0";
    qs("#priorityArea").textContent = "-";
    return;
  }

  const filter = getFilterValues();
  const cards = state.listings
    .filter((item) => matches(item, filter))
    .map((item) => ({ ...item, displayScore: scoreByPriority(item, filter.priority) }))
    .sort((a, b) => b.displayScore - a.displayScore);

  qs("#visibleCount").textContent = cards.length;
  qs("#priorityArea").textContent = cards[0]?.area || "-";

  if (!cards.length) {
    container.innerHTML = `<div class="empty">条件に合う候補がありません。家賃上限、駅徒歩、エリア条件を少し広げてください。</div>`;
    return;
  }

  container.innerHTML = cards.map((item, index) => renderCard(item, index)).join("");
}

function renderCard(item, index) {
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const listingUrl = item.listingUrl || item.sourceUrl || "";
  const sourceUrl = item.sourceUrl || item.listingUrl || "";
  const classes = [
    "property-card",
    index === 0 ? "best" : "",
    item.type === "public" ? "public" : "",
    tags.includes("条件要確認") || !listingUrl ? "needs-check" : ""
  ].join(" ").trim();
  const mockImage = `<span class="mock-room"></span><span class="mock-window"></span><span class="mock-floor"></span>`;
  const imageLink = listingUrl
    ? `<a class="card-image" data-source="${escapeAttr(item.source)}" href="${escapeAttr(listingUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(item.title)}を開く">${mockImage}</a>`
    : `<div class="card-image" data-source="リンク要確認">${mockImage}</div>`;

  return `
    <article class="${classes}">
      ${imageLink}
      <div class="card-body">
        <div class="card-top">
          <div>
            <p class="status">${escapeHtml(item.status || item.matchStatus || "候補")}</p>
            <h3 class="card-title">${textLink(listingUrl, "", item.title, `${item.title}を開く`)}</h3>
            ${textLink(listingUrl, "address-link", item.address, `${item.address}を開く`)}
          </div>
          <div class="score">${item.displayScore}</div>
        </div>
        <div class="badges">
          ${tags.map((tag) => `<span class="badge ${badgeClass(tag)}">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="specs">
          <div class="spec"><span>エリア</span><strong>${escapeHtml(item.area)}</strong></div>
          <div class="spec"><span>間取り</span><strong>${escapeHtml(item.layoutLabel)}</strong></div>
          <div class="spec"><span>家賃</span><strong>${escapeHtml(item.rentLabel)}</strong></div>
          <div class="spec"><span>駅徒歩</span><strong>${escapeHtml(item.walkLabel)}</strong></div>
        </div>
        <p class="note">${escapeHtml(item.note)}</p>
        <div class="card-actions">
          ${textLink(listingUrl, "open-link", listingUrl ? "リンク先で確認" : "リンク要確認", `${item.title}を開く`)}
          ${textLink(sourceUrl, "source-link", `${item.source || "取得元"}を開く`, `${item.source || "取得元"}を開く`)}
        </div>
      </div>
    </article>`;
}

function renderSources() {
  qs("#sourceCount").textContent = state.targetSites.length;
  const container = qs("#sourceLinks");

  if (!state.targetSites.length) {
    container.innerHTML = `<div class="empty">対象サイト情報を読み込めませんでした。</div>`;
    return;
  }

  container.innerHTML = state.targetSites.map((site) => `
    <article class="source-card">
      <h3>${escapeHtml(site.name)}</h3>
      <p>${escapeHtml(site.description)}</p>
      ${textLink(site.url, "source-link", "公式検索を開く", `${site.name}を開く`)}
    </article>
  `).join("");
}

Object.values(filters).forEach((element) => element.addEventListener("change", renderCards));
qs("#resetButton").addEventListener("click", () => {
  filters.area.value = "all";
  filters.rent.value = "10";
  filters.layout.value = "2";
  filters.walk.value = "15";
  filters.type.value = "all";
  filters.priority.value = "balanced";
  renderCards();
});

loadData();
