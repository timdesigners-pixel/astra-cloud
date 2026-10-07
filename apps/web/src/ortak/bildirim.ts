const SURE = 4500;
const SURE_GERI_AL = 8000;
const IKON = { ok: '✓', hata: '✕' } as const;

function kap(): HTMLElement {
  let k = document.getElementById('toastkap');
  if (!k) {
    k = document.createElement('div');
    k.id = 'toastkap';
    k.setAttribute('role', 'status');
    k.setAttribute('aria-live', 'polite');
    document.body.appendChild(k);
  }
  return k;
}

/* Köşede kısa süre görünen, üst üste dizilen bildirim; isteğe bağlı "Geri al" düğmesi. */
export function bildir(metin: string, geriAl?: () => void | Promise<void>, hata = false) {
  const k = kap();
  const sure = geriAl ? SURE_GERI_AL : SURE;
  const t = document.createElement('div');
  t.className = 'toast ' + (hata ? 't-hata' : 't-ok');
  const im = document.createElement('span'); im.className = 'toast-im'; im.textContent = hata ? IKON.hata : IKON.ok; im.setAttribute('aria-hidden', 'true');
  const gv = document.createElement('span'); gv.className = 'toast-gv'; gv.textContent = metin;
  t.append(im, gv);
  let zaman = 0;
  const kapat = () => {
    window.clearTimeout(zaman);
    if (!t.isConnected) return;
    t.classList.add('cikis');
    window.setTimeout(() => t.remove(), 180);
  };
  if (geriAl) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-ey'; b.textContent = 'Geri al';
    b.addEventListener('click', () => { kapat(); void geriAl(); });
    t.appendChild(b);
  }
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'toast-x'; x.textContent = '×'; x.setAttribute('aria-label', 'Kapat');
  x.addEventListener('click', kapat);
  t.appendChild(x);
  const serit = document.createElement('i'); serit.className = 'toast-sure'; serit.style.animationDuration = `${sure}ms`;
  t.appendChild(serit);
  const baslat = () => { window.clearTimeout(zaman); t.classList.remove('durdu'); zaman = window.setTimeout(kapat, sure); };
  t.addEventListener('mouseenter', () => { window.clearTimeout(zaman); t.classList.add('durdu'); });
  t.addEventListener('mouseleave', baslat);
  k.appendChild(t);
  while (k.children.length > 4) k.firstElementChild?.remove();
  baslat();
}
