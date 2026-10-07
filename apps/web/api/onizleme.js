/* Bağlantı / ürün önizlemesi (Vercel sunucusuz fonksiyonu)
 *
 * GET /api/onizleme?url=https://…      → {baslik, aciklama, gorsel, site, simge,
 *                                          urun:{fiyat, para, yorum, puan, marka, magaza}?}
 * GET /api/onizleme?migros=<ürün adı>  → {fiyat} — market fiyat güncellemesi
 *
 * Tarayıcı başka sitelerin sayfasını okuyamaz (CORS); eskiden üçüncü taraf
 * vekil sunucular kullanılıyordu ve aranan ürün adları onlara gidiyordu.
 * Bu uç sayfayı sunucuda çeker ve YALNIZ ayrıştırılmış üst veriyi döndürür
 * (ham içerik dönmez, açık vekil değildir).
 *
 * SSRF koruması: yalnız http/https ve varsayılan port; ad çözümlemesinde
 * özel, döngü, bağlantı-yerel ve paylaşılan adres blokları reddedilir;
 * yönlendirmeler elle izlenir ve her adımda aynı denetim yapılır. Yanıt
 * boyutu ve süresi sınırlı. */
import dns from 'node:dns';
import net from 'node:net';
import { hizSayaci, oturumVar } from './_guvenlik.js';
export { oturumVar };

const AZAMI_BAYT = 3 * 1024 * 1024, SURE_MS = 8000, AZAMI_YONLENDIRME = 4;
const hizAsildi = hizSayaci(Number(process.env.ONIZLEME_HIZ || 120));

export const MAGAZALAR = [
  ['trendyol', 'Trendyol', /(^|\.)trendyol\.com$|(^|\.)ty\.gl$/],
  ['hepsiburada', 'Hepsiburada', /(^|\.)hepsiburada\.com$|(^|\.)hb\.com\.tr$/],
  ['n11', 'n11', /(^|\.)n11\.com$/],
  ['pttavm', 'PTT AVM', /(^|\.)pttavm\.com$/],
  ['gittigidiyor', 'GittiGidiyor', /(^|\.)gittigidiyor\.com$/],
  ['amazon', 'Amazon', /(^|\.)amazon\.com\.tr$/],
];
export const magazaOf = host => { const m = MAGAZALAR.find(([, , re]) => re.test(String(host || '').toLowerCase())); return m ? {k: m[0], ad: m[1]} : null; };

/* ---- adres denetimi ---- */
function ozelIPv4(a){
  const p = a.split('.').map(Number);
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224
    || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 169 && p[1] === 254)
    || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
    || (p[0] === 192 && p[1] === 0 && p[2] === 0) || (p[0] === 198 && (p[1] === 18 || p[1] === 19));
}
export function ozelAdres(ip){
  if(net.isIPv4(ip)) return ozelIPv4(ip);
  const a = ip.toLowerCase();
  const m = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); if(m) return ozelIPv4(m[1]);
  const h = a.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if(h){ const x = parseInt(h[1], 16), y = parseInt(h[2], 16); return ozelIPv4([x >> 8, x & 255, y >> 8, y & 255].join('.')); }
  return a === '::' || a === '::1' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || /^ff/.test(a) || a.startsWith('64:ff9b:') || a.startsWith('2001:db8');
}
export async function adresDenetle(adres, cozucu = dns.promises.lookup){
  let u;
  try{ u = new URL(adres); }catch(e){ return 'Geçersiz adres'; }
  if(!/^https?:$/.test(u.protocol)) return 'Yalnız http/https';
  if(u.username || u.password) return 'Kimlik bilgili adres kabul edilmez';
  if(u.port && !((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80'))) return 'Standart dışı port';
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if(/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return 'Yerel adres';
  let ipler;
  if(net.isIP(host)) ipler = [host];
  else{
    try{ ipler = (await cozucu(host, {all: true})).map(x => x.address); }catch(e){ return 'Ad çözülemedi'; }
  }
  if(!ipler.length || ipler.some(ozelAdres)) return 'Özel ağ adresi';
  return null;
}

async function cek(adres){
  let simdiki = adres;
  for(let i = 0; i <= AZAMI_YONLENDIRME; i++){
    const sorun = await adresDenetle(simdiki);
    if(sorun) throw Object.assign(new Error(sorun), {durum: 400});
    const ac = new AbortController(); const zaman = setTimeout(() => ac.abort(), SURE_MS);
    let r;
    try{
      r = await fetch(simdiki, {redirect: 'manual', signal: ac.signal, headers: {
        /* Bazı mağazalar (PTT AVM, Hepsiburada) bot kimliğine boş sayfa ya da
           403 döndürüyor; sıradan bir tarayıcı kimliğiyle istenir. */
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5',
        'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.5'}});
    }finally{ clearTimeout(zaman); }
    if(r.status >= 300 && r.status < 400 && r.headers.get('location')){
      simdiki = new URL(r.headers.get('location'), simdiki).href; continue;
    }
    if(!r.ok) throw Object.assign(new Error('Sayfa yanıtı ' + r.status), {durum: 502});
    const okuyucu = r.body.getReader(); const parca = []; let top = 0;
    while(true){
      const {done, value} = await okuyucu.read(); if(done) break;
      top += value.length; parca.push(value);
      if(top > AZAMI_BAYT){ ac.abort(); break; }
    }
    return {url: simdiki, tur: r.headers.get('content-type') || '', metin: Buffer.concat(parca.map(p => Buffer.from(p))).toString('utf8')};
  }
  throw Object.assign(new Error('Çok fazla yönlendirme'), {durum: 400});
}

/* ---- ayrıştırma ---- */
const varlik = s => String(s || '').replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|#39|nbsp);/gi, (t, k) => {
  const K = k.toLowerCase();
  if(K[0] === '#') return String.fromCodePoint(K[1] === 'x' ? parseInt(K.slice(2), 16) : parseInt(K.slice(1), 10));
  return {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '}[K] || t;
}).replace(/\s+/g, ' ').trim();
function metaOku(html){
  const M = {};
  for(const m of html.matchAll(/<meta\b[^>]*>/gi)){
    const t = m[0];
    const ad = (t.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const ic = (t.match(/\bcontent\s*=\s*"([^"]*)"/i) || t.match(/\bcontent\s*=\s*'([^']*)'/i) || [])[1];
    if(ad && ic !== undefined && M[ad.toLowerCase()] === undefined) M[ad.toLowerCase()] = varlik(ic);
  }
  return M;
}
function jsonLd(html){
  const L = [];
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{ L.push(JSON.parse(m[1].trim())); }catch(e){ try{ L.push(JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, ' '))); }catch(e2){} }
  }
  const D = [];
  const gez = o => { if(!o || typeof o !== 'object') return; if(Array.isArray(o)){ o.forEach(gez); return; } D.push(o); if(o['@graph']) gez(o['@graph']); };
  gez(L);
  return D;
}
/* Mikro veri: itemprop taşıyan her etiket (meta dışındakiler de) — content
   özniteliği ya da kısa iç metin. */
function mikroVeri(html, ad){
  const re = new RegExp(`<([a-z0-9]+)\\b[^>]*\\bitemprop\\s*=\\s*["']${ad}["'][^>]*>([^<]{0,200})`, 'i');
  const m = html.match(re); if(!m) return null;
  const c = m[0].match(/\b(?:content|src|href)\s*=\s*["']([^"']*)["']/i);
  return varlik(c ? c[1] : m[2]) || null;
}
/* Sayfaya gömülü uygulama durumu (Next.js __NEXT_DATA__, window.__…STATE__
   ve application/json blokları): ürün adı ve fiyatı birlikte taşıyan ilk
   nesne aranır; görsel, puan ve yorum sayısı onun içinden alınır. */
const AD_K = ['name', 'productName', 'title', 'displayName', 'urunAdi'];
const FIYAT_K = ['sellingPrice', 'salePrice', 'discountedPrice', 'finalPrice', 'sellPrice', 'currentPrice', 'price', 'fiyat', 'priceValue', 'amount'];
const GORSEL_K = ['imageUrl', 'image', 'mainImage', 'images', 'imageList', 'photos', 'thumbnail', 'picture', 'img'];
const PUAN_K = ['averageRating', 'ratingScore', 'averageRate', 'rating', 'ratingValue', 'score', 'avgRating', 'puan'];
const YORUM_K = ['reviewCount', 'commentCount', 'totalCommentCount', 'ratingCount', 'totalRatingCount', 'reviewsCount', 'yorumSayisi'];
function gomuluJson(html){
  const L = [];
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)){ if(m[1].length < 4e6) try{ L.push(JSON.parse(m[1])); }catch(e){} }
  for(const m of html.matchAll(/window\.(__[A-Z0-9_]*(?:STATE|DATA|PROPS)[A-Z0-9_]*__)\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|window\.)/g)){ if(m[2].length < 4e6) try{ L.push(JSON.parse(m[2])); }catch(e){} }
  return L;
}
function degerAl(o, anahtarlar){
  for(const k of anahtarlar){
    let v = o[k];
    if(v && typeof v === 'object' && !Array.isArray(v)) v = v.value ?? v.amount ?? v.text ?? v.url ?? v.src ?? v.averageRating ?? v.ratingValue ?? v.name;
    if(Array.isArray(v)) v = v[0] && typeof v[0] === 'object' ? (v[0].url || v[0].src || v[0].imageUrl || v[0].path) : v[0];
    if(v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}
function urunAra(kokler){
  let adim = 0;
  const kuyruk = [...kokler];
  while(kuyruk.length && adim++ < 60000){
    const o = kuyruk.shift();
    if(!o || typeof o !== 'object') continue;
    if(Array.isArray(o)){ kuyruk.push(...o.slice(0, 200)); continue; }
    const ad = degerAl(o, AD_K), fiyat = sayi(degerAl(o, FIYAT_K));
    if(typeof ad === 'string' && ad.length > 3 && fiyat > 0){
      /* Görsel, puan, yorum bu nesnede yoksa bir kat alttaki nesnelerde aranır. */
      const alt = Object.values(o).filter(v => v && typeof v === 'object' && !Array.isArray(v));
      const bul = K => degerAl(o, K) ?? alt.map(a => degerAl(a, K)).find(v => v != null) ?? null;
      return {ad, fiyat, gorsel: bul(GORSEL_K), puan: bul(PUAN_K), yorum: bul(YORUM_K), marka: degerAl(o, ['brand', 'brandName', 'marka'])};
    }
    for(const v of Object.values(o)) if(v && typeof v === 'object') kuyruk.push(v);
  }
  return null;
}

const tipMi = (o, t) => [].concat(o['@type'] || []).some(x => String(x).toLowerCase() === t);
const ilk = v => Array.isArray(v) ? v[0] : v;
const sayi = v => { if(v == null || v === '') return null; const s = String(v).replace(/[^\d.,-]/g, ''); const x = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); const n = parseFloat(x); return Number.isFinite(n) ? n : null; };
const tam = v => { if(v == null || v === '') return null; const n = parseInt(String(v).replace(/\D/g, ''), 10); return Number.isFinite(n) ? n : null; };
const guvenliGorsel = (g, taban) => { if(!g) return ''; try{ const u = new URL(String(g || ''), taban); return /^https?:$/.test(u.protocol) ? u.href : ''; }catch(e){ return ''; } };

export function sayfaCoz(html, adres){
  const M = metaOku(html), D = jsonLd(html);
  const u = new URL(adres);
  const baslikEt = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
  const simge = (html.match(/<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i) || [''])[0].match(/href\s*=\s*["']([^"']+)["']/i);
  const r = {
    url: u.href,
    baslik: M['og:title'] || M['twitter:title'] || varlik(baslikEt) || u.hostname,
    aciklama: M['og:description'] || M['description'] || M['twitter:description'] || '',
    gorsel: guvenliGorsel(M['og:image'] || M['og:image:url'] || M['twitter:image'], u.href),
    site: M['og:site_name'] || u.hostname.replace(/^www\./, ''),
    simge: guvenliGorsel(simge ? simge[1] : '/favicon.ico', u.href),
  };
  const P = D.find(o => tipMi(o, 'product'));
  const mag = magazaOf(u.hostname);
  const G = (!P || !ilk(P.offers)) && (mag || /itemprop|__NEXT_DATA__|__[A-Z_]*STATE__/.test(html)) ? urunAra(gomuluJson(html)) : null;
  const mv = ad => mikroVeri(html, ad);
  if(P || G || mag || M['product:price:amount'] || M['og:price:amount'] || mv('price')){
    const of = ilk(P && P.offers) || {};
    const ar = (P && P.aggregateRating) || {};
    const marka = P && P.brand ? (typeof P.brand === 'string' ? P.brand : P.brand.name) : (M['product:brand'] || '');
    /* Öncelik: JSON-LD → mikro veri → gömülü uygulama verisi → meta. */
    const gMarka = G && G.marka ? (typeof G.marka === 'object' ? G.marka.name : G.marka) : '';
    r.urun = {
      fiyat: sayi(of.price ?? of.lowPrice ?? mv('price') ?? (G && G.fiyat) ?? M['product:price:amount'] ?? M['og:price:amount']),
      para: of.priceCurrency || mv('priceCurrency') || M['product:price:currency'] || M['og:price:currency'] || 'TRY',
      yorum: tam(ar.reviewCount ?? ar.ratingCount ?? mv('reviewCount') ?? mv('ratingCount') ?? (G && G.yorum)),
      puan: sayi(ar.ratingValue ?? mv('ratingValue') ?? (G && G.puan)),
      marka: varlik(marka || mv('brand') || gMarka || ''),
      magaza: mag ? mag.k : '',
    };
    if(r.urun.puan != null && (r.urun.puan < 0 || r.urun.puan > 5)) r.urun.puan = r.urun.puan <= 10 ? r.urun.puan / 2 : r.urun.puan <= 100 ? r.urun.puan / 20 : null;
    if(P){
      if(P.name) r.baslik = varlik(P.name);
      const g = ilk(P.image); const gs = g && typeof g === 'object' ? (g.url || g.contentUrl) : g;
      if(gs) r.gorsel = guvenliGorsel(gs, u.href) || r.gorsel;
    }else if(G){
      if(!M['og:title']) r.baslik = varlik(G.ad);
      if(!r.gorsel && typeof G.gorsel === 'string') r.gorsel = guvenliGorsel(G.gorsel, u.href);
    }
    if(!r.gorsel && mv('image')) r.gorsel = guvenliGorsel(mv('image'), u.href);
    if(mag && (!r.site || /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}$/i.test(r.site))) r.site = mag.ad;
  }
  r.baslik = String(r.baslik).slice(0, 300); r.aciklama = String(r.aciklama).slice(0, 600);
  return r;
}

function gonder(res, durum, veri){
  res.statusCode = durum;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

export default async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if(req.method !== 'GET') return gonder(res, 405, {error: 'Yalnız GET'});
  if(!(await oturumVar(req))) return gonder(res, 401, {error: 'Oturum gerekli.'});
  if(hizAsildi(req)) return gonder(res, 429, {error: 'Çok fazla istek — birkaç dakika sonra yeniden dene.'});
  const q = new URL(req.url, 'http://x').searchParams;
  try{
    if(q.get('migros')){
      const ad = q.get('migros').slice(0, 120);
      const s = await cek('https://www.migros.com.tr/rest/search/screens/wide?q=' + encodeURIComponent(ad));
      const j = JSON.parse(s.metin);
      const p = j?.data?.searchInfo?.storeProductInfos?.[0]?.salePrice ?? j?.data?.storeProductInfos?.[0]?.salePrice;
      return gonder(res, p ? 200 : 404, p ? {fiyat: p} : {error: 'Fiyat bulunamadı'});
    }
    const adres = String(q.get('url') || '');
    if(!adres || adres.length > 2048) return gonder(res, 400, {error: 'url gerekli'});
    const s = await cek(adres);
    if(!/html|xml/i.test(s.tur) && !/^\s*</.test(s.metin)) return gonder(res, 200, {url: s.url, baslik: new URL(s.url).pathname.split('/').pop() || s.url, site: new URL(s.url).hostname, aciklama: '', gorsel: '', simge: ''});
    return gonder(res, 200, sayfaCoz(s.metin, s.url));
  }catch(e){
    return gonder(res, e.durum && e.durum < 600 ? e.durum : 502, {error: e.name === 'AbortError' ? 'Zaman aşımı' : (e.message || 'Önizleme alınamadı')});
  }
}
