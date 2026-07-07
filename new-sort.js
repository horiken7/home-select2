(function () {
  function isNewListing(item) {
    return Boolean(
      item?.isNew ||
      (Array.isArray(item?.tags) && item.tags.some((tag) => String(tag).toUpperCase() === 'NEW'))
    );
  }

  function dateValue(item) {
    const value = item?.firstSeenAt || item?.lastSeenAt || item?.detectedAt || item?.createdAt || '';
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  function setNewSortDefault() {
    const priorityFilter = document.querySelector('#priorityFilter');
    if (priorityFilter) priorityFilter.value = 'newDesc';
  }

  function addButtonStyle() {
    if (document.querySelector('#manualSearchStyle')) return;
    const style = document.createElement('style');
    style.id = 'manualSearchStyle';
    style.textContent = '.search-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:flex-end}.manual-search-button{border:0;border-radius:999px;padding:12px 18px;background:#2563eb;color:#fff;font-weight:1000;cursor:pointer;box-shadow:0 12px 24px rgba(37,99,235,.22)}.manual-search-button.is-dirty{background:#dc2626}.manual-search-button small{display:block;font-size:.72rem;font-weight:800;opacity:.9}';
    document.head.appendChild(style);
  }

  function markDirty(isDirty) {
    const button = document.querySelector('#manualSearchButton');
    if (!button) return;
    button.classList.toggle('is-dirty', isDirty);
    button.innerHTML = isDirty ? 'この条件で再検索<small>条件が変更されています</small>' : 'この条件で再検索';
  }

  function runSearch() {
    if (typeof state === 'object') state.currentPage = 1;
    if (typeof renderCards === 'function') renderCards();
    markDirty(false);
  }

  function addManualSearchButton() {
    const resetButton = document.querySelector('#resetButton');
    if (!resetButton || document.querySelector('#manualSearchButton')) return;

    addButtonStyle();

    const wrapper = document.createElement('div');
    wrapper.className = 'search-actions';

    const button = document.createElement('button');
    button.id = 'manualSearchButton';
    button.type = 'button';
    button.className = 'manual-search-button';
    button.textContent = 'この条件で再検索';
    button.addEventListener('click', runSearch);

    resetButton.parentNode.insertBefore(wrapper, resetButton);
    wrapper.appendChild(button);
    wrapper.appendChild(resetButton);
  }

  function watchFilterChanges() {
    ['#areaFilter', '#rentFilter', '#layoutFilter', '#walkFilter', '#typeFilter', '#priorityFilter']
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .forEach((element) => {
        element.addEventListener('change', () => markDirty(true));
      });
  }

  const originalSortCards = typeof sortCards === 'function' ? sortCards : null;
  if (!originalSortCards) return;

  sortCards = function patchedSortCards(cards, priority) {
    if (priority === 'newDesc') {
      return cards.sort((a, b) => {
        const aNew = isNewListing(a) ? 1 : 0;
        const bNew = isNewListing(b) ? 1 : 0;
        if (aNew !== bNew) return bNew - aNew;
        const dateDiff = dateValue(b) - dateValue(a);
        if (dateDiff !== 0) return dateDiff;
        return Number(b.displayScore || b.score || 0) - Number(a.displayScore || a.score || 0);
      });
    }

    return originalSortCards(cards, priority);
  };

  window.addEventListener('load', () => {
    setNewSortDefault();
    addManualSearchButton();
    watchFilterChanges();
    runSearch();

    const resetButton = document.querySelector('#resetButton');
    resetButton?.addEventListener('click', () => {
      setTimeout(() => {
        setNewSortDefault();
        runSearch();
      }, 0);
    });
  });
})();
