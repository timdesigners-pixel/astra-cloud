import { el } from '../../ortak/dom';

export const bugunStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

/* Bağlantı yalnız http ve https ise tıklanabilir yapılır. */
export const guvenliBaglanti = (u: unknown) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

/* Küçük form kutusu: alanlar eklenir, bitir() ile açılır. */
export function kutu(baslik: string) {
  const dlg = el('dialog', 'kutu'); dlg.setAttribute('aria-label', baslik);
  const f = el('form'); f.noValidate = true; f.method = 'dialog'; f.appendChild(el('h2', '', baslik));
  const hata = el('p', 'form-hata'); hata.hidden = true; hata.setAttribute('role', 'alert');
  const dugmeler = el('div', 'form-dugmeler');
  const kaydet = el('button', 'btn primary', 'Kaydet'); kaydet.type = 'submit';
  const vazgec = el('button', 'btn ghost', 'Vazgeç'); vazgec.type = 'button'; vazgec.addEventListener('click', () => dlg.close());
  dugmeler.append(kaydet, vazgec);
  const alan = (et: string, g: HTMLElement, ip?: string) => {
    const l = el('label', 'alan'); l.append(el('span', '', et), g); if (ip) l.appendChild(el('small', '', ip)); f.appendChild(l);
  };
  const bitir = () => {
    f.append(hata, dugmeler); dlg.appendChild(f); dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg); dlg.showModal(); f.querySelector<HTMLElement>('input,select,textarea')?.focus();
  };
  const hatayaz = (m: string) => { hata.textContent = m; hata.hidden = false; };
  return { dlg, f, alan, kaydet, dugmeler, bitir, hatayaz, hata };
}

export const girdi = (id: string, tip: string, deger = '') => { const i = el('input'); i.id = id; i.type = tip; i.value = deger; return i; };
export const secim = (id: string, secenek: [string, string][], deger: string) => {
  const x = el('select'); x.id = id;
  secenek.forEach(([v, t]) => { const o = el('option', '', t); o.value = v; x.appendChild(o); });
  x.value = deger; return x;
};
