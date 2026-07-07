(function () {
  const DEFAULT_VISIBLE_COUNT = 5;

  function ensureStyle() {
    if (document.querySelector('#siteNewsMoreStyle')) return;
    const style = document.createElement('style');
    style.id = 'siteNewsMoreStyle';
    style.textContent = `
      .site-news-item.is-extra-hidden {
        display: none;
      }

      .site-news-more-button {
        margin-top: 12px;
        border: 1px solid rgba(37, 99, 235, .28);
        border-radius: 999px;
        padding: 10px 16px;
        background: #fff;
        color: #1d4ed8;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(37, 99, 235, .10);
      }

      .site-news-more-button:hover {
        background: #eff6ff;
      }
    `;
    document.head.appendChild(style);
  }

  function applySiteNewsLimit() {
    const list = document.querySelector('#siteNewsList');
    if (!list) return;

    ensureStyle();

    const items = Array.from(list.querySelectorAll('.site-news-item'));
    const card = list.closest('.site-news-card') || list.parentElement;
    if (!card) return;

    let button = card.querySelector('#siteNewsMoreButton');

    if (items.length <= DEFAULT_VISIBLE_COUNT) {
      items.forEach((item) => item.classList.remove('is-extra-hidden'));
      button?.remove();
      return;
    }

    const expanded = button?.dataset.expanded === 'true';
    items.forEach((item, index) => {
      item.classList.toggle('is-extra-hidden', !expanded && index >= DEFAULT_VISIBLE_COUNT);
    });

    if (!button) {
      button = document.createElement('button');
      button.id = 'siteNewsMoreButton';
      button.type = 'button';
      button.className = 'site-news-more-button';
      button.dataset.expanded = 'false';
      button.addEventListener('click', () => {
        const nowExpanded = button.dataset.expanded !== 'true';
        button.dataset.expanded = String(nowExpanded);
        applySiteNewsLimit();
      });
      card.appendChild(button);
    }

    const hiddenCount = Math.max(0, items.length - DEFAULT_VISIBLE_COUNT);
    button.textContent = expanded ? '折りたたむ' : `さらに表示（残り${hiddenCount}件）`;
  }

  window.addEventListener('load', applySiteNewsLimit);

  const observer = new MutationObserver(() => applySiteNewsLimit());
  observer.observe(document.body, { childList: true, subtree: true });
})();
