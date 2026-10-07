/* Zihin Sarayı sayfalarının gövdesi Notion'daki gibi bloklardan oluşur:
   p · h2 · h3 · alinti · madde · sirali · yapilacak · callout · ayrac
   gorsel · galeri (karüsel) · youtube · baglanti (önizleme) · urun (ürün kartı)
   dosya · kod · satir (12 kolon) · tablo · buton · link · sayfaBag
   Metin blokları { html } taşır ve her çizimde temizHTML'den geçer.
   Bu dosya salt okunur çizimi ve blok modelini üretir; düzenleme editor.ts'te. */
import { MAGAZA, magazaOf, onizlemeGetir, siteAdi, youtubeId } from './baglanti';
import { dosyaAc, kaynaklariCoz } from './depo';
import { DILLER, renklendir } from './kod-renk';
import { onTik } from './olay';
import { BICIM, hucreYaz, sayisal, sutunToplam } from './tablo-hesap';
import { duzMetin, esc, guvenliUrl, temizHTML } from './temiz-html';
import { bildir } from '../../ortak/bildirim';
import { hataMetni } from '../../veri/hata';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Blok = { id: string; tip: string; html?: string; [alan: string]: any };
export { BICIM, DILLER };

export const RENK: Record<string, string> = { sari: 'var(--gold)', yesil: 'var(--green)', mavi: 'var(--cyan)', kirmizi: 'var(--red)', mor: 'var(--violet)', gri: 'var(--dim)' };
export const IKONLAR = ['ⓘ', '★', '⚑', '⚠︎', '✦', '◆', '✔︎', '✎', '⚖︎', '⌂', '✉︎', '☎︎', '♥︎', '☀︎', '✈︎', '⚙︎', '✂︎', '‼︎', '❖', '☰'];

/* Düzenleyicinin sayfa bilgisi sağladığı köprü: sayfaya bağlantı kartları ve ürün yenileme için. */
export const baglam = {
  sayfaBul: (_id: string): { ikon: string; ad: string; yol: string } | null => null,
  sayfaAc: (_id: string): void => { /* düzenleyici bağlar */ },
  blokBul: (_bid: string): Blok | undefined => undefined,
  degisti: (): void => { /* düzenleyici bağlar */ },
};

let sayac = 0;
export const uid = () => 'b' + Date.now().toString(36) + (++sayac).toString(36) + Math.random().toString(36).slice(2, 6);
export const yeniBlok = (tip: string, ek: Record<string, unknown> = {}): Blok => ({ id: uid(), tip, ...ek });

/** Görsel kaynağı: https adresi ya da depodaki dosya yolu (imzalı adres sonradan doldurulur). */
export function gorselEtiket(o: { src?: string; yol?: string } | null | undefined, ek = ''): string {
  if (!o) return '';
  if (o.yol) return `<img data-yol="${esc(o.yol)}" ${ek}>`;
  const s = String(o.src ?? '').trim();
  return /^(https:|blob:)/i.test(s) ? `<img src="${esc(s)}" ${ek}>` : '';
}
const gorselVar = (o: { src?: string; yol?: string } | null | undefined) => !!(o && (o.yol || /^(https:|blob:)/i.test(String(o.src ?? '').trim())));
const para = (v: unknown, c?: string) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v).toLocaleString('tr-TR', { style: 'currency', currency: /^[A-Z]{3}$/.test(c || '') ? c : 'TRY', maximumFractionDigits: 2 }));

/** Eski düz metin, ilk düzenlemede paragraflara dönüşür. */
export function bloklarOf(k: { bloklar?: unknown; icerik?: unknown }): Blok[] {
  if (Array.isArray(k.bloklar) && k.bloklar.length) return k.bloklar as Blok[];
  return String(k.icerik ?? '').split(/\n{2,}/).filter(t => t.trim()).map(t => yeniBlok('p', { html: esc(t.trim()).replace(/\n/g, '<br>') }));
}

/** Bloklardan düz metin: arama için sayfanın "icerik" sütununa yazılır. */
export function bloklarMetin(B: Blok[] | undefined): string {
  return (B || []).map(b => (b.html ? duzMetin(temizHTML(b.html)) : b.tip === 'urun' || b.tip === 'baglanti' ? (b.baslik || b.url || '') : ekMetin(b))).filter(Boolean).join('\n').slice(0, 4000);
}
export function ekMetin(b: Blok): string {
  switch (b.tip) {
    case 'dosya': return b.ad || '';
    case 'kod': return String(b.kod || '').slice(0, 1000);
    case 'satir': return kolonlarOf(b).map(k => bloklarMetin(k.bloklar)).join('\n');
    case 'tablo': return [(b.sutunlar || []).map((s: { ad: string }) => s.ad).join(' '), ...(b.satirlar || []).map((r: string[]) => r.join(' '))].join('\n');
    case 'buton': return b.etiket || '';
    case 'link': return b.metin || b.url || '';
    case 'sayfaBag': return baglam.sayfaBul(b.hedef?.id)?.ad ?? '';
    default: return '';
  }
}

/* ---------- mağaza rozeti ---------- */
const ROZET: Record<string, { z: string; y: string; t: string; vurgu?: string }> = {
  trendyol: { z: '#F27A1A', y: '#fff', t: 'trendyol' }, hepsiburada: { z: '#FF6000', y: '#fff', t: 'hepsiburada' },
  n11: { z: '#2B2B2B', y: '#fff', t: 'n11', vurgu: '#FF3B5C' }, pttavm: { z: '#FFD200', y: '#1B3C8C', t: 'PTT AVM' },
  gittigidiyor: { z: '#fff', y: '#E4352A', t: 'gittigidiyor' }, amazon: { z: '#232F3E', y: '#fff', t: 'amazon', vurgu: '#FF9900' },
};
export function magazaLogo(k: string, yukseklik = 20): string {
  const r = ROZET[k]; if (!r) return '';
  const g = Math.max(34, Math.round(r.t.length * 6.4 + 14));
  const metin = r.vurgu && k === 'n11' ? `<tspan fill="${r.y}">n</tspan><tspan fill="${r.vurgu}">11</tspan>` : esc(r.t);
  const alt = r.vurgu && k === 'amazon' ? `<path d="M10 16 q${(g - 20) / 2} 4 ${g - 20} 0" stroke="${r.vurgu}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : '';
  return `<svg class="zu-logo" role="img" aria-label="${esc(MAGAZA[k]?.ad ?? k)}" viewBox="0 0 ${g} 20" height="${yukseklik}" width="${Math.round(g * yukseklik / 20)}">
    <rect width="${g}" height="20" rx="5" fill="${r.z}" stroke="rgba(0,0,0,.12)"/>
    <text x="${g / 2}" y="13.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="${r.y}">${metin}</text>${alt}</svg>`;
}

/* ---------- ürün kartı ---------- */
export function urunKart(b: Blok, { yenilenebilir = true, kompakt = false } = {}): string {
  const url = guvenliUrl(b.url), mk = b.magaza || magazaOf(b.url);
  const fiyat = para(b.fiyat, b.para);
  const puan = Number(b.puan) > 0 ? Number(b.puan).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) : '';
  const yorum = Number(b.yorum) > 0 ? Number(b.yorum).toLocaleString('tr-TR') : '';
  return `<div class="zu${kompakt ? ' zu-kompakt' : ''}">
    <a class="zu-gorsel" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow" aria-label="ürün görseli">
      ${gorselEtiket({ src: b.gorsel, yol: b.gorselYol }, 'alt="" loading="lazy" referrerpolicy="no-referrer"') || '<span class="zu-bos">▣</span>'}</a>
    <div class="zu-govde">
      <div class="zu-ust">${mk ? magazaLogo(mk, 18) : `<span class="zu-site">${esc(siteAdi(b.url))}</span>`}${b.marka ? `<span class="zu-marka">${esc(b.marka)}</span>` : ''}</div>
      <a class="zu-baslik" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(b.baslik || siteAdi(b.url) || 'Ürün')}</a>
      <div class="zu-alt">
        <span class="zu-fiyat mono">${fiyat || '<span class="zu-yok">fiyat yok</span>'}</span>
        ${puan || yorum ? `<span class="zu-puan">${puan ? '★ ' + puan : ''}${yorum ? ` <span>· ${yorum} değerlendirme</span>` : ''}</span>` : ''}
      </div>
      <div class="zu-eylem">
        <a class="btn ghost xs" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${MAGAZA[mk] ? esc(MAGAZA[mk]!.ad) + "'da aç" : 'Sayfayı aç'} ↗</a>
        ${yenilenebilir ? `<button class="btn ghost xs" type="button" title="fiyatı ve bilgileri yeniden al" ${onTik(() => { void urunYenile(b.id); })}>↻ güncelle</button>` : ''}
        ${b.alindi ? `<span class="zu-tarih mono">${esc(b.alindi)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

/** Önizleme ucundan bilgi alır; başarısızsa alanlar elle doldurulabilir kalır. */
export async function urunYenile(bid: string, sessiz = false): Promise<boolean> {
  const b = baglam.blokBul(bid); if (!b) return false;
  b.yukleniyor = true; baglam.degisti();
  const v = await onizlemeGetir(b.url);
  delete b.yukleniyor;
  if (!v) { if (!sessiz) bildir('Sayfa bilgisi alınamadı. Fiyat ve görseli kart üzerinden elle girebilirsin.', undefined, true); baglam.degisti(); return false; }
  b.baslik = v.baslik || b.baslik; b.gorsel = v.gorsel || b.gorsel;
  if (b.tip === 'baglanti') { b.aciklama = v.aciklama || ''; b.site = v.site || ''; b.simge = v.simge || ''; }
  if (v.urun) {
    if (v.urun.fiyat !== null && v.urun.fiyat !== undefined) {
      if (b.fiyat !== null && b.fiyat !== undefined && Number(b.fiyat) !== Number(v.urun.fiyat)) b.eskiFiyat = b.fiyat;
      b.fiyat = v.urun.fiyat;
    }
    b.para = v.urun.para || b.para; b.yorum = v.urun.yorum ?? b.yorum; b.puan = v.urun.puan ?? b.puan;
    b.marka = v.urun.marka || b.marka; b.magaza = v.urun.magaza || b.magaza;
  }
  b.alindi = new Date().toLocaleDateString('tr-TR');
  baglam.degisti();
  return true;
}

/* ---------- bağlantı önizlemesi ---------- */
export function baglantiKart(b: Blok): string {
  const url = guvenliUrl(b.url);
  const g = gorselVar({ src: b.gorsel }) ? gorselEtiket({ src: b.gorsel }, 'alt="" loading="lazy" referrerpolicy="no-referrer"') : '';
  const s = gorselVar({ src: b.simge }) ? gorselEtiket({ src: b.simge }, 'alt="" width="14" height="14" loading="lazy" referrerpolicy="no-referrer"') : '';
  return `<a class="zb" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">
    <span class="zb-metin"><b>${esc(b.baslik || b.url)}</b>
      ${b.aciklama ? `<span class="zb-aciklama">${esc(b.aciklama)}</span>` : ''}
      <span class="zb-site">${s || '↗'} ${esc(b.site || siteAdi(b.url))}</span></span>
    ${g ? `<span class="zb-gorsel">${g}</span>` : ''}
  </a>`;
}

/* ---------- YouTube: listede yalnız kapak; oynatıcı tıklanınca yüklenir (çerezsiz alan) ---------- */
export function youtubeHTML(b: Blok): string {
  const id = youtubeId(b.url) || (/^[\w-]{11}$/.test(b.vid || '') ? b.vid : '');
  if (!id) return '';
  return `<div class="zy" data-vid="${id}">
    <button class="zy-kapak" type="button" aria-label="videoyu oynat" ${onTik(el => {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = 'YouTube videosu'; f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin'; f.loading = 'lazy';
      el.replaceWith(f);
    })}><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><span class="zy-oynat">▶</span></button>
    ${b.baslik ? `<div class="zy-baslik">${esc(b.baslik)}</div>` : ''}
  </div>`;
}

/* ---------- galeri (karüsel) ---------- */
function kaydir(el: HTMLElement, yon: number, hedef?: number) {
  const kok = el.closest('.zg') as HTMLElement, iz = kok.querySelector('.zg-iz') as HTMLElement;
  const say = iz.children.length, w = iz.clientWidth || 1;
  let i = Math.round(iz.scrollLeft / w);
  i = hedef !== undefined ? hedef : (i + yon + say) % say;
  iz.scrollTo({ left: i * w, behavior: 'smooth' });
  kok.querySelectorAll('.zg-nokta button').forEach((d, j) => d.classList.toggle('on', j === i));
  const s = kok.querySelector('.zg-sayac'); if (s) s.textContent = (i + 1) + ' / ' + say;
}
export function galeriHTML(b: Blok): string {
  const G = (b.gorseller || []).filter(gorselVar) as { src?: string; yol?: string; alt?: string }[];
  if (!G.length) return '';
  return `<div class="zg">
    <div class="zg-iz">${G.map(g => `<figure>${gorselEtiket(g, `alt="${esc(g.alt || '')}" loading="lazy" referrerpolicy="no-referrer"`)}${g.alt ? `<figcaption>${esc(g.alt)}</figcaption>` : ''}</figure>`).join('')}</div>
    ${G.length > 1 ? `<button class="zg-ok zg-geri" type="button" aria-label="önceki" ${onTik(el => kaydir(el, -1))}>‹</button>
      <button class="zg-ok zg-ileri" type="button" aria-label="sonraki" ${onTik(el => kaydir(el, 1))}>›</button>
      <div class="zg-nokta">${G.map((_, i) => `<button type="button" class="${i ? '' : 'on'}" aria-label="${i + 1}. görsel" ${onTik(el => kaydir(el, 0, i))}></button>`).join('')}</div>
      <span class="zg-sayac mono">1 / ${G.length}</span>` : ''}
  </div>`;
}

/* ---------- ek bloklar (salt okunur) ---------- */
const TUR_AD: [RegExp, string, string, string][] = [
  [/sheet|excel|spreadsheet|\.xlsx?$|\.ods$/i, '▦', 'Excel', 'var(--green)'], [/csv|\.csv$/i, '▦', 'CSV', 'var(--green)'],
  [/pdf|\.pdf$/i, '▤', 'PDF', 'var(--red)'], [/presentation|powerpoint|\.pptx?$|\.key$|\.odp$/i, '▭', 'Sunum', 'var(--orange)'],
  [/word|msword|document|\.docx?$|\.odt$|\.rtf$/i, '≣', 'Word', 'var(--cyan)'], [/zip|rar|7z|tar|gzip|\.(zip|rar|7z|tar|gz)$/i, '▣', 'Arşiv', 'var(--violet)'],
  [/^image\//i, '▣', 'Görsel', 'var(--gold)'], [/^text\/|\.(txt|md|log|json)$/i, '≡', 'Metin', 'var(--dim2)'],
];
export function dosyaTuru(tur?: string, ad?: string) {
  for (const [re, ikon, etiket, renk] of TUR_AD) if (re.test(tur || '') || re.test(ad || '')) return { ikon, etiket, renk };
  return { ikon: '⎘', etiket: ((String(ad || '').match(/\.([a-z0-9]{1,5})$/i) || [, 'Dosya'])[1] as string).toUpperCase(), renk: 'var(--dim2)' };
}
const boyutMetni = (b: number) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const hataBildir = (e: unknown) => bildir(hataMetni(e), undefined, true);
function dosyaKart(b: Blok, duzenle = ''): string {
  const t = dosyaTuru(b.tur, b.ad);
  const gorsel = /^image\/(png|jpe?g|webp|gif)$/.test(b.tur || '') && b.yol;
  return `<div class="eb-dosya" style="--c:${t.renk}">
    ${gorsel ? gorselEtiket({ yol: b.yol }, `class="eb-dosya-gorsel" alt="${esc(b.ad || '')}"`) : ''}
    <div class="eb-dosya-satir">
      <span class="eb-dosya-ikon">${t.ikon}</span>
      <span class="eb-dosya-bilgi"><b>${esc(b.ad || 'dosya')}</b><i class="mono">${esc(t.etiket)} · ${boyutMetni(Number(b.boyut) || 0)}</i></span>
      <button class="btn ghost xs" type="button" ${onTik(() => { dosyaAc({ yol: String(b.yol), ad: b.ad, tur: b.tur }).catch(hataBildir); })}>Aç</button>
      <button class="btn ghost xs" type="button" ${onTik(() => { dosyaAc({ yol: String(b.yol), ad: b.ad, tur: b.tur }, true).catch(hataBildir); })}>⤓ İndir</button>
      ${duzenle}
    </div>
  </div>`;
}
export { dosyaKart };

export const butonHTML = (b: Blok): string => {
  const url = guvenliUrl(b.url);
  const ic = `${b.ikon ? esc(b.ikon) + ' ' : ''}${esc(b.etiket || 'Buton')}`;
  const sinif = `eb-buton eb-${esc(b.stil || 'dolu')}`;
  const sayfa = b.hedef && b.hedef.id;
  const hiza = ({ orta: 'center', sag: 'flex-end' } as Record<string, string>)[b.hiza] || 'flex-start';
  return `<div class="eb-buton-kap" style="justify-content:${hiza};--c:${RENK[b.renk] || RENK.sari}">
    ${sayfa ? `<button type="button" class="${sinif}" ${onTik(() => baglam.sayfaAc(String(b.hedef.id)))}>${ic}</button>`
      : url && url !== '#' ? `<a class="${sinif}" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${ic}</a>`
      : `<span class="${sinif}">${ic}</span>`}
  </div>`;
};
export const linkHTML = (b: Blok): string => {
  const url = guvenliUrl(b.url);
  return url && url !== '#' ? `<a class="eb-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow"><span>↗</span><b>${esc(b.metin || siteAdi(b.url) || b.url)}</b><i>${esc(siteAdi(b.url))}</i></a>`
    : '<div class="tp-bos">Bağlantı adresi gir</div>';
};
export const sayfaKart = (b: Blok): string => {
  const h = b.hedef?.id ? baglam.sayfaBul(String(b.hedef.id)) : null;
  if (!h) return '<div class="tp-bos">Bağlanacak sayfayı seç</div>';
  return `<button type="button" class="eb-sayfa" ${onTik(() => baglam.sayfaAc(String(b.hedef.id)))}><span class="eb-sayfa-ikon">${esc(h.ikon)}</span>
    <span class="eb-sayfa-metin"><b>${esc(h.ad)}</b><i>${esc(h.yol)}</i></span><span class="eb-sayfa-ok">↗</span></button>`;
};
export const kodHTML = (b: Blok) => `<div class="eb-kod"><div class="eb-kod-ust mono">${esc(DILLER[b.dil] || 'Kod')}</div><pre><code>${renklendir(b.kod, b.dil)}</code></pre></div>`;

/* Sütunlar eskiden tek biçimli metin taşıyabilirdi; ilk dokunuşta blok listesine çevrilir. */
export function kolonlarOf(b: Blok): { span: number; bloklar: Blok[] }[] {
  const K = (Array.isArray(b.kolonlar) ? b.kolonlar : (b.kolonlar = [])) as { span: number; bloklar: Blok[]; html?: string }[];
  K.forEach(k => {
    if (!Array.isArray(k.bloklar)) { k.bloklar = k.html ? [yeniBlok('p', { html: k.html })] : []; delete k.html; }
  });
  return K;
}
const satirOku = (b: Blok) => `<div class="eb-satir">${kolonlarOf(b).map(k => `<div class="eb-kolon" style="--s:${Math.min(12, Math.max(1, k.span || 12))}">${bloklarHTML(k.bloklar)}</div>`).join('')}</div>`;

function tabloOku(b: Blok): string {
  const S2 = (b.sutunlar || []) as { ad: string; bicim?: string }[], R = (b.satirlar || []) as string[][];
  const hiza = (c: number) => (sayisal((S2[c] || {}).bicim) ? ' class="eb-sag"' : '');
  const hucre = (r: string[], c: number) => {
    const ic = esc(hucreYaz(r[c], (S2[c] || {}).bicim));
    return c === 0 && b.basSutun ? `<th scope="row"${hiza(c)}>${ic}</th>` : `<td${hiza(c)}>${ic}</td>`;
  };
  return `<div class="eb-kap"><table class="eb-tablo">
    ${b.basSatir !== false ? `<thead><tr>${S2.map((s, c) => `<th${hiza(c)}>${esc(s.ad || '')}</th>`).join('')}</tr></thead>` : ''}
    <tbody>${R.map(r => `<tr>${S2.map((_, c) => hucre(r, c)).join('')}</tr>`).join('')}</tbody>
    ${b.toplam ? `<tfoot><tr>${S2.map((s, c) => `<td${hiza(c)}>${c === 0 && !sayisal(s.bicim) ? 'Toplam' : sayisal(s.bicim) ? esc(hucreYaz(sutunToplam({ satirlar: R }, c), s.bicim)) : ''}</td>`).join('')}</tr></tfoot>` : ''}
  </table></div>`;
}

export const EK = new Set(['dosya', 'kod', 'satir', 'tablo', 'buton', 'link', 'sayfaBag']);
export function ekOku(b: Blok): string {
  switch (b.tip) {
    case 'dosya': return b.yol ? dosyaKart(b) : '';
    case 'kod': return kodHTML(b);
    case 'satir': return satirOku(b);
    case 'tablo': return tabloOku(b);
    case 'buton': return butonHTML(b);
    case 'link': return linkHTML(b);
    case 'sayfaBag': return sayfaKart(b);
    default: return '';
  }
}

/* ---------- blok çizimi (salt okunur) ---------- */
export function blokOku(b: Blok): string {
  const h = () => temizHTML(b.html);
  switch (b.tip) {
    case 'h2': return `<h3 class="zk-h2">${h()}</h3>`;
    case 'h3': return `<h4 class="zk-h3">${h()}</h4>`;
    case 'alinti': return `<blockquote class="zk-alinti">${h()}</blockquote>`;
    case 'yapilacak': return `<div class="zk-yap${b.done ? ' bitti' : ''}"><span class="zk-kutu">${b.done ? '✔︎' : ''}</span><span>${h()}</span></div>`;
    case 'callout': return `<div class="zk-callout" style="--c:${RENK[b.renk] || RENK.sari}"><span class="zk-ikon">${esc(b.ikon || 'ⓘ')}</span><div>${h()}</div></div>`;
    case 'ayrac': return '<hr class="zk-ayrac">';
    case 'gorsel': return gorselVar({ src: b.src, yol: b.yol }) ? `<figure class="zk-gorsel">${gorselEtiket({ src: b.src, yol: b.yol }, `alt="${esc(b.alt || '')}" loading="lazy" referrerpolicy="no-referrer"`)}${b.alt ? `<figcaption>${esc(b.alt)}</figcaption>` : ''}</figure>` : '';
    case 'galeri': return galeriHTML(b);
    case 'youtube': return youtubeHTML(b);
    case 'baglanti': return baglantiKart(b);
    case 'urun': return urunKart(b);
    default: return EK.has(b.tip) ? ekOku(b) : b.html ? `<p class="zk-p">${h()}</p>` : '';
  }
}
export function bloklarHTML(B: Blok[] | undefined): string {
  let o = '', liste: string | null = null;
  for (const b of B || []) {
    const tur = b.tip === 'madde' ? 'ul' : b.tip === 'sirali' ? 'ol' : null;
    if (liste && liste !== tur) { o += `</${liste}>`; liste = null; }
    if (tur) { if (!liste) { o += `<${tur} class="zk-liste">`; liste = tur; } o += `<li>${temizHTML(b.html)}</li>`; continue; }
    o += blokOku(b);
  }
  if (liste) o += `</${liste}>`;
  return o;
}
export { kaynaklariCoz };
