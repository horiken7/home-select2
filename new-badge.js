function applyNewBadges() {
  document.querySelectorAll('.property-card').forEach((card) => {
    const badges = Array.from(card.querySelectorAll('.badge'));
    const newBadge = badges.find((badge) => badge.textContent.trim().toUpperCase() === 'NEW');

    if (!newBadge) {
      card.classList.remove('has-new-listing');
      card.querySelector('.new-ribbon')?.remove();
      return;
    }

    card.classList.add('has-new-listing');
    newBadge.classList.add('new-inline-hidden');

    if (!card.querySelector('.new-ribbon')) {
      const ribbon = document.createElement('span');
      ribbon.className = 'new-ribbon';
      ribbon.textContent = 'NEW';
      ribbon.setAttribute('aria-label', '新規物件');
      card.appendChild(ribbon);
    }
  });
}

window.addEventListener('load', applyNewBadges);

const newBadgeObserver = new MutationObserver(() => applyNewBadges());
newBadgeObserver.observe(document.body, { childList: true, subtree: true });
