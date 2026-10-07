/* Market fiyatı araması (Vercel sunucusuz fonksiyonu)
 *
 * Kaynak: marketfiyati.org.tr (TÜBİTAK) açık fiyat servisi. Tarayıcı bu
 * servisi başka bir kaynaktan doğrudan okuyamaz (CORS); uç yalnız iki
 * işlemi, doğrulanmış girdiyle ileten dar bir aracıdır (açık vekil değildir):
 *
 * GET /api/market?islem=yakin&lat=38.4&lon=27.1&km=5
 *   → {subeler:[{id, market, ad, km}]}
 * GET /api/market?islem=ara&q=süt&lat=…&lon=…&km=5&s=bim-1,a101-2
 *   → {urunler:[{id, ad, marka, miktar, gorsel, teklifler:[{market, sube, fiyat, birim, indirim}]}]}
 *
 * Yanıttan yalnız listede gereken alanlar döner; konum yalnız bu istek için
 * servise iletilir, saklanmaz. */
import { hizSayaci, oturumVar } from './_guvenlik.js';

const KOK = 'https://api.marketfiyati.org.tr';
const SURE_MS = 10000, AZAMI_BAYT = 4 * 1024 * 1024;
const hizAsildi = hizSayaci(Number(process.env.MARKET_HIZ || 300));

function gonder(res, durum, veri){
  res.statusCode = durum;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}
const sayi = (v, alt, ust) => { const x = Number(v); return Number.isFinite(x) && x >= alt && x <= ust ? x : null; };

async function servis(yol, govde){
  const ac = new AbortController(); const zaman = setTimeout(() => ac.abort(), SURE_MS);
  try{
    const r = await fetch(KOK + yol, {method: 'POST', signal: ac.signal,
      headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
      body: JSON.stringify(govde)});
    if(!r.ok) throw Object.assign(new Error('Fiyat servisi yanıt vermedi (HTTP ' + r.status + ')'), {durum: 502});
    const metin = await r.text();
    if(metin.length > AZAMI_BAYT) throw Object.assign(new Error('Yanıt çok büyük'), {durum: 502});
    return JSON.parse(metin);
  }finally{ clearTimeout(zaman); }
}

export function subeleriSadelestir(liste){
  return (Array.isArray(liste) ? liste : []).filter(x => x && typeof x.id === 'string').slice(0, 200).map(x => ({
    id: x.id, market: String(x.marketName || '').trim(), ad: String(x.sellerName || '').trim(),
    km: Number.isFinite(Number(x.distance)) ? Math.round(Number(x.distance) * 10) / 10 : null}));
}
export function urunleriSadelestir(j){
  const icerik = j && Array.isArray(j.content) ? j.content : [];
  return icerik.slice(0, 40).map(u => ({
    id: String(u.id || ''), ad: String(u.title || '').trim(), marka: String(u.brand || '').trim(),
    miktar: [u.refinedVolumeOrWeight, u.refinedQuantityUnit].filter(Boolean).join(' '),
    gorsel: /^https:\/\//.test(u.imageUrl || '') ? u.imageUrl : '',
    teklifler: (Array.isArray(u.productDepotInfoList) ? u.productDepotInfoList : [])
      .filter(o => o && Number.isFinite(Number(o.price)) && Number(o.price) > 0)
      .map(o => ({market: String(o.marketAdi || '').trim(), sube: String(o.depotName || '').trim(),
        fiyat: Number(o.price), birim: String(o.unitPrice || '').trim(), indirim: !!o.discount}))
  })).filter(u => u.ad && u.teklifler.length);
}

export default async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if(req.method !== 'GET') return gonder(res, 405, {error: 'Yalnız GET'});
  if(!(await oturumVar(req))) return gonder(res, 401, {error: 'Oturum gerekli.'});
  if(hizAsildi(req)) return gonder(res, 429, {error: 'Çok fazla istek — birkaç dakika sonra yeniden dene.'});
  const q = new URL(req.url, 'http://x').searchParams;
  const lat = sayi(q.get('lat'), 35, 43), lon = sayi(q.get('lon'), 25, 45), km = sayi(q.get('km') || 5, 0.5, 30);
  if(lat === null || lon === null || km === null) return gonder(res, 400, {error: 'Konum Türkiye içinde olmalı (lat, lon) ve mesafe 0,5–30 km.'});
  try{
    if(q.get('islem') === 'yakin'){
      const j = await servis('/api/v2/nearest', {latitude: lat, longitude: lon, distance: km});
      return gonder(res, 200, {subeler: subeleriSadelestir(j)});
    }
    if(q.get('islem') === 'ara'){
      const kelime = String(q.get('q') || '').trim().slice(0, 120);
      const subeler = String(q.get('s') || '').split(',').map(x => x.trim()).filter(x => /^[\p{L}\p{N}_-]{1,80}$/u.test(x)).slice(0, 200);
      if(!kelime) return gonder(res, 400, {error: 'Aranacak ürün gerekli.'});
      if(!subeler.length) return gonder(res, 400, {error: 'Yakındaki şube listesi gerekli.'});
      const j = await servis('/api/v2/search', {keywords: kelime, latitude: lat, longitude: lon, distance: km, depots: subeler, pages: 0, size: 24});
      return gonder(res, 200, {urunler: urunleriSadelestir(j)});
    }
    return gonder(res, 400, {error: 'islem: yakin | ara'});
  }catch(e){
    return gonder(res, e.durum || 502, {error: e.name === 'AbortError' ? 'Fiyat servisi zaman aşımına uğradı' : (e.message || 'Fiyat alınamadı')});
  }
}
