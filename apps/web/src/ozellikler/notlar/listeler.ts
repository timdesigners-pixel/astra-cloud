import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { girdi, guvenliBaglanti, kutu, secim } from './ortak';
import { onayla } from '../../ortak/uyari';

const LSUTUN = ['ad', 'kaynak', 'notlar'];
const OSUTUN = ['liste_id', 'baslik', 'baglanti', 'etiket', 'okundu'];
const KAYNAK: [string, string][] = [['youtube', 'YouTube'], ['pinterest', 'Pinterest'], ['instagram', 'Instagram'], ['diger', 'Diğer']];
const kaynakAd = (v: unknown) => KAYNAK.find(x => x[0] === v)?.[1] ?? 'Diğer';

export function listelerSayfasi(kok: HTMLElement) {
  const s = { listeler: [] as Kayit[], ogeler: [] as Kayit[], secili: '', yukleniyor: true, hata: '', ara: '', okunmamis: false };
  const kart = el('section', 'card zihin');
  kok.replaceChildren(kart);
  const sol = el('div', 'zihin-sol'), sag = el('div', 'zihin-sag');
  kart.append(sol, sag);
  const yeni = el('button', 'btn primary sm', '+ Liste'); yeni.type = 'button'; yeni.id = 'liste-yeni';
  const ust = el('div', 'tbar'); ust.append(el('span', 'tbar-sp'), yeni);
  const agac = el('div', 'zihin-agac');
  sol.append(ust, agac);

  const yerles = (d: Kayit[], k: Kayit) => { const i = d.findIndex(x => x.id === k.id); if (i >= 0) d[i] = k; else d.push(k); };
  const mevcut = () => s.listeler.find(k => k.id === s.secili);
  const ogeSay = (id: string) => s.ogeler.filter(o => o.liste_id === id);

  function solCiz() {
    agac.replaceChildren();
    if (s.yukleniyor) { agac.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const t = el('button', 'btn ghost sm', 'Tekrar dene'); t.type = 'button'; t.addEventListener('click', () => void yukle());
      agac.append(el('p', 'bos hata', s.hata), t); return;
    }
    if (!s.listeler.length) { agac.appendChild(el('p', 'bos', 'Henüz liste yok. YouTube, Pinterest ya da Instagram\'dan kaydettiklerin için liste aç.')); return; }
    s.listeler.forEach(l => {
      const o = ogeSay(l.id), oku = o.filter(x => !x.okundu).length;
      const b = el('button', 'zihin-oge' + (l.id === s.secili ? ' secili' : ''));
      b.type = 'button'; b.dataset.id = l.id;
      b.append(el('span', '', String(l.ad)), el('small', 'takma', `${kaynakAd(l.kaynak)} · ${oku} okunmamış / ${o.length}`));
      b.addEventListener('click', () => { s.secili = l.id; solCiz(); sagCiz(); });
      agac.appendChild(b);
    });
  }

  function sagCiz() {
    sag.replaceChildren();
    const l = mevcut();
    if (!l) { sag.appendChild(el('p', 'bos', 'Soldan bir liste seç.')); return; }
    const baslik = el('div', 'tbar');
    const d = el('button', 'btn ghost sm', 'Listeyi düzenle'); d.type = 'button'; d.addEventListener('click', () => listeForm(l));
    baslik.append(el('b', '', String(l.ad)), el('span', 'tbar-sp'), d);

    const hizli = el('form', 'todo-hizli'); hizli.noValidate = true;
    const ad = el('input'); ad.id = 'oge-baslik'; ad.placeholder = 'Başlık'; ad.maxLength = 300; ad.setAttribute('aria-label', 'Başlık');
    const bag = el('input'); bag.id = 'oge-baglanti'; bag.placeholder = 'Bağlantı (isteğe bağlı)'; bag.setAttribute('aria-label', 'Bağlantı');
    const ekle = el('button', 'btn primary sm', 'Ekle'); ekle.type = 'submit';
    hizli.append(ad, bag, ekle);
    hizli.addEventListener('submit', async e => {
      e.preventDefault();
      if (!ad.value.trim()) return;
      const link = bag.value.trim();
      if (link && !guvenliBaglanti(link)) { bildir('Bağlantı http ya da https ile başlamalı', undefined, true); return; }
      ekle.disabled = true;
      try { yerles(s.ogeler, await kayitEkle('liste_ogeleri', OSUTUN, { liste_id: l.id, baslik: ad.value.trim(), baglanti: link || null })); solCiz(); sagCiz(); (document.getElementById('oge-baslik') as HTMLInputElement | null)?.focus(); }
      catch (err) { bildir(hataMetni(err), undefined, true); ekle.disabled = false; }
    });

    const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Listede ara'; ara.value = s.ara; ara.setAttribute('aria-label', 'Ara');
    ara.addEventListener('input', () => { s.ara = ara.value; ogeCiz(); });
    const okun = el('label', 'ajanda-etiket'); const ok = el('input'); ok.type = 'checkbox'; ok.id = 'oge-okunmamis'; ok.checked = s.okunmamis;
    ok.addEventListener('change', () => { s.okunmamis = ok.checked; ogeCiz(); });
    okun.append(ok, document.createTextNode('Yalnız okunmamışlar'));
    const bar = el('div', 'tbar'); bar.append(ara, okun);
    const ul = el('ul', 'todo-liste'); ul.id = 'oge-liste';
    sag.append(baslik, hizli, bar, ul);
    ogeCiz();
  }

  function ogeCiz() {
    const ul = document.getElementById('oge-liste'); if (!ul) return;
    ul.replaceChildren();
    const q = katla(s.ara.trim());
    const l = ogeSay(s.secili).filter(o => (!s.okunmamis || !o.okundu) && (!q || katla(`${o.baslik} ${o.etiket ?? ''}`).includes(q)));
    if (!l.length) { const li = el('li', 'bos', ogeSay(s.secili).length ? 'Aramana uyan öğe yok.' : 'Bu listede henüz öğe yok.'); ul.appendChild(li); return; }
    l.forEach(o => {
      const li = el('li', 'todo-satir' + (o.okundu ? ' bitti' : ''));
      const c = el('input'); c.type = 'checkbox'; c.checked = !!o.okundu; c.setAttribute('aria-label', 'Okundu');
      c.addEventListener('change', async () => {
        try { yerles(s.ogeler, await kayitGuncelle('liste_ogeleri', OSUTUN, o.id, o.surum, { okundu: c.checked })); solCiz(); ogeCiz(); }
        catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
      });
      li.appendChild(c);
      const link = guvenliBaglanti(o.baglanti);
      if (link) { const a = el('a', 'todo-baslik', String(o.baslik)); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); }
      else li.appendChild(el('span', 'todo-baslik', String(o.baslik)));
      const sil = el('button', 'btn ghost xs', 'Sil'); sil.type = 'button';
      sil.addEventListener('click', async () => {
        try {
          const silinen = await kayitGuncelle('liste_ogeleri', OSUTUN, o.id, o.surum, { silindi_at: new Date().toISOString() });
          s.ogeler = s.ogeler.filter(x => x.id !== o.id); solCiz(); ogeCiz();
          bildir('Öğe silindi', async () => { try { yerles(s.ogeler, await kayitGuncelle('liste_ogeleri', OSUTUN, silinen.id, silinen.surum, { silindi_at: null })); solCiz(); ogeCiz(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
        } catch (e) { bildir(hataMetni(e), undefined, true); }
      });
      li.appendChild(sil);
      ul.appendChild(li);
    });
  }

  function listeForm(l?: Kayit) {
    const d = kutu(l ? 'Listeyi düzenle' : 'Yeni liste');
    const ad = girdi('lf-ad', 'text', l ? String(l.ad) : ''); ad.maxLength = 120;
    const kay = secim('lf-kaynak', KAYNAK, l ? String(l.kaynak) : 'youtube');
    const not = el('textarea'); not.id = 'lf-not'; not.rows = 3; not.value = l?.notlar ? String(l.notlar) : '';
    d.alan('Liste adı', ad); d.alan('Kaynak', kay); d.alan('Not', not);
    if (l) {
      const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button';
      sil.addEventListener('click', async () => {
        if (ogeSay(l.id).length) { d.hatayaz('Önce listedeki öğeleri sil.'); return; }
        if (!(await onayla({ baslik: 'Silinsin mi?', metin: 'Bu kayıt silinecek.', evet: 'Sil' }))) return;
        try { await kayitGuncelle('listeler', LSUTUN, l.id, l.surum, { silindi_at: new Date().toISOString() }); s.listeler = s.listeler.filter(x => x.id !== l.id); s.secili = ''; d.dlg.close(); solCiz(); sagCiz(); bildir('Liste silindi'); }
        catch (e) { d.hatayaz(hataMetni(e)); }
      });
      d.dugmeler.appendChild(sil);
    }
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!ad.value.trim()) { d.hatayaz('Liste adı boş olamaz.'); return; }
      const g = { ad: ad.value.trim(), kaynak: kay.value, notlar: not.value.trim() || null };
      d.kaydet.disabled = true;
      try {
        const k = l ? await kayitGuncelle('listeler', LSUTUN, l.id, l.surum, g) : await kayitEkle('listeler', LSUTUN, g);
        yerles(s.listeler, k); s.secili = k.id; d.dlg.close(); solCiz(); sagCiz(); bildir('Kaydedildi');
      } catch (err) {
        d.kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); }
        d.hatayaz(hataMetni(err));
      }
    });
    d.bitir();
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; solCiz();
    try {
      [s.listeler, s.ogeler] = await Promise.all([kayitlariGetir('listeler', LSUTUN, {}, 'ad'), kayitlariGetir('liste_ogeleri', OSUTUN, {}, 'olusturma')]);
      if (!mevcut()) s.secili = s.listeler[0]?.id ?? '';
    } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; solCiz(); sagCiz();
  }

  yeni.addEventListener('click', () => listeForm());
  void yukle();
}
