function isPromotionalOrBadImage(url) {
  const lower = String(url || '').toLowerCase();
  return [
    '/img/ogp/',
    'common/image/render/img-src.png',
    'logo',
    'icon',
    'sprite',
    'banner',
    'campaign',
    'advert',
    'ogp',
    'sns',
    'twitter',
    'facebook',
    'loading',
    'loader',
    'blank',
    'noimage',
    'no-image',
    'dummy',
    'placeholder',
    'map',
    'staff',
    'person',
    'people',
    'model',
    'talent',
    'cast',
    'ci_01'
  ].some((word) => lower.includes(word));
}

function replaceBadImageWithPlaceholder(link, image) {
  link.classList.remove('has-real-image');
  link.classList.add('has-placeholder', 'image-filtered');
  link.href = link.dataset.originalHref || link.href;
  link.title = '広告・人物画像を除外しました。物件詳細はリンク先で確認してください。';
  link.setAttribute('aria-label', '物件詳細を開く');
  image.remove();
  if (!link.querySelector('.image-placeholder-text')) {
    link.insertAdjacentHTML('beforeend', '<span class="mock-room"></span><span class="mock-window"></span><span class="mock-floor"></span><span class="image-placeholder-text">画像要確認</span>');
  }
}

function enableImageViewer() {
  document.querySelectorAll('.card-image').forEach((link) => {
    const image = link.querySelector('img');
    if (!image?.src) return;

    if (!link.dataset.originalHref) link.dataset.originalHref = link.href;

    if (isPromotionalOrBadImage(image.src)) {
      replaceBadImageWithPlaceholder(link, image);
      return;
    }

    if (!link.classList.contains('has-real-image')) return;
    link.href = image.src;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = '画像だけを開いて拡大表示します';
    link.setAttribute('aria-label', '画像だけを開いて拡大表示します');
  });
}

window.addEventListener('load', enableImageViewer);

const imageViewerObserver = new MutationObserver(() => enableImageViewer());
imageViewerObserver.observe(document.body, { childList: true, subtree: true });
