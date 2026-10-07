/* Açılan her pencerenin (dialog) sağ üst köşesine kapatma (×) düğmesi ekler. */
function ekle(d: HTMLDialogElement) {
  if (d.querySelector(':scope > .pencere-x')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pencere-x'; b.textContent = '×';
  b.setAttribute('aria-label', 'Kapat'); b.title = 'Kapat';
  b.addEventListener('click', e => { e.preventDefault(); d.close(); });
  d.prepend(b);
}

export function pencereKapatmaKur() {
  const tara = (n: Node) => {
    if (n instanceof HTMLDialogElement) ekle(n);
    else if (n instanceof HTMLElement) n.querySelectorAll('dialog').forEach(ekle);
  };
  new MutationObserver(l => l.forEach(m => m.addedNodes.forEach(tara))).observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('dialog').forEach(ekle);
}
