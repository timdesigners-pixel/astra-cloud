import { el } from '../../ortak/dom';
import { git } from '../../kabuk/yonlendirici';
import type { Panel } from '../../veri/panel';

const SIMGE = { kritik: '!', uyari: '!', bilgi: 'i' } as const;

/* Zil simgesinden açılan liste: panel hesabındaki uyarılar, tıklayınca ilgili sayfaya gider. */
export function bildirimMerkeziAc(p: Panel | null) {
  const dlg = el('dialog', 'kutu bildirim-merkezi'); dlg.setAttribute('aria-label', 'Bildirim Merkezi');
  const f = el('div'); f.appendChild(el('h2', '', 'Bildirim Merkezi'));
  if (!p) f.appendChild(el('p', 'bos', 'Veriler yükleniyor ya da kilit açılmadı.'));
  else if (!p.uyarilar.length) f.appendChild(el('p', 'bos', 'Her şey yolunda. Bekleyen uyarı yok.'));
  else {
    const liste = el('ul', 'bm-liste');
    p.uyarilar.forEach(u => {
      const li = el('li'), b = el('button', `bm-oge bm-${u.onem}`); b.type = 'button';
      const ic = el('span', 'bm-ikon', SIMGE[u.onem]); ic.setAttribute('aria-hidden', 'true');
      const gv = el('span', 'bm-govde'); gv.append(el('b', '', u.baslik), el('small', '', u.not));
      b.append(ic, gv);
      b.addEventListener('click', () => { dlg.close(); git(u.sekme); });
      li.appendChild(b); liste.appendChild(li);
    });
    f.appendChild(liste);
  }
  const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
  const d = el('div', 'form-dugmeler'); d.appendChild(kapat); f.appendChild(d);
  dlg.appendChild(f);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.body.appendChild(dlg); dlg.showModal();
}
