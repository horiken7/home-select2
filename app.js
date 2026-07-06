const targetSites = [
  {
    id: "able",
    name: "エイブル",
    description: "シニア・高齢者相談可の一般賃貸を確認する導線。",
    url: "https://www.able.co.jp/list/?p=3&prefkey=fukuoka&contentMode=senior&e=401007&e=403001&e=403010&e=403011&t=0&t=F&n=9&cf=&ct=&m=4&m=5&m=6&m=7&m=8&m=9&sf=0&st=0&b=1&b=2&b=3&h=99&j=&jks=0"
  },
  {
    id: "athome",
    name: "アットホーム",
    description: "高齢者向け・高齢者相談可テーマの賃貸検索。",
    url: "https://www.athome.co.jp/chintai/theme/koreisha/fukuoka/list/"
  },
  {
    id: "f-takken",
    name: "ふれんず",
    description: "福岡県宅建協会系の高齢者相談可物件検索。",
    url: "https://www.f-takken.com/freins/featured/kourei/rent/houses/area/items?currentTabIndex=0&listtype=houses&lang=ja&location=area&locate%5B%5D=40131&locate%5B%5D=40132&locate%5B%5D=40133&locate%5B%5D=40134&locate%5B%5D=40135&locate%5B%5D=40136&locate%5B%5D=40137&locate%5B%5D=40217&locate%5B%5D=40218&locate%5B%5D=40219&locate%5B%5D=40220&locate%5B%5D=40221&locate%5B%5D=40231&locate%5B%5D=40343&order1=pl&limit=20&data_493g=1&data_21=0&data_22=10.0&data_171=1&data_173=1&data_174=1&data_175=1&data_176=1&data_177=1"
  },
  {
    id: "homemate",
    name: "ホームメイト",
    description: "高齢者入居可の福岡市賃貸検索。",
    url: "https://www.homemate.co.jp/kt_57/pr-fukuoka/fukuoka-city/?pb=10&pb=11&pb=12&pb=13&pb=7&pb=9&so=10&ye=10"
  },
  {
    id: "ur",
    name: "UR賃貸住宅",
    description: "保証人不要、礼金・仲介手数料なしの公的賃貸候補。",
    url: "https://www.ur-net.go.jp/chintai/kyushu/fukuoka/result/?area=01&skcs=133&skcs=131&skcs=134&skcs=137&skcs=136&rent_low=&rent_high=&walk=&floorspace_low=&floorspace_high=&years=&tdfk=40&todofuken=fukuoka"
  }
];

const mockListings = [
  {
    title: "エイブル 高齢者相談可・西区2LDK候補",
    source: "エイブル",
    status: "検索導線 / 詳細URLは実装時に取得",
    address: "福岡市西区を中心に検索",
    area: "福岡市西区",
    areaGroup: "priority",
    type: "private",
    rent: 10,
    rentLabel: "10万円以下で検索",
    layout: 2,
    layoutLabel: "2LDK以上",
    walk: 15,
    walkLabel: "徒歩15分以内を重視",
    score: 94,
    tags: ["高齢者相談可", "一般賃貸", "西区優先", "リンク付き"],
    note: "画像、物件名、住所、ボタンのすべてから検索結果へ移動できます。",
    listingUrl: targetSites[0].url,
    sourceUrl: targetSites[0].url
  },
  {
    title: "UR 福岡市 公的賃貸候補",
    source: "UR賃貸住宅",
    status: "制度面A / 空室は要確認",
    address: "福岡市西区・早良区・城南区ほか",
    area: "福岡市内",
    areaGroup: "fukuoka_city",
    type: "public",
    rent: 10,
    rentLabel: "団地・部屋ごとに確認",
    layout: 2,
    layoutLabel: "2LDK以上を検索",
    walk: 999,
    walkLabel: "物件ごとに確認",
    score: 92,
    tags: ["UR", "保証人不要", "初期費用重視", "リンク付き"],
    note: "定年後の一時住まいでは、礼金・仲介手数料・更新料なしの制度面を評価できます。",
    listingUrl: targetSites[4].url,
    sourceUrl: targetSites[4].url
  },
  {
    title: "ふれんず 高齢者相談可・福岡都市圏候補",
    source: "ふれんず",
    status: "高齢者相談可 / 条件確認",
    address: "福岡市7区＋糸島市・春日市・大野城市ほか",
    area: "福岡市周辺",
    areaGroup: "suburb",
    type: "private",
    rent: 10,
    rentLabel: "10万円以下で検索",
    layout: 2,
    layoutLabel: "2LDK以上",
    walk: 999,
    walkLabel: "バス利用も含める",
    score: 88,
    tags: ["高齢者相談可", "地域密着", "周辺市町村", "リンク付き"],
    note: "福岡市周辺まで広げると、家賃と広さのバランスが取りやすくなります。",
    listingUrl: targetSites[2].url,
    sourceUrl: targetSites[2].url
  },
  {
    title: "ホームメイト 高齢者入居可・福岡市候補",
    source: "ホームメイト",
    status: "高齢者入居可 / 一般賃貸",
    address: "福岡市内の高齢者入居可物件",
    area: "福岡市内",
    areaGroup: "fukuoka_city",
    type: "private",
    rent: 12,
    rentLabel: "12万円以下まで確認",
    layout: 2,
    layoutLabel: "2LDK以上",
    walk: 20,
    walkLabel: "徒歩20分以内まで確認",
    score: 82,
    tags: ["高齢者入居可", "一般賃貸", "要家賃確認", "リンク付き"],
    note: "候補が少ない場合、家賃上限と徒歩条件を少し広げる候補です。",
    listingUrl: targetSites[3].url,
    sourceUrl: targetSites[3].url
  },
  {
    title: "アットホーム 高齢者向け賃貸検索",
    source: "アットホーム",
    status: "高齢者向けテーマ検索",
    address: "福岡県内の高齢者向け賃貸テーマ",
    area: "福岡県全域",
    areaGroup: "suburb",
    type: "private",
    rent: 10,
    rentLabel: "物件ごとに確認",
    layout: 2,
    layoutLabel: "2LDK以上を確認",
    walk: 999,
    walkLabel: "物件ごとに確認",
    score: 78,
    tags: ["高齢者向け", "広域検索", "条件要確認", "リンク付き"],
    note: "広域検索の入口として使い、良い候補があれば福岡市内へ絞ります。",
    listingUrl: targetSites[1].url,
    sourceUrl: targetSites[1].url
  }
];

const qs = (selector) => document.querySelector(selector);
const filters = {
  area: qs("#areaFilter"),
  rent: qs("#rentFilter"),
  layout: qs("#layoutFilter"),
  walk: qs("#walkFilter"),
  type: qs("#typeFilter"),
  priority: qs("#priorityFilter")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function link(url, className, html, label) {
  return `<a class="${className}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(label)}">${html}</a>`;
}

function badgeClass(tag) {
  if (["UR", "保証人不要", "高齢者相談可", "高齢者入居可", "初期費用重視"].includes(tag)) return "green";
  if (["条件要確認", "要家賃確認", "検索導線"].includes(tag)) return "orange";
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

function matches(item, filter) {
  if (filter.area === "priority" && item.areaGroup !== "priority") return false;
  if (filter.area === "fukuoka_city" && !["priority", "fukuoka_city"].includes(item.areaGroup)) return false;
  if (filter.area === "suburb" && item.areaGroup !== "suburb") return false;
  if (filter.type !== "all" && item.type !== filter.type) return false;
  if (item.rent > filter.rent) return false;
  if (item.layout < filter.layout) return false;
  if (filter.walk < 999 && item.walk > filter.walk) return false;
  return true;
}

function scoreByPriority(item, priority) {
  let score = item.score;
  if (priority === "senior" && item.tags.some((tag) => tag.includes("高齢者"))) score += 8;
  if (priority === "initialCost" && item.tags.includes("初期費用重視")) score += 10;
  if (priority === "access" && item.walk <= 15) score += 8;
  return Math.min(score, 100);
}

function renderCards() {
  const filter = getFilterValues();
  const cards = mockListings
    .filter((item) => matches(item, filter))
    .map((item) => ({ ...item, displayScore: scoreByPriority(item, filter.priority) }))
    .sort((a, b) => b.displayScore - a.displayScore);

  qs("#visibleCount").textContent = cards.length;
  qs("#priorityArea").textContent = cards[0]?.area || "-";

  const container = qs("#cards");
  if (!cards.length) {
    container.innerHTML = `<div class="empty">条件に合う候補がありません。家賃上限、駅徒歩、エリア条件を少し広げてください。</div>`;
    return;
  }

  container.innerHTML = cards.map((item, index) => {
    const classes = ["property-card", index === 0 ? "best" : "", item.type === "public" ? "public" : "", item.tags.includes("条件要確認") ? "needs-check" : ""].join(" ").trim();
    const image = `<span class="mock-room"></span><span class="mock-window"></span><span class="mock-floor"></span>`;
    return `
      <article class="${classes}">
        ${link(item.listingUrl, "card-image", image, `${item.title}を開く`)}
        <div class="card-body">
          <div class="card-top">
            <div>
              <p class="status">${escapeHtml(item.status)}</p>
              <h3 class="card-title">${link(item.listingUrl, "", escapeHtml(item.title), `${item.title}を開く`)}</h3>
              ${link(item.listingUrl, "address-link", escapeHtml(item.address), `${item.address}を開く`)}
            </div>
            <div class="score">${item.displayScore}</div>
          </div>
          <div class="badges">
            ${item.tags.map((tag) => `<span class="badge ${badgeClass(tag)}">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="specs">
            <div class="spec"><span>エリア</span><strong>${escapeHtml(item.area)}</strong></div>
            <div class="spec"><span>間取り</span><strong>${escapeHtml(item.layoutLabel)}</strong></div>
            <div class="spec"><span>家賃</span><strong>${escapeHtml(item.rentLabel)}</strong></div>
            <div class="spec"><span>駅徒歩</span><strong>${escapeHtml(item.walkLabel)}</strong></div>
          </div>
          <p class="note">${escapeHtml(item.note)}</p>
          <div class="card-actions">
            ${link(item.listingUrl, "open-link", "リンク先で確認", `${item.title}を開く`)}
            ${link(item.sourceUrl, "source-link", `${escapeHtml(item.source)}を開く`, `${item.source}を開く`)}
          </div>
        </div>
      </article>`;
  }).join("");
}

function renderSources() {
  qs("#sourceCount").textContent = targetSites.length;
  qs("#sourceLinks").innerHTML = targetSites.map((site) => `
    <article class="source-card">
      <h3>${escapeHtml(site.name)}</h3>
      <p>${escapeHtml(site.description)}</p>
      ${link(site.url, "source-link", "公式検索を開く", `${site.name}を開く`)}
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

renderCards();
renderSources();
