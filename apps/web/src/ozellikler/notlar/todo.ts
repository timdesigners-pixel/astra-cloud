import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { gun } from '../../ortak/bicim';
import { CakismaHatasi, hataMetni } from '../../veri/hata';
import { kayitEkle, kayitGuncelle, kayitlariGetir, type Kayit } from '../../veri/kayit';
import { ayEkle } from '../odemeler/odemeler';
import { bugunStr, girdi, kutu, secim } from './ortak';

const SUTUN = ['baslik', 'tarih', 'oncelik', 'etiket', 'tekrar', 'tamamlandi', 'tamamlanma', 'notlar'];
const ONCELIK: [string, string][] = [['yuksek', 'Yüksek'], ['orta', 'Orta'], ['dusuk', 'Düşük']];
const TEKRAR: [string, string][] = [['yok', 'Tekrarlanmaz'], ['gunluk', 'Her gün'], ['haftalik', 'Her hafta'], ['aylik', 'Her ay']];

/* Tamamlanan tekrarlı görevin bir sonraki tarihi. */
export function sonrakiTarih(tarih: string, tekrar: string): string | null {
  if (tekrar === 'aylik') return ayEkle(tarih, 1);
  const d = tekrar === 'gunluk' ? 1 : tekrar === 'haftalik' ? 7 : 0;
  if (!d) return null;
  const [y, m, g] = tarih.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, g! + d)).toISOString().slice(0, 10);
}

export function todoSayfasi(kok: HTMLElement) {
  const s = { liste: [] as Kayit[], yukleniyor: true, hata: '', ara: '', bitenAcik: false };
  const kart = el('section', 'card todo');
  kok.replaceChildren(kart);
  const hizli = el('form', 'todo-hizli'); hizli.noValidate = true;
  const yeniAd = el('input'); yeniAd.id = 'todo-yeni'; yeniAd.placeholder = 'Yeni görev yaz, Enter\'a bas'; yeniAd.maxLength = 300; yeniAd.setAttribute('aria-label', 'Yeni görev');
  const yeniTarih = el('input'); yeniTarih.type = 'date'; yeniTarih.id = 'todo-yeni-tarih'; yeniTarih.setAttribute('aria-label', 'Tarih');
  const ekle = el('button', 'btn primary sm', 'Ekle'); ekle.type = 'submit';
  hizli.append(yeniAd, yeniTarih, ekle);
  const bar = el('div', 'tbar');
  const ara = el('input'); ara.type = 'search'; ara.placeholder = 'Görev ya da etiket ara'; ara.setAttribute('aria-label', 'Ara');
  const say = el('span', 'tbar-count');
  bar.append(ara, el('span', 'tbar-sp'), say);
  const icerik = el('div', 'todo-icerik');
  kart.append(hizli, bar, icerik);

  const eslesir = (k: Kayit) => { const t = katla(s.ara.trim()); return !t || katla(`${k.baslik} ${k.etiket ?? ''}`).includes(t); };

  function satir(k: Kayit) {
    const li = el('li', 'todo-satir' + (k.tamamlandi ? ' bitti' : ''));
    const c = el('input'); c.type = 'checkbox'; c.checked = !!k.tamamlandi; c.setAttribute('aria-label', 'Tamamlandı');
    c.addEventListener('change', () => void tamamla(k, c.checked));
    const b = el('button', 'todo-baslik', String(k.baslik)); b.type = 'button'; b.addEventListener('click', () => form(k));
    li.append(c, b);
    if (k.oncelik === 'yuksek') li.appendChild(el('span', 'pill p1', 'Yüksek'));
    if (k.etiket) li.appendChild(el('span', 'pill', String(k.etiket)));
    if (k.tekrar && k.tekrar !== 'yok') li.appendChild(el('span', 'pill', '↻'));
    if (k.tarih) li.appendChild(el('small', 'takma', gun(String(k.tarih))));
    return li;
  }

  function bolum(baslik: string, l: Kayit[], ek = '') {
    if (!l.length) return null;
    const b = el('section', 'todo-bolum' + ek);
    b.appendChild(el('h3', '', `${baslik} · ${l.length}`));
    const ul = el('ul', 'todo-liste'); l.forEach(k => ul.appendChild(satir(k))); b.appendChild(ul);
    return b;
  }

  function ciz() {
    const hepsi = s.liste.filter(eslesir);
    const acik = hepsi.filter(k => !k.tamamlandi);
    say.textContent = s.yukleniyor ? '' : `${acik.length} açık`;
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const t = el('button', 'btn ghost sm', 'Tekrar dene'); t.type = 'button'; t.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), t); return;
    }
    if (!s.liste.length) { icerik.appendChild(el('p', 'bos', 'Henüz görev yok. Yukarıya yazıp Enter\'a bas.')); return; }
    const bg = bugunStr();
    const tarihe = (k: Kayit, f: (t: string) => boolean) => !!k.tarih && f(String(k.tarih));
    const sirala = (l: Kayit[]) => [...l].sort((a, b) => String(a.tarih ?? '9999').localeCompare(String(b.tarih ?? '9999')));
    [bolum('Geciken', sirala(acik.filter(k => tarihe(k, t => t < bg))), ' gecikmis'), bolum('Bugün', acik.filter(k => k.tarih === bg)),
      bolum('Yaklaşan', sirala(acik.filter(k => tarihe(k, t => t > bg)))), bolum('Tarihsiz', acik.filter(k => !k.tarih))]
      .forEach(b => b && icerik.appendChild(b));
    const biten = hepsi.filter(k => k.tamamlandi).sort((a, b) => String(b.tamamlanma ?? '').localeCompare(String(a.tamamlanma ?? ''))).slice(0, 30);
    if (biten.length) {
      const d = el('details', 'todo-bolum'); d.open = s.bitenAcik;
      d.addEventListener('toggle', () => { s.bitenAcik = d.open; });
      d.appendChild(el('summary', '', `Tamamlananlar · ${biten.length}`));
      const ul = el('ul', 'todo-liste'); biten.forEach(k => ul.appendChild(satir(k))); d.appendChild(ul);
      icerik.appendChild(d);
    }
    if (!acik.length && !biten.length) icerik.appendChild(el('p', 'bos', 'Aramana uyan görev yok.'));
  }

  const yerles = (k: Kayit) => { const i = s.liste.findIndex(x => x.id === k.id); if (i >= 0) s.liste[i] = k; else s.liste.push(k); };

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { s.liste = await kayitlariGetir('todolar', SUTUN, {}, 'tarih'); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false; ciz();
  }

  async function tamamla(k: Kayit, bitti: boolean) {
    try {
      const g = await kayitGuncelle('todolar', SUTUN, k.id, k.surum, { tamamlandi: bitti, tamamlanma: bitti ? new Date().toISOString() : null });
      yerles(g);
      if (bitti && k.tekrar !== 'yok' && k.tarih) {
        const sonraki = sonrakiTarih(String(k.tarih), String(k.tekrar));
        if (sonraki) yerles(await kayitEkle('todolar', SUTUN, { baslik: k.baslik, tarih: sonraki, oncelik: k.oncelik, etiket: k.etiket, tekrar: k.tekrar, notlar: k.notlar }));
      }
      ciz();
    } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
  }

  hizli.addEventListener('submit', async e => {
    e.preventDefault();
    const b = yeniAd.value.trim(); if (!b) return;
    ekle.disabled = true;
    try { yerles(await kayitEkle('todolar', SUTUN, { baslik: b, tarih: yeniTarih.value || null })); yeniAd.value = ''; yeniTarih.value = ''; ciz(); yeniAd.focus(); }
    catch (err) { bildir(hataMetni(err), undefined, true); }
    ekle.disabled = false;
  });

  function form(k: Kayit) {
    const d = kutu('Görevi düzenle');
    const ad = girdi('tf-baslik', 'text', String(k.baslik)); ad.maxLength = 300;
    const tarih = girdi('tf-tarih', 'date', k.tarih ? String(k.tarih) : '');
    const onc = secim('tf-oncelik', ONCELIK, String(k.oncelik));
    const et = girdi('tf-etiket', 'text', k.etiket ? String(k.etiket) : ''); et.maxLength = 40;
    const tek = secim('tf-tekrar', TEKRAR, String(k.tekrar));
    const not = el('textarea'); not.id = 'tf-not'; not.rows = 3; not.value = k.notlar ? String(k.notlar) : '';
    d.alan('Görev', ad); d.alan('Tarih', tarih); d.alan('Öncelik', onc); d.alan('Etiket', et);
    d.alan('Tekrar', tek, 'Tarihi olan görev tamamlanınca bir sonrakisi açılır'); d.alan('Not', not);
    const sil = el('button', 'btn danger', 'Sil'); sil.type = 'button'; let emin = false;
    sil.addEventListener('click', async () => {
      if (!emin) { emin = true; sil.textContent = 'Emin misin? Tekrar bas'; return; }
      sil.disabled = true;
      try {
        const silinen = await kayitGuncelle('todolar', SUTUN, k.id, k.surum, { silindi_at: new Date().toISOString() });
        s.liste = s.liste.filter(x => x.id !== k.id); d.dlg.close(); ciz();
        bildir('Görev silindi', async () => { try { yerles(await kayitGuncelle('todolar', SUTUN, silinen.id, silinen.surum, { silindi_at: null })); ciz(); bildir('Geri alındı'); } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); } });
      } catch (err) { sil.disabled = false; d.hatayaz(hataMetni(err)); }
    });
    d.dugmeler.appendChild(sil);
    d.f.addEventListener('submit', async e => {
      e.preventDefault();
      if (!ad.value.trim()) { d.hatayaz('Görev boş olamaz.'); return; }
      d.kaydet.disabled = true;
      try {
        yerles(await kayitGuncelle('todolar', SUTUN, k.id, k.surum, { baslik: ad.value.trim(), tarih: tarih.value || null, oncelik: onc.value, etiket: et.value.trim() || null, tekrar: tek.value, notlar: not.value.trim() || null }));
        d.dlg.close(); ciz(); bildir('Kaydedildi');
      } catch (err) {
        d.kaydet.disabled = false;
        if (err instanceof CakismaHatasi) { d.dlg.close(); void yukle(); bildir(hataMetni(err), undefined, true); return; }
        d.hatayaz(hataMetni(err));
      }
    });
    d.bitir();
  }

  ara.addEventListener('input', () => { s.ara = ara.value; ciz(); });
  void yukle();
}
