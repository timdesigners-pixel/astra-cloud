/* Komut paleti · arayüz. Ctrl+K / Ctrl+M ile açılır (kabuk/kabuk.ts kısayolu bağlar).
   Sayfalar kabuk/sekmeler.ts'ten okunur; işlemler, ayarlar, hızlı ekleme cümleleri ve sorular aynı kutudan çalışır.
   Çalıştırma kodu (palet/islem.ts) palet ilk kullanıldığında tembel yüklenir. */
import { kacis } from '../../ortak/kacis';
import { SEKMELER, hubBul } from '../../kabuk/sekmeler';
import { istemciAl } from '../../veri/istemci';
import { okunmamislar } from '../../veri/bildirim-durum';
import type { Panel } from '../../veri/panel';
import { DESENLER, hizliCoz } from './desen';
import { puanla, vurguParcalari, type Komut } from './eslestir';
import { AYARLAR, ISLEMLER, ONERILEN } from './katalog';
import { cevapUret, type KisiBorcu } from './soru';

type Baglam = { panel: () => Panel | null; donem: () => string };
let baglam: Baglam | null = null;
export function paletBaglamKur(b: Baglam) { baglam = b; }

const SON = 'astra.palet.son';
const GRUP_AD: Record<string, string> = { cevap: 'CEVAP', 'hızlı': 'HIZLI EKLEME', 'işlem': 'İŞLEMLER', ayar: 'AYARLAR', sayfa: 'SAYFALAR' };
const GRUP_SIRA = ['hızlı', 'işlem', 'ayar', 'sayfa'];
const ORNEKLER = ["Zeki Baba'ya borç ne kadar?", 'bu ay toplam gider', 'kaç görevim var', 'verilerimi yedekle', '1 bardak su içtim',
  "Ahmet'e 500 tl borç ekle", 'market 450 tl gider', 'yarın 10:00 vergi dairesini hatırlat'];

let KATALOG: Komut[] | null = null;
function katalog(): Komut[] {
  if (KATALOG) return KATALOG;
  const sayfalar: Komut[] = SEKMELER.map(s => {
    const hub = hubBul(s.anahtar)?.ad ?? '';
    return { id: 's-' + s.anahtar, tur: 'sayfa', sayfa: s.anahtar, sim: s.glif, ad: s.ad, ac: `${hub} · sayfayı açar`, k: hub };
  });
  KATALOG = [...ISLEMLER.map(c => ({ ...c, tur: 'işlem' })), ...AYARLAR.map(c => ({ ...c, tur: 'ayar' })), ...sayfalar];
  return KATALOG;
}
const komutBul = (id: string) => katalog().find(c => c.id === id);

function sonKomutlar(): string[] {
  try { const l = JSON.parse(localStorage.getItem(SON) ?? '[]'); return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
function sonaYaz(c: Komut) {
  if (c.tur === 'hızlı' || c.tur === 'cevap') return; /* parametreli cümle tekrar yazılır, listeye girmez */
  try { localStorage.setItem(SON, JSON.stringify([c.id, ...sonKomutlar().filter(x => x !== c.id)].slice(0, 5))); } catch { /* yoksay */ }
}

/* Kişi borçları soru-cevap için bir kez okunur (60 sn önbellek). */
let kisiOnbellek: { zaman: number; veri: KisiBorcu[] } | null = null;
async function kisileriYukle(): Promise<KisiBorcu[]> {
  if (kisiOnbellek && Date.now() - kisiOnbellek.zaman < 60000) return kisiOnbellek.veri;
  const db = istemciAl();
  const [k, b] = await Promise.all([
    db.from('kisiler').select('id,ad,takma_adlar').is('silindi_at', null),
    db.from('borclar').select('alacakli_id,guncel_borc,durum,yon,tur').is('silindi_at', null).eq('tur', 'kisi'),
  ]);
  if (k.error) throw k.error;
  if (b.error) throw b.error;
  const veri = (k.data ?? []).map(x => {
    const acik = (b.data ?? []).filter(y => y.alacakli_id === x.id && y.durum !== 'kapandi' && y.yon !== 'alacakli');
    return { ad: String(x.ad), takma: (x.takma_adlar as string[] | null) ?? [], kalan: acik.reduce((t, y) => t + Number(y.guncel_borc), 0), kalem: acik.length };
  });
  kisiOnbellek = { zaman: Date.now(), veri };
  return veri;
}

function cevaplar(q: string): Komut[] {
  const p = baglam?.panel() ?? null;
  const k = baglam;
  if (!p || !k) return [];
  return cevapUret(q, {
    gelir: p.gelir, gider: p.gider, serbest: p.serbest, borc: p.borc, anapara: p.anapara, saglik: p.saglik, saglikEtiket: p.saglikEtiket,
    todoAcik: p.todoAcik, todoGecikmis: p.todoGecikmis, okunmamis: okunmamislar(p.bildirimler).length, yedek: p.yedek,
    donem: (() => { const [y, a] = k.donem().split('-'); return `${['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][+a! - 1]} ${y}`; })(),
    kisiler: kisiOnbellek?.veri ?? [], gizli: document.body.classList.contains('gizli'),
  });
}

/* Sorgunun sonuç listesi: [{c, grup}] — grup başlığı çizim içindir. */
function sonuclar(q: string): { c: Komut; grup: string }[] {
  const t = q.trim();
  if (!t) {
    const son = sonKomutlar().map(komutBul).filter((c): c is Komut => !!c);
    const oner = ONERILEN.map(komutBul).filter((c): c is Komut => !!c && !son.includes(c));
    return [...son.map(c => ({ c, grup: 'SON KULLANILAN' })), ...oner.map(c => ({ c, grup: 'ÖNERİLEN' }))];
  }
  const hizli = hizliCoz(t);
  /* Ekleme cümlesi olarak çözülen girdiye cevap kartı çıkmaz ("Ahmet'e 500 tl borç ekle" bir komuttur). */
  const eylemli = hizli.some(h => !['Gezinme', 'Araç', 'Ayar'].includes(h.grup ?? ''));
  const cev = eylemli ? [] : cevaplar(t);
  const bulunan = puanla(katalog(), t);
  if (!cev.length && !hizli.length && !bulunan.length) return [];
  const sirala = (l: Komut[]) => [...l].sort((a, b) => GRUP_SIRA.indexOf(a.tur) - GRUP_SIRA.indexOf(b.tur));
  if (cev.length) return [...cev.map(c => ({ c, grup: 'CEVAP' })), ...sirala([...hizli, ...bulunan]).map(c => ({ c, grup: GRUP_AD[c.tur] ?? '' }))];
  const ilk = hizli[0] ?? bulunan[0]!;
  return [{ c: ilk, grup: 'EN İYİ EŞLEŞME' }, ...sirala([...hizli, ...bulunan].filter(c => c !== ilk)).map(c => ({ c, grup: GRUP_AD[c.tur] ?? '' }))];
}

let palet: (HTMLElement & { _ciz?: () => void; _q?: HTMLInputElement }) | null = null;
let oncekiOdak: Element | null = null;

function paletKur() {
  if (palet && palet.isConnected) return palet;
  palet = document.createElement('div');
  palet.id = 'palet';
  palet.hidden = true;
  palet.innerHTML = `
    <div class="palet-ort" role="dialog" aria-modal="true" aria-label="Komut paleti">
      <div class="palet-giris">
        <span class="palet-ok" aria-hidden="true">›</span>
        <input id="paletq" type="text" placeholder="Sor ya da yaz: Zeki Baba'ya borç ne kadar? · verilerimi yedekle · 1 bardak su içtim" autocomplete="off" spellcheck="false"
               role="combobox" aria-label="Komut ya da sayfa ara" aria-controls="paletlist" aria-expanded="true" aria-autocomplete="list">
        <kbd>esc</kbd>
      </div>
      <div class="palet-ornek" aria-label="Örnek komutlar"><span>DENE</span>${ORNEKLER.map(o => `<button type="button" class="palet-cip" data-ornek="${kacis(o)}" tabindex="-1">${kacis(o)}</button>`).join('')}</div>
      <div class="palet-govde">
        <ul id="paletlist" role="listbox" aria-label="Sonuçlar"></ul>
        <div class="palet-oniz" id="paletoniz" aria-live="polite"></div>
      </div>
      <div class="palet-alt"><span><kbd>↑↓</kbd> gez</span><span><kbd>↵</kbd> çalıştır</span><span><kbd>esc</kbd> kapat</span><span class="palet-sayac" id="paletsayac"></span></div>
    </div>`;
  document.body.appendChild(palet);

  const q = palet.querySelector<HTMLInputElement>('#paletq')!;
  const liste = palet.querySelector<HTMLElement>('#paletlist')!;
  const oniz = palet.querySelector<HTMLElement>('#paletoniz')!;
  const sayac = palet.querySelector<HTMLElement>('#paletsayac')!;
  let secili = 0, sonuc: { c: Komut; grup: string }[] = [];

  const adHTML = (ad: string) => q.value.trim()
    ? vurguParcalari(ad, q.value).map(p => (p.es ? `<mark>${kacis(p.t)}</mark>` : kacis(p.t))).join('')
    : kacis(ad);

  const onizle = () => {
    const s = sonuc[secili];
    if (!s) { oniz.innerHTML = '<p class="palet-ipucu">Yazdıkça seçili komutun ne yapacağı burada görünür.</p>'; return; }
    const c = s.c;
    const anahtar = c.tur === 'hızlı' || c.tur === 'cevap' ? [] : String(c.k || '').split(/\s+/).filter(Boolean).slice(0, 10);
    const ornek = c.tur === 'hızlı' ? DESENLER.find(d => d.id === c.desen)?.ornek : '';
    oniz.innerHTML = `
      <div class="palet-tur">${kacis((GRUP_AD[c.tur] ?? '').replace(/LER$|LAR$/, ''))}${s.grup ? ' · ' + kacis(s.grup.toLocaleUpperCase('tr')) : ''}</div>
      <h3>${kacis(c.ad)}</h3>
      <p style="white-space:pre-line">${kacis(c.ac || '')}</p>
      ${ornek ? `<div class="palet-alan"><b>ÖRNEK CÜMLE</b><code>${kacis(ornek)}</code></div>` : ''}
      ${anahtar.length ? `<div class="palet-alan"><b>BU SÖZCÜKLERLE BULUNUR</b><div class="palet-anahtar">${anahtar.map(k => `<i>${kacis(k)}</i>`).join('')}</div></div>` : ''}
      ${c.tur === 'cevap' && !c.eylem ? '' : `<button type="button" class="btn sm palet-calistir" data-calistir tabindex="-1">${kacis(c.eylemAd || 'Çalıştır ↵')}</button>`}`;
  };

  const ciz = () => {
    sonuc = sonuclar(q.value);
    if (secili >= sonuc.length) secili = 0;
    let h = '', g = '';
    sonuc.forEach((s, i) => {
      if (s.grup !== g) { g = s.grup; h += `<li class="palet-grup" role="presentation">${kacis(g)}</li>`; }
      const obek = s.c.tur === 'sayfa' ? (hubBul(s.c.sayfa ?? '')?.ad ?? 'sayfa') : s.c.tur;
      h += `<li role="option" id="palet-${i}" aria-selected="${i === secili}" class="${i === secili ? 'sec' : ''}" data-i="${i}">
         <span class="palet-sim" aria-hidden="true">${kacis(s.c.sim || '·')}</span><span class="palet-ad">${adHTML(s.c.ad)}</span><span class="palet-obek">${kacis(obek)}</span></li>`;
    });
    liste.innerHTML = h || `<li class="palet-bos" role="option" aria-selected="false">“${kacis(q.value.trim())}” için bir şey bulunamadı — yedek, görev, borç, su gibi bir sözcük dene</li>`;
    q.setAttribute('aria-activedescendant', sonuc.length ? 'palet-' + secili : '');
    sayac.textContent = q.value.trim() ? sonuc.length + ' sonuç' : katalog().length + ' komut · ' + DESENLER.length + ' hızlı ekleme';
    onizle();
    liste.querySelector('li.sec')?.scrollIntoView?.({ block: 'nearest' });
  };

  const calistir = (s?: { c: Komut; grup: string }) => {
    if (!s) return;
    const islem = import('./islem');
    if (s.c.tur === 'cevap') { if (!s.c.eylem) return; paletKapat(); void islem.then(m => m.cevapCalistir(s.c)); return; }
    paletKapat();
    sonaYaz(s.c);
    void islem.then(m => m.komutCalistir(s.c));
  };

  q.addEventListener('input', () => {
    secili = 0; ciz();
    /* Soru-cevap kişi borçlarını bir kez okur; gelince liste yeniden çizilir. */
    if (!kisiOnbellek && /bor[cç]/i.test(q.value)) void kisileriYukle().then(() => { if (palet && !palet.hidden) ciz(); }).catch(() => { /* kişi cevapları çıkmaz */ });
  });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); secili = Math.min(sonuc.length - 1, secili + 1); ciz(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); secili = Math.max(0, secili - 1); ciz(); }
    else if (e.key === 'Enter') { e.preventDefault(); calistir(sonuc[secili]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); paletKapat(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  liste.addEventListener('mousemove', e => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-i]');
    if (li && +li.dataset.i! !== secili) { secili = +li.dataset.i!; ciz(); }
  });
  liste.addEventListener('click', e => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-i]');
    if (li) calistir(sonuc[+li.dataset.i!]);
  });
  palet.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const o = t.closest<HTMLElement>('[data-ornek]');
    if (o) { q.value = o.dataset.ornek!; secili = 0; ciz(); q.focus(); if (/bor[cç]/i.test(q.value)) void kisileriYukle().then(() => { if (palet && !palet.hidden) ciz(); }).catch(() => { /* yoksay */ }); return; }
    if (t.closest('[data-calistir]')) calistir(sonuc[secili]);
  });
  palet.addEventListener('mousedown', e => { if (e.target === palet) paletKapat(); });

  palet._ciz = ciz;
  palet._q = q;
  return palet;
}

/* odagiGeriVer=false: palet bir odak olayıyla (kenar çubuğu arama kutusu) açıldıysa kapanınca o kutuya dönülmez, yoksa yeniden açılırdı. */
export function paletAc(baslangic = '', odagiGeriVer = true) {
  const p = paletKur();
  if (!p.hidden) { p._q!.focus(); return; }
  oncekiOdak = odagiGeriVer ? document.activeElement : null;
  p.hidden = false;
  document.body.classList.add('palet-acik');
  p._q!.value = baslangic;
  p._ciz!();
  p._q!.focus();
}

export function paletKapat() {
  if (!palet || palet.hidden) return;
  palet.hidden = true;
  document.body.classList.remove('palet-acik');
  (palet as HTMLElement & { _q?: HTMLInputElement })._q?.blur();
  if (oncekiOdak instanceof HTMLElement) oncekiOdak.focus();
}
export const paletAcikMi = () => !!palet && !palet.hidden;
