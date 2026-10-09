import { el } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { bugunAnahtari } from '../../ortak/zaman';
import { hataMetni } from '../../veri/hata';
import { RUTIN_TURLERI, rutinleriGetir, rutinleriYaz, rutinleriYenile, type Rutinler } from '../../veri/rutin';

const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

/* Rutinler: günlük, haftalık ve tek seferlik kontrol listeleri. */
export function rutinSayfasi(kok: HTMLElement) {
  const kart = el('section', 'card icra');
  kok.replaceChildren(kart);
  kart.appendChild(el('p', 'bos', 'Yükleniyor…'));
  void (async () => {
    try {
      const { r: ilk, degisti } = rutinleriYenile(await rutinleriGetir(), bugunAnahtari());
      let r: Rutinler = ilk;
      const kaydet = async () => { try { await rutinleriYaz(r); } catch (e) { bildir(hataMetni(e), undefined, true); } };
      if (degisti) await kaydet();
      const ciz = () => {
        const ozet = el('div', 'icra-ozet');
        const hucre = (et: string, d: string) => { const x = el('div', 'icra-hucre'); x.append(el('span', 'et', et), el('b', 'gz', d)); ozet.appendChild(x); };
        hucre('Bugünkü rutin', `${r.gunluk.filter(x => x.d).length}/${r.gunluk.length}`); hucre('Haftalık', `${r.haftalik.filter(x => x.d).length}/${r.haftalik.length}`); hucre('Açık fırsat', String(r.firsat.filter(x => !x.d).length));
        kart.replaceChildren(ozet);
        RUTIN_TURLERI.forEach(([tur, baslik, not]) => {
          const b = el('section'); b.append(el('h3', '', baslik), el('p', 'bos', not));
          const ul = el('ul', 'rutin-liste');
          r[tur].forEach(m => {
            const li = el('li', m.d ? 'tamam' : ''), lb = el('label'), c = el('input'); c.type = 'checkbox'; c.checked = m.d;
            c.addEventListener('change', () => { m.d = c.checked; ciz(); void kaydet(); });
            lb.append(c, el('span', '', m.t)); li.appendChild(lb);
            const sil = el('button', 'btn danger sm', 'sil'); sil.type = 'button'; sil.setAttribute('aria-label', `${m.t} sil`);
            sil.addEventListener('click', () => { r[tur] = r[tur].filter(x => x.id !== m.id); ciz(); void kaydet(); }); li.appendChild(sil); ul.appendChild(li);
          });
          if (!r[tur].length) ul.appendChild(el('li', 'bos', 'Kayıt yok.'));
          b.appendChild(ul);
          const f = el('div', 'tbar'), g = el('input'); g.id = `rt-${tur}`; g.placeholder = 'Yeni madde'; g.setAttribute('aria-label', `${baslik} yeni madde`);
          const ekle = el('button', 'btn sm', '+ Ekle'); ekle.type = 'button'; ekle.id = `rt-ekle-${tur}`;
          const ekleFn = () => { const t = g.value.trim(); if (!t) return; r[tur].push({ id: yeniId(), t: t.slice(0, 200), d: false }); ciz(); void kaydet(); };
          ekle.addEventListener('click', ekleFn); g.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ekleFn(); } });
          f.append(g, ekle); b.appendChild(f); kart.appendChild(b);
        });
      };
      ciz();
    } catch (e) { kart.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  })();
}
