(function () {
  const MAX_VISIBLE_NEWS = 5;
  let expanded = false;

  function htmlEscape(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function dateLabel(value) {
    if (!value) return '';
    if (typeof formatDateTime === 'function') return formatDateTime(value);
    return String(value);
  }

  function noticeLink(url, title, source) {
    const safeTitle = htmlEscape(title);
    if (!url) return `<span>${safeTitle}</span>`;
    return `<a href="${htmlEscape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${htmlEscape(source)}の新着情報を開く">${safeTitle}</a>`;
  }

  function getNotices() {
    if (typeof state === 'undefined') return [];
    return Array.isArray(state.sourceUpdates?.notices) ? state.sourceUpdates.notices : [];
  }

  function renderLimitedSiteNews() {
    const list = document.querySelector('#siteNewsList');
    const count = document.querySelector('#siteNewsCount');
    if (!list || !count) return;

    const notices = getNotices();
    count.textContent = `${notices.length}件`;

    if (!notices.length) {
      list.innerHTML = '<p class="muted">各検索サイトの新着情報はありません。</p>';
      return;
    }

    const shown = expanded ? notices : notices.slice(0, MAX_VISIBLE_NEWS);
    const itemsHtml = shown.map((notice) => {
      const title = notice.title || '更新情報';
      const source = notice.sourceName || notice.source || '対象サイト';
      const detectedAt = notice.detectedAt ? `<span>${htmlEscape(dateLabel(notice.detectedAt))}</span>` : '';
      const summary = notice.summary ? `<p class="site-news-summary">${htmlEscape(notice.summary)}</p>` : '';

      return `
        <article class="site-news-item">
          ${noticeLink(notice.url || '', title, source)}
          <div class="site-news-meta">
            <span class="site-news-source">${htmlEscape(source)}</span>
            ${detectedAt}
          </div>
          ${summary}
        </article>`;
    }).join('');

    const rest = Math.max(0, notices.length - MAX_VISIBLE_NEWS);
    const buttonHtml = notices.length > MAX_VISIBLE_NEWS
      ? `<button id="siteNewsMoreButton" type="button" class="site-news-more-button">${expanded ? '折りたたむ' : `さらに表示（残り${rest}件）`}</button>`
      : '';

    list.innerHTML = `${itemsHtml}${buttonHtml}`;

    const button = document.querySelector('#siteNewsMoreButton');
    if (button) {
      button.addEventListener('click', () => {
        expanded = !expanded;
        renderLimitedSiteNews();
      });
    }
  }

  const originalRenderUpdates = typeof renderUpdates === 'function' ? renderUpdates : null;
  if (originalRenderUpdates) {
    renderUpdates = function patchedRenderUpdates() {
      originalRenderUpdates();
      renderLimitedSiteNews();
    };
  }

  window.addEventListener('load', () => {
    setTimeout(renderLimitedSiteNews, 0);
  });
})();
