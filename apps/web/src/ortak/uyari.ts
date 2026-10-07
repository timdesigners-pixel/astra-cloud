export type UyariTuru = 'basari' | 'hata' | 'uyari' | 'bilgi' | 'soru';

const IKON: Record<UyariTuru, string> = {
  basari: '<circle cx="26" cy="26" r="24" class="u-halka"/><path d="M15 27l8 8 15-17" class="u-cizgi"/>',
  hata: '<circle cx="26" cy="26" r="24" class="u-halka"/><path d="M17 17l18 18M35 17L17 35" class="u-cizgi"/>',
  uyari: '<circle cx="26" cy="26" r="24" class="u-halka"/><path d="M26 14v16" class="u-cizgi"/><circle cx="26" cy="38" r="1.8" class="u-nokta"/>',
  bilgi: '<circle cx="26" cy="26" r="24" class="u-halka"/><path d="M26 23v15" class="u-cizgi"/><circle cx="26" cy="15" r="1.8" class="u-nokta"/>',
  soru: '<circle cx="26" cy="26" r="24" class="u-halka"/><path d="M20 20.5c0-3.6 2.8-5.5 6-5.5s6 1.9 6 5.2c0 3.8-4.5 4.6-4.5 8.3" class="u-cizgi"/><circle cx="27.5" cy="37.5" r="1.8" class="u-nokta"/>',
};

type Kutu = { tur: UyariTuru; baslik: string; metin?: string };

function iskelet(o: Kutu, sinif: string) {
  const dlg = document.createElement('dialog');
  dlg.className = `uyari u-${o.tur} ${sinif}`;
  dlg.setAttribute('aria-label', o.baslik);
  dlg.setAttribute('role', 'alertdialog');
  const ikon = document.createElement('div');
  ikon.className = 'uyari-ikon';
  ikon.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true">${IKON[o.tur]}</svg>`;
  const baslik = document.createElement('h2');
  baslik.textContent = o.baslik;
  dlg.append(ikon, baslik);
  if (o.metin) { const p = document.createElement('p'); p.textContent = o.metin; dlg.appendChild(p); }
  return dlg;
}

function buton(metin: string, sinif: string) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `btn ${sinif}`; b.textContent = metin;
  return b;
}

/* Ortada açılan onay penceresi. Evet'te true, vazgeçince (Esc, dış alan dahil) false döner. */
export function onayla(o: { baslik: string; metin?: string; evet?: string; hayir?: string; tehlike?: boolean }): Promise<boolean> {
  return new Promise(coz => {
    const dlg = iskelet({ tur: o.tehlike === false ? 'soru' : 'uyari', baslik: o.baslik, metin: o.metin }, 'uyari-onay');
    const evet = buton(o.evet ?? 'Evet', o.tehlike === false ? 'primary' : 'danger');
    const hayir = buton(o.hayir ?? 'Vazgeç', 'ghost');
    evet.id = 'uyari-evet'; hayir.id = 'uyari-hayir';
    const dugmeler = document.createElement('div');
    dugmeler.className = 'uyari-dugmeler';
    dugmeler.append(hayir, evet);
    dlg.appendChild(dugmeler);
    let sonuc = false;
    evet.addEventListener('click', () => { sonuc = true; dlg.close(); });
    hayir.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { dlg.remove(); coz(sonuc); });
    document.body.appendChild(dlg);
    dlg.showModal();
    hayir.focus();
  });
}

/* Ortada açılan bilgi penceresi. Süre verilirse kendiliğinden kapanır; Tamam ile de kapanır. */
export function uyar(o: Kutu & { sure?: number; dugme?: string }): Promise<void> {
  return new Promise(coz => {
    const dlg = iskelet(o, 'uyari-bilgi');
    const tamam = buton(o.dugme ?? 'Tamam', 'primary');
    tamam.id = 'uyari-tamam';
    const dugmeler = document.createElement('div');
    dugmeler.className = 'uyari-dugmeler';
    dugmeler.appendChild(tamam);
    dlg.appendChild(dugmeler);
    let zaman = 0;
    if (o.sure) {
      const serit = document.createElement('div');
      serit.className = 'uyari-sure';
      const ic = document.createElement('i');
      ic.style.animationDuration = `${o.sure}ms`;
      serit.appendChild(ic);
      dlg.appendChild(serit);
      zaman = window.setTimeout(() => dlg.close(), o.sure);
    }
    tamam.addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { window.clearTimeout(zaman); dlg.remove(); coz(); });
    document.body.appendChild(dlg);
    dlg.showModal();
    tamam.focus();
  });
}
