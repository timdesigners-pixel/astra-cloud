/* ================= ZİHİN SARAYI — BLOK DÜZENLEYİCİ =================
   Bir sayfa, Notion sayfası gibi açılır: simge, başlık, öne çıkarma ve "önemli" işareti ve bloklardan
   oluşan içerik. Düzenleyici WYSIWYG'dir: metin blokları contenteditable; seçili metin kalın / italik /
   altı çizili / üstü çizili / vurgulu (renkli) / kod / bağlantı yapılabilir. "/" blok menüsünü, "@" sayfa
   ve bağlantı anmasını açar; satır başındaki "# ", "- ", "1. ", "[] ", "> ", "---" kısayolları bloğu
   dönüştürür. Boş bloğa yapıştırılan bağlantı türüne göre YouTube videosu, ürün kartı ya da bağlantı
   önizlemesi olur. Metin blokları yazarken sessizce kaydedilir (çizim yok, imleç kaymaz); blok
   ekleme/silme/taşıma gibi yapısal işlemler paneli yeniden çizer. Her içerik kaydedilmeden ve
   çizilmeden önce temizHTML'den geçer. */
import './zihin.css';
import { bildir } from '../../ortak/bildirim';
import { degerSor } from '../../ortak/kutu';
import { hataMetni } from '../../veri/hata';
import { AZAMI_DOSYA, bagTuru, boyutYaz, magazaOf, siteAdi, youtubeId } from './baglanti';
import {
  BICIM, DILLER, EK, IKONLAR, RENK, baglam, baglantiKart, bloklarHTML, bloklarMetin, bloklarOf, butonHTML, dosyaKart, galeriHTML,
  gorselEtiket, kaynaklariCoz, kolonlarOf, linkHTML, sayfaKart, urunKart, urunYenile, yeniBlok, youtubeHTML, type Blok,
} from './bloklar';
import { dosyaYukle, type Yuklenen } from './depo';
import { renklendir } from './kod-renk';
import { olaySifirla, olaylariBagla, onDegis, onTik } from './olay';
import { hucreYaz, sayisal, sutunToplam, tabloSirala, type Tablo } from './tablo-hesap';
import { VURGU_RENK, esc, temizHTML } from './temiz-html';

export type Sayfa = {
  id: string; baslik: string; ikon: string | null; bloklar: Blok[]; one: boolean; onemli: boolean;
  onemli_not: string | null; onemli_renk: string | null; icerik: string;
};
export type Eylem = { etiket: string; id: string; sinif?: string; tikla: () => void };
export type EditorAyar = {
  kok: HTMLElement;
  al: () => Sayfa | undefined;
  degisti: () => void;
  yol: (g: Sayfa) => string;
  sayfalar: () => { id: string; ad: string; ikon: string; yol: string }[];
  sayfaAc: (id: string) => void;
  eylemler: () => Eylem[];
};
export type Editor = { yenile: () => void; bosalt: () => void; kapat: () => void };

const METIN = ['p', 'h2', 'h3', 'madde', 'sirali', 'yapilacak', 'alinti', 'callout'];
const SATIR_ICI = new Set(['emoji', 'ikon']);
const EK_TURU: [string, string, string, string][] = [
  ['dosya', '⎘', 'Dosya', 'Excel, PDF, görsel, zip, csv, Word, txt, sunum'],
  ['kod', '</>', 'Kod bloğu', 'dile göre sözdizimi renklendirme'],
  ['satir', '▥', 'Satır (12 kolon)', 'yan yana sütunlar'],
  ['tablo', '▦', 'Tablo', 'başlık, biçim, otomatik toplam, sıralama'],
  ['buton', '▭', 'Buton', 'bağlantıya giden düğme'],
  ['link', '⇗', 'Bağlantı', 'sade bağlantı satırı'],
  ['sayfaBag', '⇲', 'Sayfaya bağlantı', 'başka bir Zihin Sarayı sayfası'],
  ['emoji', '☺', 'Emoji', 'imlecin olduğu yere'],
  ['ikon', '✦', 'İkon', 'imlecin olduğu yere simge'],
];
export const BLOK_TURU: [string, string, string, string][] = [
  ['p', '¶', 'Metin', 'düz paragraf'], ['h2', 'H', 'Başlık', 'büyük başlık · kısayol "# "'], ['h3', 'h', 'Alt başlık', 'kısayol "## "'],
  ['madde', '•', 'Madde listesi', 'kısayol "- "'], ['sirali', '1.', 'Numaralı liste', 'kısayol "1. "'],
  ['yapilacak', '☐', 'Yapılacak listesi', 'işaretlenebilir · kısayol "[] "'], ['alinti', '❝', 'Alıntı', 'kısayol "> "'],
  ['callout', 'ⓘ', 'Call-out', 'simgeli, renkli not kutusu'], ['ayrac', '—', 'Ayraç', 'yatay çizgi · kısayol "---"'],
  ['gorsel', '▣', 'Görsel', 'dosyadan ya da adresten'], ['galeri', '▤', 'Galeri (karüsel)', 'çok slaytlı görsel galerisi'],
  ['youtube', '▶︎', 'YouTube videosu', 'bağlantıyı yapıştır, sayfaya gömülür'], ['baglanti', '↗', 'Bağlantı önizlemesi', 'başlık, açıklama, görsel'],
  ['urun', '⊞', 'Ürün kartı', 'Trendyol, Hepsiburada, n11, PTT AVM, GittiGidiyor'],
  ...EK_TURU,
];
const PH: Record<string, string> = { p: '"/" ile blok ekle, "@" ile an…', h2: 'Başlık', h3: 'Alt başlık', madde: 'Liste öğesi', sirali: 'Liste öğesi', yapilacak: 'Yapılacak', alinti: 'Alıntı', callout: 'Not yaz…' };
export const EMOJILER = ('😀 😁 😂 🙂 😉 😊 😍 🤩 😎 🤔 😐 😴 😅 😬 😢 😭 😡 🤯 🥳 😇 🙏 👍 👎 👏 🙌 💪 👀 🤝 ✌️ 👌 '
  + '🔥 ✨ ⭐ 🌟 💡 ✅ ❌ ⚠️ ❗ ❓ 💯 🎯 🚀 📌 📍 📎 🔗 🔒 🔑 🛡️ ⚖️ 🏛️ 📜 📝 📄 📁 📂 🗂️ 📊 '
  + '📈 📉 💰 💵 💳 🏦 🧾 🛒 🎁 🏠 🚗 ✈️ 🧭 🗓️ ⏰ ⏳ 📅 📞 ✉️ 📧 💬 🧠 🤖 💻 🖥️ 📱 ⚙️ 🛠️ 🧩 '
  + '🎨 🖌️ 📷 🎬 🎵 📚 🎓 🏆 🥇 ❤️ 💙 💚 💛 💜 🖤 🍀 🌱 🌍 ☀️ 🌙 ☕ 🍎').split(' ');
export const SEMBOLLER = ['ⓘ', '★', '☆', '⚑', '⚐', '⚠︎', '✦', '✧', '◆', '◇', '●', '○', '■', '□', '▲', '▼', '►', '◄', '✔︎', '✘',
  '☑', '☐', '✎', '✂︎', '⚖︎', '⌂', '✉︎', '☎︎', '♥︎', '☀︎', '☁︎', '☂︎', '✈︎', '⚙︎', '⚡︎', '♻︎', '⚓︎', '‼︎', '❖', '☰',
  '→', '←', '↑', '↓', '↗', '↘', '⇄', '⟳', '∞', '≈', '≠', '±', '×', '÷', '∑', '√', '€', '$', '₺', '£', '%', '#', '§', '¶', '©', '®', '™', '⌘'];
const DUZENLER = [[12], [6, 6], [4, 4, 4], [3, 3, 3, 3], [8, 4], [4, 8], [9, 3], [3, 9], [3, 6, 3], [2, 8, 2]];
const KISAYOL: [RegExp, string][] = [[/^#\s$/, 'h2'], [/^##\s$/, 'h3'], [/^[-*]\s$/, 'madde'], [/^1[.)]\s$/, 'sirali'], [/^\[\s?\]\s$/, 'yapilacak'], [/^>\s$/, 'alinti'], [/^!\s$/, 'callout']];
const KIP_ANAHTAR = 'astra.zihin.kip';
const GERI_AL_SINIR = 40;

type Menu = {
  el: HTMLElement; ogeler: MenuOge[]; secili: number; filtre: string; secince: (o: MenuOge) => void; baslik?: string; sinir: number;
  gorunen?: MenuOge[]; egik?: { bid: string }; anma?: boolean;
};
type MenuOge = { ikon?: string; ad: string; ipucu?: string; tip?: string; deger?: string; baglanti?: boolean; sayfaId?: string };
type Odak = { bid: string; son?: boolean } | null;

const kipOku = (): 'duzen' | 'onizle' => { try { return localStorage.getItem(KIP_ANAHTAR) === 'onizle' ? 'onizle' : 'duzen'; } catch { return 'duzen'; } };
const kipYaz = (k: string) => { try { localStorage.setItem(KIP_ANAHTAR, k); } catch { /* yok say */ } };
const sayiya = (v: string): number => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };

export function editorAc(ayar: EditorAyar): Editor {
  const kok = ayar.kok;
  let kip: 'duzen' | 'onizle' = kipOku();
  let menu: Menu | null = null;
  let sonEd: HTMLElement | null = null;
  let zaman: number | undefined;
  let metinSnapshot = 0;
  const geriler: string[] = [];
  let kapali = false;

  const x = () => ayar.al();
  const B = (): Blok[] => { const g = x()!; if (!Array.isArray(g.bloklar) || (!g.bloklar.length && String(g.icerik || '').trim())) g.bloklar = bloklarOf(g); return g.bloklar; };
  const panel = () => kok.querySelector<HTMLElement>('.tp-panel');

  /* Bir bloğu (sütunların içindekiler dahil) bulur: {L: bulunduğu liste, i, b}. */
  function bul(bid: string, L: Blok[] = B()): { L: Blok[]; i: number; b: Blok } | null {
    const id = String(bid);
    for (let i = 0; i < L.length; i++) {
      const b = L[i]!;
      if (String(b.id) === id) return { L, i, b };
      if (b.tip === 'satir') for (const k of kolonlarOf(b)) { const s = bul(id, k.bloklar); if (s) return s; }
    }
    return null;
  }
  baglam.blokBul = bid => bul(bid)?.b;
  baglam.degisti = () => { kaydet(); if (!kapali) ciz(); };
  baglam.sayfaBul = id => { const s = ayar.sayfalar().find(y => y.id === id); return s ? { ikon: s.ikon, ad: s.ad, yol: s.yol } : null; };
  baglam.sayfaAc = id => ayar.sayfaAc(id);

  /* ---------- kayıt ve geri alma ---------- */
  function snapshotAl(zorla = false) {
    const g = x(); if (!g) return;
    const simdi = Date.now();
    if (!zorla && simdi - metinSnapshot < 3000) return;
    metinSnapshot = simdi;
    const s = JSON.stringify(g.bloklar);
    if (geriler[geriler.length - 1] !== s) { geriler.push(s); if (geriler.length > GERI_AL_SINIR) geriler.shift(); }
  }
  function kaydet() {
    const g = x(); if (!g) return;
    g.icerik = bloklarMetin(g.bloklar);
    ayar.degisti();
  }
  function metniYaz(el: HTMLElement) {
    const k = bul(el.dataset.bid!); if (!k) return;
    const b = k.b, h = temizHTML(el.innerHTML);
    if (h === (b.html || '')) return;
    snapshotAl(); b.html = h;
    clearTimeout(zaman); zaman = window.setTimeout(kaydet, 350);
  }
  function yapisal(fn: () => void, odak?: Odak) { snapshotAl(true); fn(); kaydet(); ciz(odak); }
  function geriAl() {
    const g = x(); const s = geriler.pop();
    if (!g || !s) { bildir('Geri alınacak bir değişiklik yok.', undefined, true); return; }
    g.bloklar = JSON.parse(s) as Blok[]; kaydet(); ciz();
  }
  const sessizKaydet = () => { clearTimeout(zaman); zaman = window.setTimeout(kaydet, 350); };

  /* Ek blokların düzenleyiciden kullandığı araçlar. */
  const A = {
    yapisal: (fn: () => void, odak?: Odak) => yapisal(fn, odak),
    degisim: () => snapshotAl(),
    sessizKaydet,
    dosyaSec: (kabul: string, coklu: boolean, fn: (F: File[]) => void) => dosyaSec(kabul, coklu, fn),
    blok: (bid: string) => bul(bid)?.b,
    listeCiz: (L: Blok[]) => bloklar(L, true),
    blokMenu: (el: HTMLElement, L: Blok[]) => blokMenu(el, L.length, L),
    simgeSec: (el: HTMLElement, fn: (v: string) => void) => ikonSec(el, fn),
    get gid() { return x()?.id; },
  };

  /* ---------- çizim ---------- */
  const secenek = (ad: string, deger: unknown, S2: Record<string, string>, yaz: (v: string) => void) => `<label class="tp-oz"><span>${ad}</span><select ${onDegis(el => yapisal(() => yaz(el.value)))}>
    ${Object.entries(S2).map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(deger ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const alan = (et: string, deger: unknown, yaz: (v: string) => void, ek = '') => `<label class="tp-oz"><span>${et}</span><input value="${esc(deger ?? '')}" ${ek} ${onDegis(el => yapisal(() => yaz(el.value)))}></label>`;

  function onemliBolum(g: Sayfa) {
    if (!g.onemli) return '';
    const renk = g.onemli_renk || 'kirmizi';
    return `<div class="zk-callout zk-onemli tp-onemli" style="--c:${RENK[renk] || RENK.kirmizi}">
      <span class="zk-ikon">${esc(g.ikon || '‼︎')}</span>
      <div style="flex:1;min-width:0"><b>Önemli</b>
        <input class="tp-onemli-not" value="${esc(g.onemli_not || '')}" maxlength="300" placeholder="neden önemli? (isteğe bağlı)" ${onDegis(el => yapisal(() => { g.onemli_not = el.value.trim() || null; }))}></div>
      <select class="xs" aria-label="renk" ${onDegis(el => yapisal(() => { g.onemli_renk = el.value; }))}>
        ${Object.keys(RENK).map(k => `<option value="${k}" ${renk === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
    </div>`;
  }
  function bicimCubugu() {
    const b = (k: string, et: string, ipucu: string) => `<button type="button" data-bicim="${k}" title="${ipucu}">${et}</button>`;
    return `<div class="tp-bicim" role="toolbar" aria-label="biçim">
      ${b('bold', '<b>B</b>', 'Kalın (Ctrl+B)')}${b('italic', '<i>I</i>', 'İtalik (Ctrl+I)')}${b('underline', '<u>U</u>', 'Altı çizili (Ctrl+U)')}${b('strikeThrough', '<s>S</s>', 'Üstü çizili')}
      <span class="tp-ayir"></span>
      ${VURGU_RENK.map(r => `<button type="button" data-vurgu="${r}" class="tp-vurgu" title="Vurgula — ${r}"><mark data-renk="${r}">A</mark></button>`).join('')}
      <button type="button" data-vurgu="" title="Vurguyu kaldır">⌫</button>
      <span class="tp-ayir"></span>
      ${b('code', '‹›', 'Satır içi kod')}${b('link', '↗', 'Bağlantı (Ctrl+K)')}${b('anma', '@', 'Sayfa ya da bağlantı an')}${b('emoji', '☺', 'Emoji ekle')}${b('ikon', '✦', 'İkon ekle')}${b('temizle', 'Tx', 'Biçimi temizle')}
      <span class="tp-ayir"></span>
      <button type="button" data-tp="blok-menu" title="Blok ekle">＋ Blok</button>
      <button type="button" data-tp="geri-al" title="Son yapısal değişikliği geri al">↶</button>
    </div>`;
  }
  function metinBlok(b: Blok, i: number, liste: number) {
    const ed = `<div class="zk-ed zk-${esc(b.tip)}" contenteditable="true" spellcheck="true" data-bid="${esc(b.id)}" data-ph="${esc(PH[b.tip] || '')}">${temizHTML(b.html)}</div>`;
    if (b.tip === 'madde') return `<div class="tp-lst"><span class="tp-isaret">•</span>${ed}</div>`;
    if (b.tip === 'sirali') return `<div class="tp-lst"><span class="tp-isaret mono">${liste}.</span>${ed}</div>`;
    if (b.tip === 'yapilacak') return `<div class="tp-lst zk-yap${b.done ? ' bitti' : ''}"><input type="checkbox" ${b.done ? 'checked' : ''} aria-label="tamamlandı" ${onDegis(el => yapisal(() => { b.done = el.checked; }))}>${ed}</div>`;
    if (b.tip === 'callout') return `<div class="zk-callout" style="--c:${RENK[b.renk] || RENK.sari}">
      <button type="button" class="zk-ikon" title="simgeyi değiştir" ${onTik(el => ikonSec(el, v => yapisal(() => { b.ikon = v; })))}>${esc(b.ikon || 'ⓘ')}</button>${ed}
      <select class="xs tp-renk" aria-label="renk" ${onDegis(el => yapisal(() => { b.renk = el.value; }))}>${Object.keys(RENK).map(k => `<option value="${k}" ${(b.renk || 'sari') === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>`;
    void i;
    return ed;
  }
  function gorselSec(b: Blok, coklu: boolean) {
    dosyaSec('image/*', coklu, async F => {
      const D = await yukle(F, true); if (!D.length) return;
      if (coklu) yapisal(() => { b.gorseller.push(...D.map(d => ({ yol: d.yol, alt: '' }))); });
      else yapisal(() => { b.yol = D[0]!.yol; delete b.src; });
    });
  }
  function medyaBlok(b: Blok): string {
    if (b.tip === 'ayrac') return '<hr class="zk-ayrac">';
    if (b.tip === 'gorsel') return `${gorselEtiket({ src: b.src, yol: b.yol }, `alt="${esc(b.alt || '')}"`) ? `<figure class="zk-gorsel">${gorselEtiket({ src: b.src, yol: b.yol }, `alt="${esc(b.alt || '')}"`)}</figure>` : '<div class="tp-bos">Görsel seçilmedi</div>'}
      <div class="tp-medya-arac"><button class="btn ghost xs" type="button" ${onTik(() => gorselSec(b, false))}>▣ Dosyadan</button>
        ${alan('Adres', b.src, v => { if (/^https:\/\//i.test(v.trim())) { b.src = v.trim(); delete b.yol; } }, 'placeholder="https://…"')}
        ${alan('Açıklama', b.alt, v => { b.alt = v; })}</div>`;
    if (b.tip === 'galeri') {
      const G = (b.gorseller || (b.gorseller = [])) as { src?: string; yol?: string; alt?: string }[];
      return `${galeriHTML(b) || '<div class="tp-bos">Galeri boş — görsel ekle</div>'}
        <div class="tp-galeri-seridi">${G.map((g, i) => `<div class="tp-kucuk">${gorselEtiket(g, 'alt=""')}
          <input class="xs" value="${esc(g.alt || '')}" placeholder="açıklama" ${onDegis(el => yapisal(() => { g.alt = el.value; }))}>
          <span><button type="button" class="td-x" title="sola" ${i ? '' : 'disabled'} ${onTik(() => yapisal(() => { G.splice(i - 1, 0, G.splice(i, 1)[0]!); }))}>‹</button>
          <button type="button" class="td-x" title="kaldır" ${onTik(() => yapisal(() => { G.splice(i, 1); }))}>×</button>
          <button type="button" class="td-x" title="sağa" ${i < G.length - 1 ? '' : 'disabled'} ${onTik(() => yapisal(() => { G.splice(i + 1, 0, G.splice(i, 1)[0]!); }))}>›</button></span></div>`).join('')}</div>
        <div class="tp-medya-arac"><button class="btn ghost xs" type="button" ${onTik(() => gorselSec(b, true))}>▣ Görsel ekle</button>
          ${alan('Adresten ekle', '', v => { if (/^https:\/\//i.test(v.trim())) G.push({ src: v.trim(), alt: '' }); }, 'placeholder="https://…/gorsel.jpg"')}</div>`;
    }
    if (b.tip === 'youtube') return `${youtubeHTML(b) || '<div class="tp-bos">Geçerli bir YouTube bağlantısı yapıştır</div>'}
      <div class="tp-medya-arac">${alan('YouTube bağlantısı', b.url, v => { b.url = v.trim(); b.vid = youtubeId(b.url); }, 'placeholder="https://youtu.be/…"')}</div>`;
    if (b.tip === 'baglanti') return `${b.url ? baglantiKart(b) : '<div class="tp-bos">Bağlantı yapıştır</div>'}${b.yukleniyor ? '<div class="tp-ipucu">önizleme alınıyor…</div>' : ''}
      <div class="tp-medya-arac">${alan('Adres', b.url, v => { b.url = v.trim(); void bilgiAl(b); }, 'placeholder="https://…"')}
        ${alan('Başlık', b.baslik, v => { b.baslik = v; })}
        <button class="btn ghost xs" type="button" ${onTik(() => { void urunYenile(b.id); })}>↻ önizlemeyi yenile</button></div>`;
    if (b.tip === 'urun') return `${b.url ? urunKart(b) : '<div class="tp-bos">Ürün bağlantısını yapıştır (Trendyol, Hepsiburada, n11, PTT AVM, GittiGidiyor…)</div>'}
      ${b.yukleniyor ? '<div class="tp-ipucu">ürün bilgisi alınıyor…</div>' : ''}
      <div class="tp-medya-arac tp-urun-al">
        <label class="tp-oz" style="flex:1"><span>Ürün bağlantısı</span><input value="${esc(b.url || '')}" placeholder="https://www.pttavm.com/…" data-tp="urun-url"
          ${onDegis(el => { const v = el.value.trim(); if (v !== (b.url || '')) { snapshotAl(true); b.url = v; b.magaza = magazaOf(v); kaydet(); } })}></label>
        <button class="btn sm" type="button" title="görsel, fiyat, başlık, platform ve puanı sayfadan al" ${b.yukleniyor ? 'disabled' : ''} ${onTik(el => { void urunBilgiAl(b, el); })}>⤓ Bilgileri al</button>
      </div>
      <details class="tp-elle"${b.url && (b.fiyat === null || b.fiyat === undefined) && !b.yukleniyor ? ' open' : ''}><summary>Bilgileri elle düzenle</summary><div class="tp-medya-arac">
        ${alan('Ürün adı', b.baslik, v => { b.baslik = v; })}
        ${alan('Fiyat ₺', b.fiyat ?? '', v => { b.fiyat = v === '' ? null : sayiya(v); }, 'type="number" step="0.01" min="0"')}
        ${alan('Yorum sayısı', b.yorum ?? '', v => { b.yorum = v === '' ? null : Math.round(sayiya(v)); }, 'type="number" step="1" min="0"')}
        ${alan('Puan (5 üzerinden)', b.puan ?? '', v => { b.puan = v === '' ? null : Math.min(5, sayiya(v)); }, 'type="number" step="0.1" min="0" max="5"')}
        ${alan('Marka', b.marka, v => { b.marka = v; })}
        ${alan('Görsel adresi', b.gorsel, v => { b.gorsel = /^https:\/\//i.test(v.trim()) ? v.trim() : b.gorsel; delete b.gorselYol; }, 'placeholder="https://…"')}
        <button class="btn ghost xs" type="button" ${onTik(() => dosyaSec('image/*', false, async F => { const D = await yukle(F, true); if (D[0]) yapisal(() => { b.gorselYol = D[0]!.yol; delete b.gorsel; }); }))}>▣ Görseli dosyadan</button>
      </div></details>`;
    return '';
  }

  /* ---------- ek bloklar: düzenleme görünümü ---------- */
  function hedefSecenekleri(secili?: string) {
    const L = ayar.sayfalar().filter(h => h.id !== x()?.id);
    return `<option value="">— seç —</option>${L.map(h => `<option value="${esc(h.id)}" ${secili === h.id ? 'selected' : ''}>${esc(h.ikon + ' ' + h.ad)} · ${esc(h.yol)}</option>`).join('')}`;
  }
  function ekDuzenle(b: Blok): string {
    const id = esc(b.id);
    if (b.tip === 'dosya') {
      const degistir = `<button class="btn ghost xs" type="button" title="başka dosyayla değiştir" ${onTik(() => A.dosyaSec('*/*', false, async F => { const D = await yukle(F, false); if (D[0]) yapisal(() => Object.assign(b, D[0])); }))}>⇄</button>`;
      return b.yol ? dosyaKart(b, degistir) : `<div class="tp-bos">Dosya seçilmedi <button class="btn ghost xs" type="button" ${onTik(() => A.dosyaSec('*/*', false, async F => { const D = await yukle(F, false); if (D[0]) yapisal(() => Object.assign(b, D[0])); }))}>⎘ Dosya seç</button></div>`;
    }
    if (b.tip === 'kod') return `<div class="eb-kod eb-kod-duzen" data-ek="kod" data-bid="${id}">
      <div class="eb-kod-ust">
        <select class="xs" aria-label="dil" ${onDegis(el => yapisal(() => { b.dil = el.value; }))}>${Object.entries(DILLER).map(([k, l]) => `<option value="${k}" ${k === b.dil ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <span class="eb-kod-bilgi mono">${String(b.kod || '').split('\n').length} satır · Tab = 2 boşluk</span>
        <button class="btn ghost xs" type="button" ${onTik(async () => { try { await navigator.clipboard.writeText(b.kod || ''); bildir('Kod kopyalandı'); } catch { bildir('Kopyalanamadı', undefined, true); } })}>⧉ Kopyala</button>
      </div>
      <div class="eb-kod-alan"><pre aria-hidden="true"><code>${renklendir(b.kod, b.dil)}\n</code></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="kod" data-ek="kod-ta" data-bid="${id}" placeholder="// kodu buraya yaz ya da yapıştır">${esc(b.kod || '')}</textarea></div>
    </div>`;
    if (b.tip === 'satir') {
      const K = kolonlarOf(b), top = K.reduce((a, k) => a + (k.span || 0), 0);
      return `<div class="eb-satir-duzen">
        <div class="eb-satir-arac">
          <span class="mono">12 kolon · kullanılan ${top}</span>
          <select class="xs" aria-label="düzen" ${onDegis(el => yapisal(() => {
            if (!el.value) return;
            const D = el.value.split('-').map(Number);
            b.kolonlar = D.map((s, i) => ({ span: s, bloklar: (K[i] || {} as { bloklar?: Blok[] }).bloklar || [] }));
            /* Azalan sütunların blokları son sütuna taşınır — içerik kaybolmaz. */
            K.slice(D.length).forEach(k => b.kolonlar[b.kolonlar.length - 1].bloklar.push(...(k.bloklar || [])));
          }))}><option value="">Hazır düzen…</option>${DUZENLER.map(d => `<option value="${d.join('-')}">${d.join(' + ')}</option>`).join('')}</select>
          <button class="btn ghost xs" type="button" ${K.length >= 12 ? 'disabled' : ''} ${onTik(() => yapisal(() => { K.push({ span: Math.max(1, Math.min(12, 12 - top)) || 3, bloklar: [] }); }))}>＋ Sütun</button>
        </div>
        <div class="eb-satir">${K.map((k, i) => `<div class="eb-kolon" style="--s:${Math.min(12, Math.max(1, k.span || 12))}">
          <div class="eb-kolon-ust">
            <select class="xs" aria-label="genişlik" ${onDegis(el => yapisal(() => { k.span = Number(el.value); }))}>${Array.from({ length: 12 }, (_, n) => `<option value="${n + 1}" ${n + 1 === k.span ? 'selected' : ''}>${n + 1}/12</option>`).join('')}</select>
            <button type="button" class="td-x" title="sola" ${i ? '' : 'disabled'} ${onTik(() => yapisal(() => { K.splice(i - 1, 0, K.splice(i, 1)[0]!); }))}>‹</button>
            <button type="button" class="td-x" title="sağa" ${i < K.length - 1 ? '' : 'disabled'} ${onTik(() => yapisal(() => { K.splice(i + 1, 0, K.splice(i, 1)[0]!); }))}>›</button>
            <button type="button" class="td-x" title="sütunu sil (bloklar yandaki sütuna geçer)" ${K.length > 1 ? '' : 'disabled'} ${onTik(() => yapisal(() => { const [s] = K.splice(i, 1); K[Math.max(0, i - 1)]!.bloklar.push(...(s!.bloklar || [])); }))}>×</button>
          </div>
          <div class="tp-bloklar eb-kolon-bloklar">${A.listeCiz(k.bloklar)}</div>
          <button type="button" class="eb-kolon-ekle" ${onTik(el => A.blokMenu(el, k.bloklar))}>＋ ${k.bloklar.length ? 'Blok' : 'Bu sütuna blok ekle'}</button>
        </div>`).join('')}</div>
      </div>`;
    }
    if (b.tip === 'tablo') {
      const T = b as unknown as Tablo & Blok;
      const S2 = T.sutunlar || (T.sutunlar = []), R = T.satirlar || (T.satirlar = []);
      const sag = (c: number) => (sayisal((S2[c] || {}).bicim) ? ' eb-sag' : '');
      const ok = (c: number) => (T.sira && T.sira.c === c ? (T.sira.yon === 1 ? '▲' : '▼') : '↕');
      return `<div class="eb-tablo-duzen" data-ek="tablo" data-bid="${id}">
        <div class="eb-satir-arac">
          <label class="eb-onay"><input type="checkbox" ${T.basSatir !== false ? 'checked' : ''} ${onDegis(el => yapisal(() => { T.basSatir = el.checked; }))}> başlık satırı</label>
          <label class="eb-onay"><input type="checkbox" ${T.basSutun ? 'checked' : ''} ${onDegis(el => yapisal(() => { T.basSutun = el.checked; }))}> ilk sütun başlık</label>
          <label class="eb-onay"><input type="checkbox" ${T.toplam ? 'checked' : ''} ${onDegis(el => yapisal(() => { T.toplam = el.checked; }))}> otomatik toplam</label>
          <button class="btn ghost xs" type="button" ${onTik(() => yapisal(() => { R.push(S2.map(() => '')); }))}>＋ Satır</button>
          <button class="btn ghost xs" type="button" ${S2.length >= 20 ? 'disabled' : ''} ${onTik(() => yapisal(() => { S2.push({ ad: 'Sütun ' + (S2.length + 1), bicim: 'metin' }); R.forEach(r => r.push('')); }))}>＋ Sütun</button>
        </div>
        <div class="eb-kap"><table class="eb-tablo eb-tablo-ed${T.basSatir !== false ? '' : ' eb-bassiz'}">
          <thead><tr>${S2.map((s, c) => `<th class="${sag(c).trim()}">
            <input class="eb-bas" value="${esc(s.ad || '')}" aria-label="sütun adı" data-ek="tb-bas" data-c="${c}">
            <span class="eb-bas-arac">
              <select class="xs" aria-label="biçim" ${onDegis(el => yapisal(() => { s.bicim = el.value; }))}>${Object.entries(BICIM).map(([k, l]) => `<option value="${k}" ${k === (s.bicim || 'metin') ? 'selected' : ''}>${l}</option>`).join('')}</select>
              <button type="button" class="td-x" title="bu sütuna göre sırala" ${onTik(() => yapisal(() => tabloSirala(T, c)))}>${ok(c)}</button>
              <button type="button" class="td-x" title="sütunu sil" ${S2.length > 1 ? '' : 'disabled'} ${onTik(() => yapisal(() => { S2.splice(c, 1); R.forEach(r => r.splice(c, 1)); if (T.sira && T.sira.c === c) delete T.sira; }))}>×</button>
            </span></th>`).join('')}<th class="eb-kontrol"></th></tr></thead>
          <tbody>${R.map((r, ri) => `<tr>${S2.map((s, c) => `<td class="${(c === 0 && T.basSutun ? 'eb-bas-sutun' : '') + sag(c)}"><input value="${esc(r[c] ?? '')}" aria-label="${esc(s.ad || 'hücre')}" data-ek="tb-hucre" data-r="${ri}" data-c="${c}" ${s.bicim === 'tarih' ? 'placeholder="gg.aa.yyyy"' : ''}></td>`).join('')}
            <td class="eb-kontrol"><button type="button" class="td-x" title="yukarı" ${ri ? '' : 'disabled'} ${onTik(() => yapisal(() => { R.splice(ri - 1, 0, R.splice(ri, 1)[0]!); }))}>↑</button><button type="button" class="td-x" title="satırı sil" ${onTik(() => yapisal(() => { R.splice(ri, 1); }))}>×</button></td></tr>`).join('')}</tbody>
          ${T.toplam ? `<tfoot><tr>${S2.map((s, c) => `<td class="${sag(c).trim()}" data-toplam="${c}">${c === 0 && !sayisal(s.bicim) ? 'Toplam' : sayisal(s.bicim) ? esc(hucreYaz(sutunToplam(T, c), s.bicim)) : ''}</td>`).join('')}<td class="eb-kontrol"></td></tr></tfoot>` : ''}
        </table></div>
      </div>`;
    }
    if (b.tip === 'buton') return `${butonHTML(b)}
      <div class="tp-medya-arac">
        ${alan('Etiket', b.etiket, v => { b.etiket = v; })}
        ${alan('Adres', b.url, v => { b.url = v.trim(); if (b.url) b.hedef = null; }, 'placeholder="https://…"')}
        <label class="tp-oz"><span>ya da sayfaya git</span><select ${onDegis(el => yapisal(() => { b.hedef = el.value ? { tur: 'sayfa', id: el.value } : null; }))}>${hedefSecenekleri(b.hedef?.id)}</select></label>
        ${secenek('Stil', b.stil || 'dolu', { dolu: 'Dolu', cizgi: 'Çizgili', yumusak: 'Yumuşak' }, v => { b.stil = v; })}
        ${secenek('Renk', b.renk || 'sari', Object.fromEntries(Object.keys(RENK).map(k => [k, k])), v => { b.renk = v; })}
        ${secenek('Hizalama', b.hiza || 'sol', { sol: 'Sol', orta: 'Orta', sag: 'Sağ' }, v => { b.hiza = v; })}
        <label class="tp-oz"><span>Simge</span><button type="button" class="btn ghost xs" ${onTik(el => A.simgeSec(el, v => yapisal(() => { b.ikon = v; })))}>${esc(b.ikon || '—')}</button></label>
      </div>`;
    if (b.tip === 'link') return `${linkHTML(b)}
      <div class="tp-medya-arac">${alan('Metin', b.metin, v => { b.metin = v; })}${alan('Adres', b.url, v => { b.url = v.trim(); }, 'placeholder="https://…"')}</div>`;
    if (b.tip === 'sayfaBag') return `${sayfaKart(b)}
      <div class="tp-medya-arac"><label class="tp-oz" style="flex:1"><span>Bağlanan sayfa</span><select ${onDegis(el => yapisal(() => { b.hedef = el.value ? { tur: 'sayfa', id: el.value } : null; }))}>${hedefSecenekleri(b.hedef?.id)}</select></label></div>`;
    return '';
  }
  function ekYeni(tip: string): Record<string, unknown> {
    switch (tip) {
      case 'kod': return { dil: 'js', kod: '' };
      case 'satir': return { kolonlar: [{ span: 6, bloklar: [] }, { span: 6, bloklar: [] }] };
      case 'tablo': return { sutunlar: [{ ad: 'Kalem', bicim: 'metin' }, { ad: 'Adet', bicim: 'sayi' }, { ad: 'Tutar', bicim: 'para' }], satirlar: [['', '', ''], ['', '', ''], ['', '', '']], basSatir: true, basSutun: false, toplam: true };
      case 'buton': return { etiket: 'Buton', url: '', stil: 'dolu', renk: 'sari', hiza: 'sol' };
      case 'link': return { metin: '', url: '' };
      case 'sayfaBag': return { hedef: null };
      default: return {};
    }
  }

  function bloklar(L: Blok[] = B(), ic = false): string {
    let sira = 0;
    return L.map((b, i) => {
      sira = b.tip === 'sirali' ? (L[i - 1] && L[i - 1]!.tip === 'sirali' ? sira + 1 : 1) : 0;
      const metin = METIN.includes(b.tip);
      return `<div class="tp-blok" data-blok="${esc(b.id)}">
        <div class="tp-tut">
          <button type="button" title="blok ekle" ${onTik(el => blokMenu(el, i + 1, L))}>＋</button>
          <button type="button" title="yukarı" ${i ? '' : 'disabled'} ${onTik(() => yapisal(() => { L.splice(i - 1, 0, L.splice(i, 1)[0]!); }))}>↑</button>
          <button type="button" title="aşağı" ${i < L.length - 1 ? '' : 'disabled'} ${onTik(() => yapisal(() => { L.splice(i + 1, 0, L.splice(i, 1)[0]!); }))}>↓</button>
          ${metin ? `<select title="blok türü" aria-label="blok türü" ${onDegis(el => turDegis(b, el.value))}>${BLOK_TURU.filter(t => METIN.includes(t[0])).map(t => `<option value="${t[0]}" ${t[0] === b.tip ? 'selected' : ''}>${t[1]} ${t[2]}</option>`).join('')}</select>` : ''}
          <button type="button" title="bloğu sil" ${onTik(() => yapisal(() => { L.splice(i, 1); }, L[i - 1] && METIN.includes(L[i - 1]!.tip) ? { bid: L[i - 1]!.id, son: true } : null))}>×</button>
        </div>
        <div class="tp-icerik">${metin ? metinBlok(b, i, sira) : EK.has(b.tip) ? ekDuzenle(b) : medyaBlok(b)}</div>
      </div>`;
    }).join('') || (ic ? '' : '<div class="tp-bos tp-ilk">Sayfa boş — yazmaya başla ya da "/" ile blok ekle.</div>');
  }

  function kipDegis(k: 'duzen' | 'onizle') {
    if (kip === k) return;
    kok.querySelectorAll<HTMLElement>('.zk-ed').forEach(e => metniYaz(e));
    clearTimeout(zaman); kaydet();
    kip = k; menuKapat(); kipYaz(k); ciz();
  }
  function onizlemeGovde(g: Sayfa) {
    return `<div class="tp-baslik-satir tp-onizle-bas"><span class="tp-simge">${esc(g.ikon || '○')}</span><h1 class="tp-onizle-baslik">${esc(g.baslik)}</h1></div>
      ${g.onemli ? `<div class="zk-callout zk-onemli" style="--c:${RENK[g.onemli_renk || 'kirmizi'] || RENK.kirmizi}"><span class="zk-ikon">‼︎</span><div><b>Önemli</b>${g.onemli_not ? ' — ' + esc(g.onemli_not) : ''}</div></div>` : ''}
      <article class="tp-onizleme">${bloklarHTML(B()) || '<div class="tp-bos">Sayfa boş — düzenleme kipine geçip içerik ekle.</div>'}</article>`;
  }

  function ciz(odak?: Odak) {
    const g = x(); if (!g || kapali) return;
    const eskiPanel = panel();
    const y = window.scrollY;
    const onizle = kip === 'onizle';
    olaySifirla();
    const eylemler = ayar.eylemler();
    kok.innerHTML = `<div class="tp-panel${g.one ? ' tp-one' : ''}${onizle ? ' tp-onizle' : ''}">
      <div class="tp-ust">
        <span class="tp-yol mono">${esc(ayar.yol(g))}</span>
        <div class="tp-kip" role="group" aria-label="görünüm kipi">
          <button type="button" id="ze-duzen" aria-pressed="${!onizle}" ${onTik(() => kipDegis('duzen'))}>✎ Düzenleme</button>
          <button type="button" id="ze-onizle" aria-pressed="${onizle}" ${onTik(() => kipDegis('onizle'))}>◉ Önizleme</button>
        </div>
        <button type="button" id="ze-one" class="btn ${g.one ? '' : 'ghost'} sm" title="ağaçta en üste sabitle" ${onTik(() => yapisal(() => { g.one = !g.one; }))}>${g.one ? '★ Öne çıkarıldı' : '☆ Öne çıkar'}</button>
        <button type="button" id="ze-onemli" class="btn ${g.onemli ? '' : 'ghost'} sm" title="önemli olarak işaretle" ${onTik(() => yapisal(() => { g.onemli = !g.onemli; }))}>‼︎ ${g.onemli ? 'Önemli' : 'Önemli işaretle'}</button>
        ${eylemler.map(e => `<button type="button" id="${esc(e.id)}" class="btn ${esc(e.sinif ?? 'ghost sm')}" ${onTik(() => e.tikla())}>${esc(e.etiket)}</button>`).join('')}
      </div>
      ${onizle ? onizlemeGovde(g) : `<div class="tp-baslik-satir">
        <button type="button" class="tp-simge" id="ze-simge" title="simge seç" ${onTik(el => ikonSec(el, v => yapisal(() => { g.ikon = v || null; })))}>${esc(g.ikon || '○')}</button>
        <input class="tp-baslik" id="ze-baslik" value="${esc(g.baslik)}" maxlength="200" aria-label="Sayfa başlığı" ${onDegis(el => { const v = el.value.trim(); if (v) yapisal(() => { g.baslik = v; }); else el.value = g.baslik; })}>
      </div>
      ${onemliBolum(g)}
      <section class="tp-bolum tp-sayfa-icerik" data-tp="birak-blok">
        ${bicimCubugu()}
        <div class="tp-bloklar">${bloklar()}</div>
        <button type="button" class="tp-ekle" data-tp="sona-ekle">＋ Yeni blok — ya da boş satırda "/" yaz</button>
      </section>`}
    </div>`;
    void eskiPanel;
    kaynaklariCoz(kok);
    window.scrollTo({ top: y });
    if (odak) odakla(odak.bid, odak.son);
  }
  function odakla(bid: string, son?: boolean) {
    const el = kok.querySelector<HTMLElement>(`.zk-ed[data-bid="${CSS.escape(String(bid))}"]`);
    if (!el) return;
    el.focus({ preventScroll: true });
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(!son);
    const s = document.getSelection(); s?.removeAllRanges(); s?.addRange(r);
  }

  /* ---------- blok işlemleri ---------- */
  function blokEkle(tip: string, konum?: number, ek: Record<string, unknown> = {}, L: Blok[] = B()): Blok | null {
    if (SATIR_ICI.has(tip)) {
      const p = blokEkle('p', konum, {}, L)!;
      setTimeout(() => { const el = kok.querySelector<HTMLElement>(`.zk-ed[data-bid="${CSS.escape(String(p.id))}"]`); if (el) satirIciSec(tip, el, el); });
      return p;
    }
    if (tip === 'dosya') {
      dosyaSec('*/*', true, async F => dosyaBloklari(F, konum ?? L.length, L));
      return null;
    }
    if (EK.has(tip)) ek = { ...ekYeni(tip), ...ek };
    const b = yeniBlok(tip, METIN.includes(tip) ? { html: '', ...ek } : ek);
    if (tip === 'galeri') b.gorseller = [];
    if (tip === 'callout') { b.ikon = b.ikon || 'ⓘ'; b.renk = b.renk || 'sari'; }
    yapisal(() => { L.splice(konum ?? L.length, 0, b); }, METIN.includes(tip) ? { bid: b.id } : null);
    if (tip === 'gorsel' && !b.src) gorselSec(b, false);
    if (tip === 'galeri') gorselSec(b, true);
    if (tip === 'kod') setTimeout(() => { kok.querySelector<HTMLElement>(`textarea[data-bid="${CSS.escape(String(b.id))}"]`)?.focus(); });
    return b;
  }
  /* Seçilen ya da içeriğe bırakılan dosyalar: her biri bir dosya bloğu. */
  async function dosyaBloklari(F: File[], konum: number, hedef: Blok[] = B()) {
    const D = await yukle(F, false); if (!D.length) return;
    const yeni = D.map(d => yeniBlok('dosya', d));
    yapisal(() => { hedef.splice(Math.min(konum, hedef.length), 0, ...yeni); });
    bildir(D.length + ' dosya eklendi');
  }
  function turDegis(b: Blok, tip: string) {
    yapisal(() => { b.tip = tip; if (tip === 'callout') { b.ikon = b.ikon || 'ⓘ'; b.renk = b.renk || 'sari'; } }, { bid: b.id, son: true });
  }
  /* "Bilgileri al": kutudaki adres alınır, önizleme ucundan görsel, fiyat, başlık, platform ve puan çekilir. */
  async function urunBilgiAl(b: Blok, dugme: HTMLElement) {
    const kutu = dugme.closest('.tp-urun-al')?.querySelector<HTMLInputElement>('[data-tp="urun-url"]');
    const url = String(kutu ? kutu.value : b.url || '').trim();
    if (!/^https?:\/\/\S+$/i.test(url)) { bildir('Önce ürün bağlantısını yapıştır.', undefined, true); return; }
    if (url !== b.url) { snapshotAl(true); b.url = url; b.magaza = magazaOf(url); }
    b.yukleniyor = true; ciz();
    const ok = await urunYenile(b.id, true);
    if (kapali) return;
    if (!ok) { bildir('Sayfa bilgisi alınamadı; mağaza sayfayı sunucuya kapatmış olabilir. Bilgileri elle girebilirsin.', undefined, true); return; }
    const bulunan = [b.baslik && 'başlık', b.fiyat !== null && b.fiyat !== undefined && 'fiyat', b.gorsel && 'görsel', b.puan !== null && b.puan !== undefined && 'puan'].filter(Boolean);
    const eksik = [(b.fiyat === null || b.fiyat === undefined) && 'fiyat', !b.gorsel && 'görsel', (b.puan === null || b.puan === undefined) && 'puan'].filter(Boolean);
    bildir('Alındı: ' + bulunan.join(' · ') + (eksik.length ? ' — bulunamadı: ' + eksik.join(', ') + ' (elle girilebilir)' : ''), undefined, !!eksik.length && !bulunan.length);
  }
  async function bilgiAl(b: Blok) {
    if (!b.url) return;
    if (b.tip === 'urun' || b.tip === 'baglanti') { b.yukleniyor = true; ciz(); await urunYenile(b.id, true); }
  }
  /* Boş bloğa bağlantı: türüne göre gömülü bloğa dönüşür. */
  function baglantiGom(b: Blok, url: string) {
    const tur = bagTuru(url);
    yapisal(() => {
      delete b.html; b.url = url;
      if (tur === 'youtube') { b.tip = 'youtube'; b.vid = youtubeId(url); }
      else if (tur === 'urun') { b.tip = 'urun'; b.magaza = magazaOf(url); b.baslik = ''; b.fiyat = null; }
      else { b.tip = 'baglanti'; b.baslik = siteAdi(url); }
    });
    if (tur !== 'youtube') void bilgiAl(b);
  }

  /* ---------- menüler ---------- */
  function menuKapat() { if (menu) { menu.el.remove(); menu = null; } }
  function menuAc(capa: HTMLElement, ogeler: MenuOge[], { filtre = '', secince, baslik, sinir = 14 }: { filtre?: string; secince: (o: MenuOge) => void; baslik?: string; sinir?: number }) {
    menuKapat();
    const el = document.createElement('div');
    el.className = 'tp-menu'; el.setAttribute('role', 'listbox');
    const p = panel()!;
    const r = capa.getBoundingClientRect(), pr = p.getBoundingClientRect();
    el.style.top = (r.bottom - pr.top + 4) + 'px';
    el.style.left = Math.max(8, Math.min(r.left - pr.left, pr.width - 300)) + 'px';
    p.appendChild(el);
    menu = { el, ogeler, secili: 0, filtre, secince, baslik, sinir };
    menuCiz();
  }
  function menuCiz() {
    const m = menu; if (!m) return;
    const f = m.filtre.toLocaleLowerCase('tr');
    /* Adı eşleşenler (önce baştan eşleşenler) ipucuyla eşleşenlerden önce gelir. */
    const puan = (o: MenuOge) => { const a = o.ad.toLocaleLowerCase('tr'); return a.startsWith(f) ? 0 : a.includes(f) ? 1 : 2; };
    m.gorunen = m.ogeler.filter(o => !f || (o.ad + ' ' + (o.ipucu || '')).toLocaleLowerCase('tr').includes(f))
      .map((o, i) => ({ o, i })).sort((a, b) => (f ? puan(a.o) - puan(b.o) : 0) || a.i - b.i).map(x => x.o).slice(0, m.sinir);
    if (m.secili >= m.gorunen.length) m.secili = 0;
    m.el.innerHTML = (m.baslik ? `<div class="tp-menu-bas">${esc(m.baslik)}</div>` : '') + (m.gorunen.map((o, i) =>
      `<button type="button" class="${i === m.secili ? 'on' : ''}" data-menu="${i}"><span class="tp-menu-ikon">${esc(o.ikon || '')}</span><span><b>${esc(o.ad)}</b>${o.ipucu ? `<i>${esc(o.ipucu)}</i>` : ''}</span></button>`).join('')
      || '<div class="tp-menu-bas">eşleşme yok</div>');
  }
  function menuSec(i: number) {
    const m = menu; if (!m || !m.gorunen || !m.gorunen[i]) return;
    const o = m.gorunen[i]!, fn = m.secince; menuKapat(); fn(o);
  }
  /* Sütun içinde satır bloğu açılmaz (tek düzey ızgara). */
  const turler = (ic: boolean): MenuOge[] => BLOK_TURU.filter(t => !(ic && t[0] === 'satir')).map(([tip, ikon, ad, ipucu]) => ({ tip, ikon, ad, ipucu }));
  function blokMenu(capa: HTMLElement, konum: number, L: Blok[] = B()) {
    menuAc(capa, turler(L !== B()), { baslik: 'Blok ekle', secince: o => blokEkle(o.tip!, konum, {}, L), sinir: 40 });
  }
  /* "/" yazılan boş blok, seçilen türe dönüşür. */
  function egikMenu(el: HTMLElement) {
    const k = bul(el.dataset.bid!); if (!k) return;
    const b = k.b;
    menuAc(el, turler(k.L !== B()), {
      baslik: 'Dönüştür / ekle', sinir: 40, secince: o => {
        if (METIN.includes(o.tip!)) { b.html = ''; turDegis(b, o.tip!); return; }
        if (SATIR_ICI.has(o.tip!)) { b.html = ''; el.innerHTML = ''; el.focus(); satirIciSec(o.tip!, el, el); return; }
        const i = k.L.indexOf(b);
        yapisal(() => { k.L.splice(i, 1); });
        blokEkle(o.tip!, i, {}, k.L);
      },
    });
    menu!.egik = { bid: b.id };
  }
  function anmaMenu(el: HTMLElement, kaldir?: () => void) {
    const G = ayar.sayfalar().filter(t => t.id !== x()?.id);
    const ogeler: MenuOge[] = [{ ikon: '↗', ad: 'Bağlantı anması', ipucu: 'adres yapıştır — site adıyla çip olarak eklenir', baglanti: true },
      ...G.map(t => ({ ikon: t.ikon, ad: t.ad, ipucu: t.yol, sayfaId: t.id }))];
    const sel = document.getSelection(), aralik = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    menuAc(el, ogeler, {
      baslik: 'An', secince: async o => {
        el.focus();
        /* Menü seçimi imleci bozmaz; yalnızca bir pencere açıldıysa eski konum geri konur. */
        const s0 = document.getSelection();
        const icinde = !!(s0 && s0.rangeCount && el.contains(s0.anchorNode));
        if (!icinde && aralik && sel) { sel.removeAllRanges(); sel.addRange(aralik); }
        if (kaldir) kaldir();
        if (o.baglanti) {
          const u = await adresSor(el, 'Anılacak bağlantı adresi');
          if (!u) return;
          document.execCommand('insertHTML', false, `<a href="${esc(u)}" data-anma="1" class="zm" target="_blank" rel="noopener noreferrer nofollow">↗ ${esc(siteAdi(u))}</a>&nbsp;`);
        } else {
          document.execCommand('insertHTML', false, `<span class="zm" data-sayfa="${esc(o.sayfaId)}" contenteditable="false">@${esc(o.ad)}</span>&nbsp;`);
        }
        metniYaz(el);
      },
    });
    menu!.anma = true;
  }
  /* Emoji / ikon: imlecin olduğu yere satır içi. Seçim menü açılmadan saklanır. */
  function satirIciSec(tur: string, el: HTMLElement | null, capa?: HTMLElement) {
    if (!el) { bildir('Önce metinde bir yere tıkla.', undefined, true); return; }
    const sel = document.getSelection(), aralik = sel && sel.rangeCount && el.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    const L = tur === 'emoji' ? EMOJILER : SEMBOLLER;
    menuAc(capa || el, L.map(i => ({ ikon: i, ad: i, deger: i })), {
      baslik: tur === 'emoji' ? 'Emoji' : 'İkon', sinir: 200, secince: o => {
        el.focus();
        const s = document.getSelection()!;
        if (aralik) { s.removeAllRanges(); s.addRange(aralik); } else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
        document.execCommand('insertText', false, o.deger!);
        metniYaz(el);
      },
    });
    menu!.el.classList.add('tp-ikonlar', 'tp-emoji');
  }
  function ikonSec(capa: HTMLElement, yaz: (v: string) => void) {
    menuAc(capa, [{ ikon: '', ad: 'Simgeyi kaldır', deger: '' }, ...[...IKONLAR, ...EMOJILER.slice(0, 40)].map(i => ({ ikon: i, ad: i, deger: i }))], { baslik: 'Simge', secince: o => yaz(o.deger!), sinir: 200 });
    menu!.el.classList.add('tp-ikonlar');
  }

  /* ---------- biçim ---------- */
  function secimHTML(): string {
    const s = document.getSelection(); if (!s || !s.rangeCount || s.isCollapsed) return '';
    const d = document.createElement('div'); d.appendChild(s.getRangeAt(0).cloneContents());
    return temizHTML(d.innerHTML);
  }
  /* Açılan pencere seçimi bozar: önce saklanır, yanıttan sonra geri konur. */
  async function adresSor(el: HTMLElement, baslik: string): Promise<string> {
    const s = document.getSelection(), r = s && s.rangeCount ? s.getRangeAt(0).cloneRange() : null;
    const u = await degerSor({ baslik, etiket: 'Adres (https://…)', deger: 'https://', sinir: 2048 });
    el.focus();
    if (r) { const s2 = document.getSelection()!; s2.removeAllRanges(); s2.addRange(r); }
    const v = String(u || '').trim();
    return /^(https?:\/\/\S+|mailto:\S+|tel:\S+)$/i.test(v) ? v : '';
  }
  async function bicimle(k: string, el: HTMLElement | null) {
    if (!el) return;
    if (k === 'link') {
      const u = await adresSor(el, 'Bağlantı'); if (!u) return;
      if (document.getSelection()!.isCollapsed) document.execCommand('insertHTML', false, `<a href="${esc(u)}">${esc(siteAdi(u) || u)}</a>`);
      else document.execCommand('createLink', false, u);
    } else if (k === 'code') { const h = secimHTML(); if (h) document.execCommand('insertHTML', false, `<code>${h.replace(/<[^>]+>/g, '')}</code>`); }
    else if (k === 'anma') { el.focus(); document.execCommand('insertText', false, '@'); return; }
    else if (k === 'temizle') { const h = secimHTML(); if (h) document.execCommand('insertHTML', false, esc(h.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"))); }
    else document.execCommand(k, false, undefined);
    metniYaz(el);
  }
  function vurgula(renk: string, el: HTMLElement | null) {
    if (!el) return;
    const h = secimHTML(); if (!h) return;
    const duz = h.replace(/<\/?mark[^>]*>/g, '');
    document.execCommand('insertHTML', false, renk ? `<mark data-renk="${renk}">${duz}</mark>` : duz);
    metniYaz(el);
  }

  /* ---------- dosyalar ---------- */
  function dosyaSec(kabul: string, coklu: boolean, fn: (F: File[]) => void) {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = kabul; i.multiple = !!coklu; i.style.display = 'none';
    i.addEventListener('change', () => { const F = [...(i.files || [])]; i.remove(); if (F.length) fn(F); });
    document.body.appendChild(i); i.click();
  }
  async function yukle(F: File[], gorsel: boolean): Promise<Yuklenen[]> {
    const D: Yuklenen[] = [];
    if (F.length) bildir(F.length > 1 ? `${F.length} dosya yükleniyor…` : 'Yükleniyor…');
    for (const f of F) {
      if (gorsel && !/^image\//.test(f.type)) { bildir(`${f.name}: görsel dosyası seç.`, undefined, true); continue; }
      try { D.push(await dosyaYukle(f, gorsel)); }
      catch (e) { bildir(e instanceof Error && e.message.startsWith('boyut:') ? e.message.slice(6) : hataMetni(e), undefined, true); }
    }
    return D;
  }

  /* ---------- olaylar ---------- */
  const girdiOlayi = (ev: Event) => {
    const t = ev.target as HTMLElement;
    const ne = t.dataset?.ek;
    if (ne === 'kod-ta' || ne === 'tb-bas' || ne === 'tb-hucre') { ekGirdi(t); return; }
    const el = t.closest?.('.zk-ed') as HTMLElement | null;
    if (!el) return;
    const k = bul(el.dataset.bid!), b = k && k.b;
    const metin = (el.textContent || '').replace(/ /g, ' ');
    if (b && b.tip === 'p') {
      for (const [re, tip] of KISAYOL) if (re.test(metin)) { b.html = ''; turDegis(b, tip); return; }
      if (metin === '---' && k) {
        const yeni = yeniBlok('p', { html: '' });
        yapisal(() => { b.tip = 'ayrac'; delete b.html; k.L.splice(k.L.indexOf(b) + 1, 0, yeni); }, { bid: yeni.id });
        return;
      }
    }
    if (metin === '/' && b) { metniYaz(el); egikMenu(el); return; }
    const m = menu as Menu | null;
    if (m && m.egik) {
      if (!metin.startsWith('/')) menuKapat(); else { m.filtre = metin.slice(1); menuCiz(); }
    }
    if (m && m.anma) {
      const s = document.getSelection()!, t2 = s.anchorNode && s.anchorNode.nodeType === 3 ? (s.anchorNode as Text).data.slice(0, s.anchorOffset) : '';
      const q = t2.match(/@([^\s@]{0,30})$/);
      if (!q) menuKapat(); else { m.filtre = q[1]!; menuCiz(); }
    } else if ((ev as InputEvent).data === '@') {
      anmaMenu(el, () => {
        const s = document.getSelection()!, dn = s.anchorNode;
        if (dn && dn.nodeType === 3) {
          const t2 = (dn as Text).data.slice(0, s.anchorOffset), q = t2.match(/@([^\s@]{0,30})$/);
          if (q) { const r = document.createRange(); r.setStart(dn, s.anchorOffset - q[0].length); r.setEnd(dn, s.anchorOffset); r.deleteContents(); }
        }
      });
    }
    metniYaz(el);
  };
  /* Kod ve tablo yazarken panel yeniden çizilmez (odak kaymasın): değer bloğa yazılır, kayıt gecikmeli yapılır. */
  function ekGirdi(t: HTMLElement) {
    const kokEl = t.closest<HTMLElement>('[data-ek][data-bid]:not(textarea)') || t;
    const b = bul(kokEl.dataset.bid || t.dataset.bid || '')?.b; if (!b) return;
    const ne = t.dataset.ek;
    if (ne === 'kod-ta') {
      snapshotAl(); b.kod = (t as HTMLTextAreaElement).value;
      const pre = t.parentElement!.querySelector('pre code'); if (pre) pre.innerHTML = renklendir(b.kod, b.dil) + '\n';
      sessizKaydet();
    } else if (ne === 'tb-bas') { snapshotAl(); b.sutunlar[Number(t.dataset.c)].ad = (t as HTMLInputElement).value; sessizKaydet(); }
    else if (ne === 'tb-hucre') {
      snapshotAl(); const r = Number(t.dataset.r), c = Number(t.dataset.c);
      if (b.satirlar[r]) b.satirlar[r][c] = (t as HTMLInputElement).value;
      const td = kokEl.querySelector(`[data-toplam="${c}"]`), s = b.sutunlar[c];
      if (td && s && sayisal(s.bicim)) td.textContent = hucreYaz(sutunToplam(b as unknown as Tablo, c), s.bicim);
      sessizKaydet();
    }
  }
  function ekTus(ev: KeyboardEvent): boolean {
    const t = ev.target as HTMLTextAreaElement & HTMLInputElement;
    if (t.dataset.ek === 'kod-ta' && ev.key === 'Tab') {
      ev.preventDefault();
      const s = t.selectionStart, e = t.selectionEnd;
      if (ev.shiftKey) {
        const bas = t.value.lastIndexOf('\n', s - 1) + 1;
        if (t.value.slice(bas, bas + 2) === '  ') { t.value = t.value.slice(0, bas) + t.value.slice(bas + 2); t.selectionStart = t.selectionEnd = Math.max(bas, s - 2); }
      } else { t.value = t.value.slice(0, s) + '  ' + t.value.slice(e); t.selectionStart = t.selectionEnd = s + 2; }
      ekGirdi(t);
      return true;
    }
    if (t.dataset.ek === 'tb-hucre' && (ev.key === 'Enter' || ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      const tablo = t.closest<HTMLElement>('[data-ek="tablo"]')!, r = Number(t.dataset.r) + (ev.key === 'ArrowUp' ? -1 : 1);
      const sonraki = tablo.querySelector<HTMLInputElement>(`[data-ek="tb-hucre"][data-r="${r}"][data-c="${t.dataset.c}"]`);
      if (sonraki) { ev.preventDefault(); sonraki.focus(); sonraki.select(); return true; }
      if (ev.key === 'Enter') {
        ev.preventDefault();
        const b = bul(tablo.dataset.bid!)?.b; if (!b) return true;
        const c = t.dataset.c;
        yapisal(() => { b.satirlar.push(b.sutunlar.map(() => '')); });
        setTimeout(() => { kok.querySelector<HTMLInputElement>(`[data-bid="${CSS.escape(tablo.dataset.bid!)}"] [data-ek="tb-hucre"][data-r="${b.satirlar.length - 1}"][data-c="${c}"]`)?.focus(); });
        return true;
      }
    }
    return false;
  }
  const tusOlayi = (ev: KeyboardEvent) => {
    const m = menu as Menu | null;
    if (m) {
      const n = Math.max(1, m.gorunen?.length ?? 0);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); m.secili = (m.secili + 1) % n; menuCiz(); return; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); m.secili = (m.secili - 1 + n) % n; menuCiz(); return; }
      if (ev.key === 'Enter' && m.gorunen?.length && (m.egik || m.anma)) { ev.preventDefault(); menuSec(m.secili); return; }
      if (ev.key === 'Escape') { ev.preventDefault(); menuKapat(); return; }
    }
    const t = ev.target as HTMLElement;
    if (t.dataset && t.dataset.ek && ekTus(ev)) return;
    const el = t.closest?.('.zk-ed') as HTMLElement | null;
    if (!el) return;
    const k = bul(el.dataset.bid!), L = k ? k.L : B(), b = k && k.b, i = k ? k.i : -1;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); void bicimle('link', el); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === 'h') { ev.preventDefault(); vurgula('sari', el); return; }
    if (!b) return;
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      metniYaz(el);
      const bos = !(el.textContent || '').trim() && !el.querySelector('img,.zm');
      if (bos && ['madde', 'sirali', 'yapilacak', 'alinti', 'callout'].includes(b.tip)) { turDegis(b, 'p'); return; }
      /* imleçten sonrası yeni bloğa taşınır */
      const s = document.getSelection()!; let kalan = '';
      if (s.rangeCount) {
        const r = s.getRangeAt(0), son = document.createRange();
        son.setStart(r.endContainer, r.endOffset); son.setEnd(el, el.childNodes.length);
        const d = document.createElement('div'); d.appendChild(son.extractContents()); kalan = temizHTML(d.innerHTML);
      }
      const tip = ['madde', 'sirali', 'yapilacak'].includes(b.tip) ? b.tip : 'p';
      const yeni = yeniBlok(tip, { html: kalan });
      yapisal(() => { b.html = temizHTML(el.innerHTML); L.splice(i + 1, 0, yeni); }, { bid: yeni.id });
      return;
    }
    if (ev.key === 'Backspace') {
      const s = document.getSelection()!;
      const basta = s.isCollapsed && s.rangeCount && (() => { const r = document.createRange(); r.selectNodeContents(el); r.setEnd(s.getRangeAt(0).startContainer, s.getRangeAt(0).startOffset); return r.toString() === ''; })();
      if (basta && b.tip !== 'p') { ev.preventDefault(); turDegis(b, 'p'); return; }
      if (basta && i > 0) {
        const onceki = L[i - 1]!;
        ev.preventDefault();
        if (METIN.includes(onceki.tip)) {
          const h = temizHTML(el.innerHTML);
          yapisal(() => { onceki.html = (onceki.html || '') + h; L.splice(i, 1); }, { bid: onceki.id, son: true });
        } else if (!(el.textContent || '').trim()) yapisal(() => { L.splice(i, 1); });
        return;
      }
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      const hedef = ev.key === 'ArrowUp' ? L.slice(0, i).reverse().find(y => METIN.includes(y.tip)) : L.slice(i + 1).find(y => METIN.includes(y.tip));
      const s = document.getSelection()!; if (!hedef || !s.rangeCount) return;
      const r = s.getRangeAt(0).getBoundingClientRect(), e = el.getBoundingClientRect();
      if ((ev.key === 'ArrowUp' && r.top - e.top < 14) || (ev.key === 'ArrowDown' && e.bottom - r.bottom < 14)) { ev.preventDefault(); odakla(hedef.id, ev.key === 'ArrowUp'); }
    }
  };
  const yapistirOlayi = (ev: ClipboardEvent) => {
    const el = (ev.target as HTMLElement).closest?.('.zk-ed') as HTMLElement | null; if (!el) return;
    const cd = ev.clipboardData; if (!cd) return;
    const metin = (cd.getData('text/plain') || '').trim();
    const b = bul(el.dataset.bid!)?.b;
    if (/^https?:\/\/\S+$/i.test(metin)) {
      ev.preventDefault();
      if (!(el.textContent || '').trim() && b && b.tip === 'p') { baglantiGom(b, metin); return; }
      if (!document.getSelection()!.isCollapsed) document.execCommand('createLink', false, metin);
      else document.execCommand('insertHTML', false, `<a href="${esc(metin)}">${esc(metin)}</a>&nbsp;`);
      metniYaz(el); return;
    }
    ev.preventDefault();
    const html = cd.getData('text/html');
    if (html) document.execCommand('insertHTML', false, temizHTML(html));
    else document.execCommand('insertText', false, cd.getData('text/plain'));
    metniYaz(el);
  };
  const tikOlayi = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement;
    const mo = t.closest<HTMLElement>('[data-menu]');
    if (mo) { ev.preventDefault(); menuSec(Number(mo.dataset.menu)); return; }
    if (menu && !t.closest('.tp-menu')) menuKapat();
    const bc = t.closest<HTMLElement>('[data-bicim]');
    if (bc && SATIR_ICI.has(bc.dataset.bicim!)) { ev.preventDefault(); satirIciSec(bc.dataset.bicim!, sonEd, bc); return; }
    if (bc) { ev.preventDefault(); void bicimle(bc.dataset.bicim!, sonEd); return; }
    const vr = t.closest<HTMLElement>('[data-vurgu]'); if (vr) { ev.preventDefault(); vurgula(vr.dataset.vurgu!, sonEd); return; }
    const tp = t.closest<HTMLElement>('[data-tp]');
    if (tp && tp.dataset.tp === 'blok-menu') { const k = sonEd && sonEd.isConnected && bul(sonEd.dataset.bid!); if (k) blokMenu(tp, k.i + 1, k.L); else blokMenu(tp, B().length); }
    if (tp && tp.dataset.tp === 'sona-ekle') blokEkle('p');
    if (tp && tp.dataset.tp === 'geri-al') geriAl();
    const zm = t.closest<HTMLElement>('.zm[data-sayfa]');
    if (zm && !t.closest('[contenteditable="true"]')) ayar.sayfaAc(zm.dataset.sayfa!);
    else if (zm && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); ayar.sayfaAc(zm.dataset.sayfa!); }
  };
  const birak = (ev: Event) => (ev.target as HTMLElement).closest?.('[data-tp="birak-blok"]') as HTMLElement | null;
  const dinleyiciler: [string, EventListener][] = [
    ['input', girdiOlayi as EventListener], ['keydown', tusOlayi as EventListener], ['paste', yapistirOlayi as EventListener], ['click', tikOlayi as EventListener],
    ['mousedown', ((ev: MouseEvent) => { if ((ev.target as HTMLElement).closest('[data-bicim],[data-vurgu],[data-menu]')) ev.preventDefault(); }) as EventListener],
    ['focusin', ((ev: FocusEvent) => { const e = (ev.target as HTMLElement).closest?.('.zk-ed') as HTMLElement | null; if (e) sonEd = e; }) as EventListener],
    ['dragover', ((ev: DragEvent) => { const d = birak(ev); if (d && [...(ev.dataTransfer?.types || [])].includes('Files')) { ev.preventDefault(); d.classList.add('tp-birak'); } }) as EventListener],
    ['dragleave', ((ev: DragEvent) => { birak(ev)?.classList.remove('tp-birak'); }) as EventListener],
    ['drop', ((ev: DragEvent) => {
      const d = birak(ev); if (!d || !ev.dataTransfer?.files.length) return;
      ev.preventDefault(); d.classList.remove('tp-birak');
      const bl = (ev.target as HTMLElement).closest<HTMLElement>('[data-blok]'), k = bl && bul(bl.dataset.blok!);
      void dosyaBloklari([...ev.dataTransfer.files], k ? k.i + 1 : B().length, k ? k.L : B());
    }) as EventListener],
  ];
  /* Önce düzenleyicinin kendi dinleyicileri (açık menüyü kapatır), sonra tıklama/değişiklik kayıt tablosu (menüyü açar). */
  dinleyiciler.forEach(([a, f]) => kok.addEventListener(a, f));
  olaylariBagla(kok);
  void AZAMI_DOSYA; void boyutYaz;

  const bosalt = () => {
    clearTimeout(zaman);
    kok.querySelectorAll<HTMLElement>('.zk-ed').forEach(e => metniYaz(e));
    const g = x(); if (g) { g.icerik = bloklarMetin(g.bloklar); ayar.degisti(); }
  };
  ciz();
  return {
    yenile: () => ciz(),
    bosalt,
    kapat: () => { bosalt(); kapali = true; menuKapat(); dinleyiciler.forEach(([a, f]) => kok.removeEventListener(a, f)); kok.replaceChildren(); },
  };
}
