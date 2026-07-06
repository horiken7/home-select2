function enableImageViewer() {
  document.querySelectorAll('.card-image.has-real-image').forEach((link) => {
    const image = link.querySelector('img');
    if (!image?.src) return;
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
