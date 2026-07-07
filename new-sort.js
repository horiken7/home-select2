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
})();
