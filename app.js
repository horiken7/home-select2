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
    state.listings = Array.isArray(properties) ? properties.filter(isDisplayableListing) : [];
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
  if (["UR", "保証人不要", "高齢者相談可", "高齢者入居可", "高齢者入居可・相談可", "個別物件リンク", "初期費用重視", "画像取得"].includes(tag)) return "green";
  if (["条件要確認", "要家賃確認", "検索導線", "リンク要確認", "間取り要確認", "画像要確認"].includes(tag)) return "orange";
  if (["取得失敗", "条件外"].includes(tag)) return "red";
  return "";
}

function isBadListingUrl(url) {
  if (!url) return true;
  if (!String(url).startsWith("https://")) return true;
  if (String(url).endsWith("#")) return true;
  if (String(url).includes("/company/")) return true;
  return false;
}

function isUsableImageUrl(url) {
  if (!url) return false;
  if (!String(url).startsWith("https://")) return false;
  return true;
}

function isSameUrl(a, b) {
  if (!a || !b) return false;
  return String(a).replace(/#$/, "") === String(b).replace(/#$/, "");
}

function isDisplayableListing(item) {
  const title = String(item?.title || "");
  if (!item) return false;
  if (Number(item.layout) < 2) return false;
  if (title.includes("会社紹介")) return false;
  if (title.includes("店舗紹介")) return false;
  if (isBadListingUrl(item.listingUrl) && isBadListingUrl(item.sourceUrl)) return false;
  return true;
}

function shorten(value, max = 34) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function displayTitle(item) {
  const rawTitle = String(item.title || "").replace(/\s+/g, " ").trim();
  const genericTitle = ["部屋詳細", "詳細を見る", "物件詳細"].includes(rawTitle);
  const noisyTitle = rawTitle.includes("画像") || rawTitle.includes("閲覧回数") || rawTitle.includes("物件の詳細を見る");
  const priceFirstTitle = /^\d+(?:\.\d+)?万円/.test(rawTitle);

  if (genericTitle || noisyTitle || priceFirstTitle) {
    const area = item.area && item.area !== "福岡県全域" ? item.area : item.source || "候補";
    return shorten(`${area} ${item.layoutLabel || "間取り要確認"} / ${item.rentLabel || "家賃要確認"}`, 38);
  }

  return shorten(
    rawTitle
      .replace(/\s*物件の詳細を見る\s*/g, " ")
      .replace(/\s*詳細を見る\s*/g, " ")
      .replace(/\s*賃貸マンション\s*/g, " ")
      .trim(),
    38
  );
}

function getUrls(item) {
  const listingUrl = !isBadListingUrl(item.listingUrl) ? item.listingUrl : "";
  const sourceUrl = !isBadListingUrl(item.sourceUrl) ? item.sourceUrl : "";
  const hasDistinctDetail = listingUrl && sourceUrl && !isSameUrl(listingUrl, sourceUrl) && item.matchStatus !== "source_link";
  const preferredLink = hasDistinctDetail ? listingUrl : sourceUrl || listingUrl || "";

  return {
    detailUrl: hasDistinctDetail ? listingUrl : "",
    searchUrl: sourceUrl || listingUrl || "",
    cardLinkUrl: preferredLink
  };
}

function getAccuracy(item, detailUrl, searchUrl) {
  const hasDetail = Boolean(detailUrl);
  const hasRent = Number(item.rent) !== 999;
  const hasWalk = Number(item.walk) !== 999;
  const hasArea = item.area && item.area !== "福岡県全域";
  const hasImage = isUsableImageUrl(item.imageUrl);
  const sourceOnly = !hasDetail || item.matchStatus === "source_link" || isSameUrl(detailUrl, searchUrl);

  if (hasDetail && hasRent && hasArea && hasWalk && hasImage) {
    return { label: "高", className: "high", hint: "個別リンク・画像・家賃・住所・徒歩情報を取得" };
  }
  if (hasDetail && hasRent && hasArea) {
    return { label: "中", className: "medium", hint: "個別リンク・家賃・住所を取得。画像や徒歩などは要確認" };
  }
  if (sourceOnly) {
    return { label: "要確認", className: "check", hint: "検索結果ページへの導線。詳細はリンク先で確認" };
  }
  return { label: "中", className: "medium", hint: "一部項目は自動抽出。必ずリンク先で確認" };
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

function isUnknownValue(value) {
  return Number(value) === 999 || Number.isNaN(Number(value));
}

function matches(item, filter) {
  const rent = Number(item.rent);
  const walk = Number(item.walk);

  if (!matchesArea(item, filter.area)) return false;
  if (filter.type !== "all" && item.type !== filter.type) return false;
  if (!isUnknownValue(rent) && rent > filter.rent) return false;
  if (Number(item.layout) < filter.layout) return false;
  if (filter.walk < 999 && !isUnknownValue(walk) && walk > filter.walk) return false;
  return true;
}

function scoreByPriority(item, priority) {
  let score = Number(item.score) || 0;
  const tags = Array.isArray(item.tags) ? item.tags : [];

  if (priority === "initialCost" && (tags.includes("初期費用重視") || item.type === "public")) score += 10;
  if (priority === "access" && Number(item.walk) <= 15) score += 8;
  if (priority === "public" && item.type === "public") score += 12;

  return Math.min(score, 100);
}

function getEligibilityTags(item) {
  if (item.type === "public" || item.sourceId === "ur") return ["UR・公的賃貸"];
  return ["高齢者入居可・相談可"];
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

function renderImageMarkup(item, cardTitle) {
  if (isUsableImageUrl(item.imageUrl)) {
    return `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(cardTitle)}" loading="lazy" onerror="this.closest('.card-image').classList.add('image-failed'); this.remove();" />`;
  }

  return `<span class="mock-room"></span><span class="mock-window"></span><span class="mock-floor"></span><span class="image-placeholder-text">画像要確認</span>`;
}

function renderCard(item, index) {
  const tags = Array.from(new Set([...getEligibilityTags(item), ...(Array.isArray(item.tags) ? item.tags : [])]));
  const { detailUrl, searchUrl, cardLinkUrl } = getUrls(item);
  const accuracy = getAccuracy(item, detailUrl, searchUrl);
  const cardTitle = displayTitle(item);
  const classes = [
    "property-card",
    index === 0 ? "best" : "",
    item.type === "public" ? "public" : "",
    accuracy.className === "check" ? "needs-check" : ""
  ].join(" ").trim();
  const imageMarkup = renderImageMarkup(item, cardTitle);
  const imageLink = cardLinkUrl
    ? `<a class="card-image ${isUsableImageUrl(item.imageUrl) ? 'has-real-image' : 'has-placeholder'}" data-source="${escapeAttr(item.source)}" href="${escapeAttr(cardLinkUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(cardTitle)}を開く">${imageMarkup}</a>`
    : `<div class="card-image has-placeholder" data-source="リンク要確認">${imageMarkup}</div>`;

  const detailButton = detailUrl
    ? textLink(detailUrl, "open-link", "物件詳細を開く", `${cardTitle}の物件詳細を開く`)
    : `<span class="open-link disabled">物件詳細なし</span>`;
  const searchButton = textLink(searchUrl, "source-link", "検索結果を開く", `${item.source || "取得元"}の検索結果を開く`);

  return `
    <article class="${classes}">
      ${imageLink}
      <div class="card-body">
        <div class="card-top">
          <div class="card-main">
            <p class="status">${escapeHtml(item.status || item.matchStatus || "候補")}</p>
            <h3 class="card-title">${textLink(cardLinkUrl, "", cardTitle, `${cardTitle}を開く`)}</h3>
            <p class="original-title">元タイトル：${escapeHtml(shorten(item.title, 56))}</p>
          </div>
          <div class="score" title="条件一致度を100点満点で評価した暫定スコアです">
            <span class="score-label">おすすめ度</span>
            <strong class="score-value">${item.displayScore}</strong>
            <span class="score-unit">/100</span>
          </div>
        </div>

        <div class="key-facts">
          <div class="key-fact rent"><span>家賃</span><strong>${escapeHtml(item.rentLabel)}</strong></div>
          <div class="key-fact layout"><span>間取り</span><strong>${escapeHtml(item.layoutLabel)}</strong></div>
        </div>

        <div class="address-box">
          <span>住所・エリア</span>
          ${textLink(cardLinkUrl, "address-link", item.address || item.area || "住所要確認", `${item.address || item.area || "住所"}を開く`)}
        </div>

        <div class="meta-row">
          <span class="accuracy accuracy-${accuracy.className}" title="${escapeAttr(accuracy.hint)}">取得精度：${escapeHtml(accuracy.label)}</span>
          <span class="walk-chip">駅徒歩：${escapeHtml(item.walkLabel)}</span>
        </div>

        <div class="badges">
          ${tags.map((tag) => `<span class="badge ${badgeClass(tag)}">${escapeHtml(tag)}</span>`).join("")}
        </div>

        <p class="note">${escapeHtml(item.note)}</p>
        <div class="card-actions">
          ${detailButton}
          ${searchButton}
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
