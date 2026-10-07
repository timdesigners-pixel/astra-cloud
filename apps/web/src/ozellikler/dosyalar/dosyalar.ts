import './dosyalar.css';
import { el, katla } from '../../ortak/dom';
import { bildir } from '../../ortak/bildirim';
import { onayla } from '../../ortak/uyari';
import { degerSor } from '../../ortak/kutu';
import { git } from '../../kabuk/yonlendirici';
import { hataMetni } from '../../veri/hata';
import {
  AZAMI_DOSYA, adDegistir, agacGetir, altlar, bagliKlasor, copeAt, copuGetir, dosyaYukle, geriGetir, imzaliAdres, kaliciSil, klasorOlustur,
  tasi, yildizla, type BagTuru, type DosyaKaydi,
} from '../../veri/dosyalar';
import { davalariGetir, type DavaTuru } from '../../veri/davalar';
import { icraDosyalariniGetir } from '../../veri/icra';
import { kutu, secim } from '../notlar/ortak';
import { uygulamaSayfasi } from '../uygulamalar/uygulama';
import { bayt } from './bicim';
import { hukukTasiPenceresi, type Hazir } from './hukuk-tasi';
import type { Aday } from './hukuk-eslestir';

type Gorunum = 'dosyalarim' | 'cop' | 'arsiv';
type Sirala = 'ad' | 'tarih' | 'boyut';

const GUVENLI_TUR = /^(image\/(png|jpe?g|webp|gif)|application\/pdf|text\/plain|text\/csv)$/;
const tarihYaz = (s: string) => new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DAVA_ADI: Record<DavaTuru, string> = { ceza: 'Ceza', hukuk: 'Hukuk', cbs: 'CBS' };

function simge(k: DosyaKaydi): string {
  if (k.tur === 'klasor') return k.bag_tur === 'dava' ? '⚖' : k.bag_tur === 'icra' ? '▤' : '📁';
  const m = k.mime ?? '', ad = k.ad.toLowerCase();
  if (m.startsWith('image/')) return '🖼';
  if (m === 'application/pdf') return '📕';
  if (/\.(docx?|odt|rtf)$/.test(ad)) return '📘';
  if (/\.(xlsx?|csv|ods)$/.test(ad)) return '📗';
  if (/\.(pptx?|odp)$/.test(ad)) return '📙';
  if (/\.(zip|rar|7z|tar|gz)$/.test(ad)) return '🗜';
  if (m.startsWith('text/') || /\.(txt|md|json|html?|css|js)$/.test(ad)) return '📄';
  if (m.startsWith('audio/')) return '🎵';
  if (m.startsWith('video/')) return '🎞';
  return '📄';
}

/* Hukuk ve İcra sayfalarından çağrılır: kaydın klasörünü bulur (yoksa açar) ve Dosya Yöneticisi'nde o klasörü gösterir. */
let hedefKlasor: string | null = null;
export async function dosyaKlasoruAc(tur: BagTuru, id: string) {
  try { hedefKlasor = (await bagliKlasor(tur, id)).id; git('app-dosya'); }
  catch (e) { bildir(hataMetni(e), undefined, true); }
}

export function dosyaYoneticisiSayfasi(kok: HTMLElement) {
  const s = {
    tum: [] as DosyaKaydi[], cop: [] as DosyaKaydi[], copYuklendi: false, klasor: null as string | null, ara: '', sirala: 'ad' as Sirala,
    yildizli: false, gorunum: 'dosyalarim' as Gorunum, secili: new Set<string>(), adlar: new Map<string, string>(), adlarYuklendi: false,
    yukleniyor: true, hata: '', mesgul: '',
  };
  if (hedefKlasor) { s.klasor = hedefKlasor; hedefKlasor = null; }

  const kart = el('section', 'card dy');
  kok.replaceChildren(kart);

  const sekmeler = el('div', 'dy-sekme');
  const sekmeDugme = (g: Gorunum, metin: string) => {
    const b = el('button', 'dy-s', metin); b.type = 'button'; b.dataset.g = g;
    b.addEventListener('click', () => { s.gorunum = g; s.secili.clear(); if (g === 'cop') void copYukle(); ciz(); });
    return b;
  };
  const sCop = sekmeDugme('cop', 'Çöp kutusu');
  sekmeler.append(sekmeDugme('dosyalarim', 'Dosyalarım'), sCop, sekmeDugme('arsiv', 'Arşiv ve bilgisayar'));

  const ust = el('div', 'dy-ust');
  const icerik = el('div', 'dy-icerik');
  kart.append(sekmeler, ust, icerik);

  const dosyaSec = el('input'); dosyaSec.type = 'file'; dosyaSec.multiple = true; dosyaSec.hidden = true;
  const klasorSec = el('input'); klasorSec.type = 'file'; klasorSec.hidden = true;
  klasorSec.setAttribute('webkitdirectory', '');
  const hukukSec = el('input'); hukukSec.type = 'file'; hukukSec.hidden = true;
  hukukSec.setAttribute('webkitdirectory', '');
  kart.append(dosyaSec, klasorSec, hukukSec);

  /* ——— Veri ——— */
  const bul = (id: string | null) => (id ? s.tum.find(k => k.id === id) : undefined);
  const gorunenAd = (k: DosyaKaydi) => (k.bag_tur && k.bag_id ? s.adlar.get(`${k.bag_tur}:${k.bag_id}`) ?? k.ad : k.ad);

  function yol(id: string | null): DosyaKaydi[] {
    const z: DosyaKaydi[] = [];
    for (let k = bul(id); k; k = bul(k.ust_id)) { z.unshift(k); if (z.length > 50) break; }
    return z;
  }
  const yolMetni = (id: string | null) => yol(id).map(gorunenAd).join(' / ');

  async function adlariYukle() {
    if (s.adlarYuklendi || !s.tum.some(k => k.bag_tur)) return;
    s.adlarYuklendi = true;
    try {
      const [ceza, hukuk, cbs, icra] = await Promise.all([davalariGetir('ceza'), davalariGetir('hukuk'), davalariGetir('cbs'), icraDosyalariniGetir()]);
      (['ceza', 'hukuk', 'cbs'] as DavaTuru[]).forEach((t, i) => [ceza, hukuk, cbs][i]!.forEach(d =>
        s.adlar.set(`dava:${d.id}`, `${DAVA_ADI[t]} davası ${d.dosya_no}${d.konu ? ' · ' + d.konu : ''}`)));
      icra.forEach(d => s.adlar.set(`icra:${d.id}`, `İcra ${d.dosya_no ?? '—'}${d.icra_dairesi ? ' · ' + d.icra_dairesi : ''}`));
      ciz();
    } catch { /* adlar yer tutucu kalır */ }
  }

  async function yukle() {
    s.yukleniyor = true; s.hata = ''; ciz();
    try { s.tum = await agacGetir(); } catch (e) { s.hata = hataMetni(e); }
    s.yukleniyor = false;
    if (s.klasor && !bul(s.klasor)) s.klasor = null;
    ciz(); void adlariYukle();
  }
  async function copYukle() {
    try { s.cop = await copuGetir(); s.copYuklendi = true; } catch (e) { bildir(hataMetni(e), undefined, true); }
    ciz();
  }

  /* ——— Listeleme ——— */
  function gorunenler(): DosyaKaydi[] {
    let l: DosyaKaydi[];
    const q = katla(s.ara.trim());
    if (q) l = s.tum.filter(k => katla(gorunenAd(k)).includes(q));
    else if (s.yildizli) l = s.tum.filter(k => k.yildiz);
    else l = s.tum.filter(k => k.ust_id === s.klasor);
    const sk = s.sirala;
    return l.sort((a, b) => {
      if (a.tur !== b.tur) return a.tur === 'klasor' ? -1 : 1;
      if (sk === 'tarih') return b.olusturma.localeCompare(a.olusturma);
      if (sk === 'boyut') return (b.boyut ?? 0) - (a.boyut ?? 0);
      return gorunenAd(a).localeCompare(gorunenAd(b), 'tr', { numeric: true });
    });
  }

  /* ——— Üst çubuk ——— */
  function ustCiz() {
    ust.replaceChildren();
    ust.hidden = s.gorunum === 'arsiv';
    if (s.gorunum === 'arsiv') return;
    if (s.gorunum === 'cop') {
      const bos = el('button', 'btn danger sm', 'Çöpü boşalt'); bos.type = 'button';
      bos.disabled = !s.cop.length;
      bos.addEventListener('click', () => void copuBosalt());
      ust.append(el('span', 'dy-not', 'Çöpteki öğeler kalıcı silinene kadar geri getirilebilir.'), el('span', 'tbar-sp'), bos);
      return;
    }
    const yer = el('nav', 'dy-yol'); yer.setAttribute('aria-label', 'Konum');
    const kok0 = el('button', 'dy-yol-b', 'Dosyalarım'); kok0.type = 'button';
    kok0.addEventListener('click', () => { s.klasor = null; s.ara = ''; s.yildizli = false; s.secili.clear(); ciz(); });
    yer.appendChild(kok0);
    yol(s.klasor).forEach(k => {
      yer.appendChild(el('span', 'dy-ayrac', '›'));
      const b = el('button', 'dy-yol-b gz', gorunenAd(k)); b.type = 'button';
      b.addEventListener('click', () => { s.klasor = k.id; s.ara = ''; s.yildizli = false; s.secili.clear(); ciz(); });
      yer.appendChild(b);
    });
    const ara = el('input'); ara.type = 'search'; ara.id = 'dy-ara'; ara.placeholder = 'Tüm dosyalarda ara'; ara.value = s.ara;
    ara.setAttribute('aria-label', 'Dosya ara');
    ara.addEventListener('input', () => { s.ara = ara.value; s.secili.clear(); listeCiz(); });
    const sirala = secim('dy-sirala', [['ad', 'Ada göre'], ['tarih', 'Tarihe göre'], ['boyut', 'Boyuta göre']], s.sirala);
    sirala.setAttribute('aria-label', 'Sırala');
    sirala.addEventListener('change', () => { s.sirala = sirala.value as Sirala; listeCiz(); });
    const yil = el('button', 'btn ghost sm' + (s.yildizli ? ' acik' : ''), '★ Yıldızlılar'); yil.type = 'button';
    yil.addEventListener('click', () => { s.yildizli = !s.yildizli; s.secili.clear(); ciz(); });
    const yeni = el('button', 'btn sm', '＋ Klasör'); yeni.type = 'button';
    yeni.addEventListener('click', () => void klasorEkle());
    const yukleD = el('button', 'btn primary sm', '⬆ Dosya yükle'); yukleD.type = 'button';
    yukleD.addEventListener('click', () => dosyaSec.click());
    const klasorYukle = el('button', 'btn ghost sm', 'Klasör yükle'); klasorYukle.type = 'button';
    klasorYukle.addEventListener('click', () => klasorSec.click());
    const ustSatir = el('div', 'dy-satir');
    const hukukTasi = el('button', 'btn ghost sm', '⚖ Hukuk belgelerini taşı'); hukukTasi.type = 'button';
    hukukTasi.title = 'Bilgisayardaki dava klasörlerini ilgili dava ve icra dosyalarına yükle';
    hukukTasi.addEventListener('click', () => hukukSec.click());
    ustSatir.append(yer, el('span', 'tbar-sp'), yukleD, klasorYukle, hukukTasi, yeni);
    const altSatir = el('div', 'dy-satir');
    altSatir.append(ara, sirala, yil, el('span', 'tbar-sp'), el('span', 'dy-not', s.mesgul));
    ust.append(ustSatir, altSatir);
  }

  /* ——— Liste ——— */
  function listeCiz() {
    const eski = icerik.querySelector('.dy-liste');
    const yeni = listeUret();
    if (eski) eski.replaceWith(yeni); else icerik.appendChild(yeni);
    ozetCiz();
  }
  function ozetCiz() {
    icerik.querySelector('.dy-ozet')?.remove();
    if (s.gorunum !== 'dosyalarim' || s.yukleniyor) return;
    const dosyalar = s.tum.filter(k => k.tur === 'dosya');
    const toplam = dosyalar.reduce((t, k) => t + (k.boyut ?? 0), 0);
    const o = el('p', 'dy-ozet', `${dosyalar.length} dosya · ${s.tum.length - dosyalar.length} klasör · ${bayt(toplam) || '0 KB'} kullanılıyor · dosya başına en fazla ${bayt(AZAMI_DOSYA)}`);
    icerik.appendChild(o);
  }

  function seciliBar(): HTMLElement | null {
    if (!s.secili.size) return null;
    const b = el('div', 'dy-toplu');
    b.appendChild(el('b', '', `${s.secili.size} seçili`));
    const tasiD = el('button', 'btn sm', 'Taşı'); tasiD.type = 'button';
    tasiD.addEventListener('click', () => tasiSor([...s.secili].map(i => bul(i)).filter((k): k is DosyaKaydi => !!k)));
    const sil = el('button', 'btn danger sm', 'Sil'); sil.type = 'button';
    sil.addEventListener('click', () => void sil_([...s.secili].map(i => bul(i)).filter((k): k is DosyaKaydi => !!k)));
    const kaldir = el('button', 'btn ghost sm', 'Seçimi kaldır'); kaldir.type = 'button';
    kaldir.addEventListener('click', () => { s.secili.clear(); listeCiz(); });
    b.append(tasiD, sil, kaldir);
    return b;
  }

  function dugme(simgesi: string, baslik: string, f: () => void, sinif = '') {
    const b = el('button', 'dy-i ' + sinif, simgesi); b.type = 'button'; b.title = baslik; b.setAttribute('aria-label', baslik);
    b.addEventListener('click', e => { e.stopPropagation(); f(); });
    return b;
  }

  function listeUret(): HTMLElement {
    const kap = el('div', 'dy-liste');
    const l = gorunenler();
    const toplu = seciliBar();
    if (toplu) kap.appendChild(toplu);
    if (!l.length) {
      kap.appendChild(el('p', 'bos', s.ara ? 'Aramana uyan öğe yok.' : s.yildizli ? 'Yıldızlı öğe yok.' : s.klasor ? 'Bu klasör boş. Dosyaları buraya sürükleyip bırakabilirsin.' : 'Henüz dosya yok. Dosyaları buraya sürükleyip bırak ya da "Dosya yükle"ye bas.'));
      return kap;
    }
    const sarma = el('div', 'tablo-sarma'), tablo = el('table', 'dy-tablo'), bs = el('tr');
    const hepsi = el('input'); hepsi.type = 'checkbox'; hepsi.setAttribute('aria-label', 'Tümünü seç');
    hepsi.checked = l.every(k => s.secili.has(k.id));
    hepsi.addEventListener('change', () => { if (hepsi.checked) l.forEach(k => s.secili.add(k.id)); else s.secili.clear(); listeCiz(); });
    const th0 = el('th'); th0.appendChild(hepsi); bs.appendChild(th0);
    ['Ad', ...(s.ara || s.yildizli ? ['Konum'] : []), 'Boyut', 'Eklenme', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const govde = el('tbody');
    l.forEach(k => {
      const tr = el('tr', 'satir' + (s.secili.has(k.id) ? ' secili' : '')); tr.tabIndex = 0;
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = s.secili.has(k.id); cb.setAttribute('aria-label', gorunenAd(k) + ' seç');
      cb.addEventListener('click', e => e.stopPropagation());
      cb.addEventListener('change', () => { if (cb.checked) s.secili.add(k.id); else s.secili.delete(k.id); listeCiz(); });
      const td0 = el('td'); td0.appendChild(cb);
      const ad = el('td', 'dy-ad');
      ad.append(el('span', 'dy-simge', simge(k)), el('span', k.bag_tur ? 'gz' : '', gorunenAd(k)));
      if (k.bag_tur) ad.appendChild(el('small', 'pill', k.bag_tur === 'dava' ? 'Dava' : 'İcra'));
      if (k.yildiz) ad.appendChild(el('span', 'dy-yildiz', '★'));
      tr.append(td0, ad);
      if (s.ara || s.yildizli) tr.appendChild(el('td', 'dy-konum gz', yolMetni(k.ust_id) || 'Dosyalarım'));
      tr.append(el('td', 'sayi', k.tur === 'dosya' ? bayt(k.boyut) : '—'), el('td', '', tarihYaz(k.olusturma)));
      const is = el('td', 'dy-isl');
      if (k.tur === 'dosya') is.appendChild(dugme('⬇', 'İndir', () => void indir(k)));
      is.append(
        dugme(k.yildiz ? '★' : '☆', k.yildiz ? 'Yıldızı kaldır' : 'Yıldızla', () => void yildizDegistir(k)),
        ...(k.bag_tur ? [] : [dugme('✎', 'Yeniden adlandır', () => void adSor(k))]),
        dugme('⇄', 'Taşı', () => tasiSor([k])),
        dugme('🗑', 'Sil', () => void sil_([k]), 'tehlike'),
      );
      tr.appendChild(is);
      const ac = () => { if (k.tur === 'klasor') { s.klasor = k.id; s.ara = ''; s.yildizli = false; s.secili.clear(); ciz(); } else void onizle(k); };
      tr.addEventListener('click', ac);
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) ac(); });
      govde.appendChild(tr);
    });
    tablo.appendChild(govde); sarma.appendChild(tablo); kap.appendChild(sarma);
    return kap;
  }

  function copCiz() {
    icerik.replaceChildren();
    if (!s.copYuklendi) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    const kimlik = new Set(s.cop.map(k => k.id));
    const ustler = s.cop.filter(k => !k.ust_id || !kimlik.has(k.ust_id));
    if (!ustler.length) { icerik.appendChild(el('p', 'bos', 'Çöp kutusu boş.')); return; }
    const sarma = el('div', 'tablo-sarma'), tablo = el('table', 'dy-tablo'), bs = el('tr');
    ['Ad', 'Boyut', 'Silinme', ''].forEach(x => bs.appendChild(el('th', '', x)));
    tablo.appendChild(el('thead')).appendChild(bs);
    const govde = el('tbody');
    ustler.sort((a, b) => String(b.silindi_at).localeCompare(String(a.silindi_at))).forEach(k => {
      const tr = el('tr', 'satir');
      const ad = el('td', 'dy-ad');
      const icindeki = k.tur === 'klasor' ? altlar(s.cop, k.id).length : 0;
      ad.append(el('span', 'dy-simge', simge(k)), el('span', k.bag_tur ? 'gz' : '', k.ad));
      if (icindeki) ad.appendChild(el('small', 'dy-not', `içinde ${icindeki} öğe`));
      const is = el('td', 'dy-isl');
      const geri = el('button', 'btn ghost sm', 'Geri getir'); geri.type = 'button';
      geri.addEventListener('click', () => void geriAl([k]));
      const sil = el('button', 'btn danger sm', 'Kalıcı sil'); sil.type = 'button';
      sil.addEventListener('click', () => void kalici([k]));
      is.append(geri, sil);
      tr.append(ad, el('td', 'sayi', k.tur === 'dosya' ? bayt(k.boyut) : '—'), el('td', '', k.silindi_at ? tarihYaz(k.silindi_at) : ''), is);
      govde.appendChild(tr);
    });
    tablo.appendChild(govde); sarma.appendChild(tablo); icerik.appendChild(sarma);
  }

  function ciz() {
    sekmeler.querySelectorAll<HTMLElement>('.dy-s').forEach(b => b.classList.toggle('acik', b.dataset.g === s.gorunum));
    sCop.textContent = s.copYuklendi && s.cop.length ? `Çöp kutusu (${s.cop.filter(k => !k.ust_id || !s.cop.some(x => x.id === k.ust_id)).length})` : 'Çöp kutusu';
    ustCiz();
    kart.classList.toggle('dy-arsiv', s.gorunum === 'arsiv');
    if (s.gorunum === 'arsiv') {
      const ic = el('div', 'dy-arsiv-ic');
      icerik.replaceChildren(ic);
      uygulamaSayfasi('app-dosya')(ic);
      return;
    }
    if (s.gorunum === 'cop') { copCiz(); return; }
    icerik.replaceChildren();
    if (s.yukleniyor) { icerik.appendChild(el('p', 'bos', 'Yükleniyor…')); return; }
    if (s.hata) {
      const b = el('button', 'btn ghost sm', 'Tekrar dene'); b.type = 'button'; b.addEventListener('click', () => void yukle());
      icerik.append(el('p', 'bos hata', s.hata), b); return;
    }
    icerik.appendChild(listeUret());
    ozetCiz();
  }

  /* ——— İşlemler ——— */
  async function klasorEkle() {
    const ad = await degerSor({ baslik: 'Yeni klasör', etiket: 'Klasör adı', sinir: 200, kaydet: 'Oluştur' });
    if (ad === null) return;
    if (!ad.trim()) { bildir('Klasör adı boş olamaz', undefined, true); return; }
    try { const k = await klasorOlustur(ad, s.klasor); s.tum.push(k); ciz(); bildir('Klasör oluşturuldu'); }
    catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function adSor(k: DosyaKaydi) {
    const ad = await degerSor({ baslik: 'Yeniden adlandır', etiket: 'Yeni ad', deger: k.ad, sinir: 200 });
    if (ad === null || ad.trim() === k.ad) return;
    if (!ad.trim()) { bildir('Ad boş olamaz', undefined, true); return; }
    try { const g = await adDegistir(k.id, ad); Object.assign(k, g); ciz(); }
    catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function yildizDegistir(k: DosyaKaydi) {
    try { const g = await yildizla(k.id, !k.yildiz); Object.assign(k, g); ciz(); }
    catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  function tasiSor(oge: DosyaKaydi[]) {
    if (!oge.length) return;
    const dislanan = new Set<string>();
    oge.forEach(k => { dislanan.add(k.id); if (k.tur === 'klasor') altlar(s.tum, k.id).forEach(a => dislanan.add(a.id)); });
    const secenek: [string, string][] = [['', 'Dosyalarım (ana klasör)']];
    s.tum.filter(k => k.tur === 'klasor' && !dislanan.has(k.id)).map(k => [k.id, yolMetni(k.id)] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1], 'tr')).forEach(x => secenek.push(x));
    const d = kutu(oge.length === 1 ? `"${gorunenAd(oge[0]!)}" taşı` : `${oge.length} öğeyi taşı`);
    const hedef = secim('dy-hedef', secenek, oge.every(k => k.ust_id === oge[0]!.ust_id) ? oge[0]!.ust_id ?? '' : '');
    d.alan('Hedef klasör', hedef);
    d.kaydet.textContent = 'Taşı';
    d.f.addEventListener('submit', async e => {
      e.preventDefault(); d.kaydet.disabled = true; d.hata.hidden = true;
      try {
        for (const k of oge) { const g = await tasi(k.id, hedef.value || null); Object.assign(k, g); }
        s.secili.clear(); d.dlg.close(); ciz(); bildir('Taşındı');
      } catch (err) { d.kaydet.disabled = false; d.hatayaz(hataMetni(err)); }
    });
    d.bitir();
  }

  async function sil_(oge: DosyaKaydi[]) {
    if (!oge.length) return;
    const ad = oge.length === 1 ? `"${gorunenAd(oge[0]!)}"` : `${oge.length} öğe`;
    const klasorVar = oge.some(k => k.tur === 'klasor');
    if (!(await onayla({ baslik: 'Çöpe taşınsın mı?', metin: `${ad}${klasorVar ? ' ve içindekiler' : ''} çöp kutusuna taşınacak. Oradan geri getirebilirsin.`, evet: 'Çöpe taşı' }))) return;
    try {
      const idler = await copeAt(oge, s.tum);
      const kume = new Set(idler);
      const simdi = new Date().toISOString();
      const tasinan = s.tum.filter(k => kume.has(k.id)).map(k => ({ ...k, silindi_at: simdi }));
      s.tum = s.tum.filter(k => !kume.has(k.id));
      if (s.copYuklendi) s.cop = [...s.cop, ...tasinan];
      s.secili.clear(); ciz();
      bildir('Çöpe taşındı', async () => {
        try {
          await copYukle();
          await geriGetir(oge.map(k => s.cop.find(x => x.id === k.id) ?? { ...k, silindi_at: simdi }), s.cop, s.tum);
          await Promise.all([yukle(), copYukle()]);
          bildir('Geri getirildi');
        } catch (e) { bildir(hataMetni(e), undefined, true); void yukle(); }
      });
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function geriAl(oge: DosyaKaydi[]) {
    try {
      await geriGetir(oge, s.cop, s.tum);
      await Promise.all([yukle(), copYukle()]);
      bildir('Geri getirildi');
    } catch (e) {
      bildir((e as { code?: string }).code === '23505' ? 'Bu klasörün yerine yenisi açılmış; önce onu çöpe taşı ya da yeniden adlandır.' : hataMetni(e), undefined, true);
    }
  }

  async function kalici(oge: DosyaKaydi[]) {
    if (!(await onayla({ baslik: 'Kalıcı olarak silinsin mi?', metin: 'Bu işlem geri alınamaz; dosyaların içeriği de silinir.', evet: 'Kalıcı sil' }))) return;
    try { await kaliciSil(oge, s.cop); await copYukle(); bildir('Kalıcı olarak silindi'); }
    catch (e) { bildir(hataMetni(e), undefined, true); void copYukle(); }
  }
  async function copuBosalt() {
    const kimlik = new Set(s.cop.map(k => k.id));
    const ustler = s.cop.filter(k => !k.ust_id || !kimlik.has(k.ust_id));
    if (!ustler.length) return;
    await kalici(ustler);
  }

  async function indir(k: DosyaKaydi) {
    if (!k.yol) return;
    try {
      const a = el('a'); a.href = await imzaliAdres(k.yol, k.ad, 120); a.download = k.ad; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  }

  async function onizle(k: DosyaKaydi) {
    if (!k.yol) return;
    const mime = k.mime ?? '';
    const dlg = el('dialog', 'kutu genis dy-onizleme'); dlg.setAttribute('aria-label', k.ad);
    dlg.appendChild(el('h2', '', k.ad));
    dlg.appendChild(el('p', 'dy-not', `${bayt(k.boyut)} · ${tarihYaz(k.olusturma)}`));
    const govde = el('div', 'dy-onizleme-govde');
    dlg.appendChild(govde);
    const dugmeler = el('div', 'form-dugmeler');
    const kapat = el('button', 'btn ghost', 'Kapat'); kapat.type = 'button'; kapat.addEventListener('click', () => dlg.close());
    const indirD = el('button', 'btn', '⬇ İndir'); indirD.type = 'button'; indirD.addEventListener('click', () => void indir(k));
    dugmeler.append(indirD);
    if (GUVENLI_TUR.test(mime)) {
      const yeniSekme = el('button', 'btn', 'Yeni sekmede aç'); yeniSekme.type = 'button';
      yeniSekme.addEventListener('click', async () => { try { window.open(await imzaliAdres(k.yol!, undefined, 120), '_blank', 'noopener'); } catch (e) { bildir(hataMetni(e), undefined, true); } });
      dugmeler.append(yeniSekme);
    }
    dugmeler.append(kapat);
    dlg.appendChild(dugmeler);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.appendChild(dlg);
    dlg.showModal();
    govde.appendChild(el('p', 'bos', 'Yükleniyor…'));
    try {
      const adres = await imzaliAdres(k.yol, undefined, 300);
      if (/^image\/(png|jpe?g|webp|gif)$/.test(mime)) {
        const r = el('img'); r.alt = k.ad; r.src = adres; govde.replaceChildren(r);
      } else if (/^text\/(plain|csv)$/.test(mime) || /\.(txt|md|json|csv|log)$/i.test(k.ad)) {
        if ((k.boyut ?? 0) > 1_000_000) { govde.replaceChildren(el('p', 'bos', 'Dosya büyük; indirerek aç.')); return; }
        const t = await (await fetch(adres)).text();
        const pre = el('pre', 'dy-metin'); pre.textContent = t.slice(0, 200_000); govde.replaceChildren(pre);
      } else {
        govde.replaceChildren(el('p', 'bos', mime === 'application/pdf' ? 'PDF için "Yeni sekmede aç"a bas.' : 'Bu tür için önizleme yok; indirerek açabilirsin.'));
      }
    } catch (e) { govde.replaceChildren(el('p', 'bos hata', hataMetni(e))); }
  }

  /* ——— Yükleme ——— */
  type Is = { f: File; yol: string[] };
  let yukleniyor = false;
  type Sayim = { basarili: number; atlanan: number; hatalar: string[] };
  /* Dosyaları verilen klasörün altına yükler; klasör yapısı yol parçalarından kurulur. tekrarAtla: aynı ad ve boyutta dosya varsa yüklemez. */
  async function yukleCekirdek(isler: Is[], kokId: string | null, etiket: (i: number) => string, tekrarAtla: boolean, sayim: Sayim) {
    const klasorler = new Map<string, string | null>([['', kokId]]);
    for (let i = 0; i < isler.length; i++) {
      const { f, yol: y } = isler[i]!;
      s.mesgul = etiket(i); ustCiz();
      try {
        let anahtar = '', ust = kokId;
        for (const parca of y) {
          anahtar += '/' + parca;
          if (!klasorler.has(anahtar)) {
            const var_ = s.tum.find(k => k.tur === 'klasor' && !k.bag_tur && k.ust_id === ust && k.ad === parca);
            const k = var_ ?? await klasorOlustur(parca, ust);
            if (!var_) s.tum.push(k);
            klasorler.set(anahtar, k.id);
          }
          ust = klasorler.get(anahtar)!;
        }
        if (tekrarAtla && s.tum.some(k => k.tur === 'dosya' && k.ust_id === ust && k.ad === f.name.slice(0, 200) && k.boyut === f.size)) { sayim.atlanan++; continue; }
        s.tum.push(await dosyaYukle(f, ust)); sayim.basarili++;
        if (s.gorunum === 'dosyalarim' && i % 5 === 0) listeCiz();
      } catch (e) {
        sayim.hatalar.push(e instanceof Error && e.message.startsWith('boyut:') ? `${f.name} (en fazla ${bayt(AZAMI_DOSYA)})` : `${f.name} (${hataMetni(e)})`);
      }
    }
  }
  function yukleSonuc(sayim: Sayim) {
    yukleniyor = false; s.mesgul = '';
    ciz();
    if (sayim.basarili) bildir(`${sayim.basarili} dosya yüklendi${sayim.atlanan ? `, ${sayim.atlanan} tanesi zaten vardı` : ''}`);
    else if (sayim.atlanan && !sayim.hatalar.length) bildir(`${sayim.atlanan} dosya zaten yüklüydü`);
    if (sayim.hatalar.length) bildir(`Yüklenemedi: ${sayim.hatalar.slice(0, 3).join(', ')}${sayim.hatalar.length > 3 ? ` ve ${sayim.hatalar.length - 3} dosya daha` : ''}`, undefined, true);
  }
  async function yukleIsler(isler: Is[]) {
    if (yukleniyor || !isler.length) return;
    yukleniyor = true;
    const sayim: Sayim = { basarili: 0, atlanan: 0, hatalar: [] };
    await yukleCekirdek(isler, s.klasor, i => `Yükleniyor ${i + 1}/${isler.length}…`, false, sayim);
    yukleSonuc(sayim);
  }

  /* Hukuk belgelerini taşı: her grup, eşleştiği dava/icra kaydının "Belgeler" klasörüne (ya da sıradan klasöre) yüklenir. */
  async function hukukTasiBaslat(hazir: Hazir[]) {
    if (yukleniyor || !hazir.length) return;
    yukleniyor = true;
    const sayim: Sayim = { basarili: 0, atlanan: 0, hatalar: [] };
    const toplam = hazir.reduce((t, h) => t + h.grup.parcalar.length, 0);
    let yapilan = 0;
    for (const h of hazir) {
      try {
        let kok: string | null;
        if (h.hedef === 'normal') {
          const var_ = s.tum.find(k => k.tur === 'klasor' && !k.bag_tur && k.ust_id === s.klasor && k.ad === h.grup.ad);
          const k = var_ ?? await klasorOlustur(h.grup.ad, s.klasor);
          if (!var_) s.tum.push(k);
          kok = k.id;
        } else {
          const k = await bagliKlasor(h.hedef.tur, h.hedef.id);
          if (!s.tum.some(x => x.id === k.id)) s.tum.push(k);
          kok = k.id;
        }
        const taban = yapilan;
        await yukleCekirdek(h.grup.parcalar, kok, i => `Hukuk belgeleri taşınıyor ${taban + i + 1}/${toplam} · ${h.grup.ad}`, true, sayim);
      } catch (e) { sayim.hatalar.push(`${h.grup.ad} klasörü (${hataMetni(e)})`); }
      yapilan += h.grup.parcalar.length;
      if (h.grup.buyuk) sayim.hatalar.push(`${h.grup.ad}: ${h.grup.buyuk} dosya ${bayt(AZAMI_DOSYA)} sınırını aştığı için atlandı`);
    }
    yukleSonuc(sayim);
    void adlariYukle();
  }

  hukukSec.addEventListener('change', async () => {
    const dosyalar = [...(hukukSec.files ?? [])];
    hukukSec.value = '';
    if (!dosyalar.length) return;
    try {
      const [ceza, hukuk, cbs, icra] = await Promise.all([davalariGetir('ceza'), davalariGetir('hukuk'), davalariGetir('cbs'), icraDosyalariniGetir()]);
      const adaylar: Aday[] = [
        ...([['ceza', ceza], ['hukuk', hukuk], ['cbs', cbs]] as [DavaTuru, typeof ceza][]).flatMap(([t, l]) => l.map(d => ({ tur: 'dava' as const, id: d.id, esas: d.dosya_no, etiket: `${DAVA_ADI[t]} davası ${d.dosya_no}${d.konu ? ' · ' + d.konu : ''}` }))),
        ...icra.map(d => ({ tur: 'icra' as const, id: d.id, esas: d.dosya_no ?? '', etiket: `${d.dosya_no ?? '—'}${d.icra_dairesi ? ' · ' + d.icra_dairesi : ''}` })),
      ];
      hukukTasiPenceresi({ dosyalar, adaylar, baslat: hukukTasiBaslat });
    } catch (e) { bildir(hataMetni(e), undefined, true); }
  });

  dosyaSec.addEventListener('change', () => { void yukleIsler([...(dosyaSec.files ?? [])].map(f => ({ f, yol: [] }))); dosyaSec.value = ''; });
  klasorSec.addEventListener('change', () => {
    const isler = [...(klasorSec.files ?? [])].map(f => {
      const parcalar = (f.webkitRelativePath || f.name).split('/'); parcalar.pop();
      return { f, yol: parcalar };
    });
    void yukleIsler(isler); klasorSec.value = '';
  });

  let sayac = 0;
  const surukle = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
  kart.addEventListener('dragenter', e => { if (s.gorunum !== 'dosyalarim' || !surukle(e)) return; e.preventDefault(); sayac++; kart.classList.add('dy-birak'); });
  kart.addEventListener('dragover', e => { if (s.gorunum === 'dosyalarim' && surukle(e)) e.preventDefault(); });
  kart.addEventListener('dragleave', () => { sayac = Math.max(0, sayac - 1); if (!sayac) kart.classList.remove('dy-birak'); });
  kart.addEventListener('drop', e => {
    sayac = 0; kart.classList.remove('dy-birak');
    if (s.gorunum !== 'dosyalarim' || !surukle(e)) return;
    e.preventDefault();
    void yukleIsler([...(e.dataTransfer?.files ?? [])].filter(f => f.size > 0 || f.type).map(f => ({ f, yol: [] })));
  });

  ciz();
  void yukle();
}
