/* Tasarım Atölyesi — Gemini vekili (Vercel sunucusuz fonksiyonu)
 *
 * POST /api/tasarim  {prompt, system, images:[{base64,mimeType}], level, model?}
 *   → {text, model}
 * GET  /api/tasarim   → {modeller:[…]} — anahtarın erişebildiği üretim modelleri
 *   (yalnız adlar; anahtar dönmez).
 *
 * Kota: seçilen model 429 (kota/hız) ya da 503 (yoğunluk) verirse yedek modeller sırayla denenir —
 * ücretsiz katmanda her modelin günlük kotası ayrı. Yedek listesi
 * GEMINI_YEDEK ortam değişkeniyle değiştirilebilir (virgüllü).
 *
 * Anahtar yalnız sunucuda: Vercel ortam değişkeni GEMINI_API_KEY. Yoksa 503
 * döner; uygulama o durumda kullanıcının bu cihaza girdiği kendi anahtarıyla
 * doğrudan Gemini'ye gider. Aynı işleyici `vite` geliştirme sunucusunda da
 * kullanılır (vite.config.js). */

import { hizSayaci, oturumVar } from './_guvenlik.js';

/* Flow'daki düşünme seviyeleri → model. Ultra derin model, diğerleri hızlı. */
export const MODELLER = {
  high:   {model: 'gemini-3.1-pro-preview', thinkingLevel: 'high'},
  medium: {model: 'gemini-3.5-flash',       thinkingLevel: 'high'},
  low:    {model: 'gemini-3.5-flash',       thinkingLevel: 'low'},
};
const AZAMI_GORSEL = 6;

const YEDEK = (process.env.GEMINI_YEDEK || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3-flash-preview,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite')
  .split(',').map(x => x.trim()).filter(Boolean);
const MODEL_ADI = /^gemini-[a-z0-9.-]+$/;

/* ---- kötüye kullanım koruması ----
   Anahtar sunucuda; uç herkese açık bir adreste durduğu için başka siteler
   ya da betikler kotayı tüketmesin: yalnız kendi kaynağımızdan (ya da
   ASTRA_ORIGIN listesinden) gelen istek, IP başına hız sınırı ve gövde
   sınırları. */
const AZAMI_METIN = 200000, AZAMI_SISTEM = 50000, AZAMI_GORSEL_B64 = 7 * 1024 * 1024;
const GORSEL_TUR = /^image\/(png|jpe?g|webp|gif|heic|heif)$/;
const hizAsildi = hizSayaci(Number(process.env.TASARIM_HIZ || 40));
export function istekDenetle(istek){
  if(!istek || typeof istek !== 'object') return 'Geçersiz istek';
  if(String(istek.prompt || '').length > AZAMI_METIN) return 'İstem çok uzun';
  if(String(istek.system || '').length > AZAMI_SISTEM) return 'Sistem talimatı çok uzun';
  if(istek.images !== undefined && !Array.isArray(istek.images)) return 'Geçersiz görsel listesi';
  for(const g of (istek.images || []).slice(0, AZAMI_GORSEL)){
    if(!g || typeof g.base64 !== 'string' || g.base64.length > AZAMI_GORSEL_B64) return 'Görsel çok büyük';
    if(!/^[A-Za-z0-9+/=\s]*$/.test(g.base64)) return 'Görsel base64 değil';
    if(g.mimeType && !GORSEL_TUR.test(g.mimeType)) return 'Desteklenmeyen görsel türü';
  }
  if(istek.level !== undefined && !Object.prototype.hasOwnProperty.call(MODELLER, istek.level)) return 'Geçersiz seviye';
  if(istek.model !== undefined && istek.model !== null && istek.model !== '' && !MODEL_ADI.test(String(istek.model))) return 'Geçersiz model adı';
  return '';
}

export function geminiGovdesi({prompt, system, images, level, model}){
  const secili = MODELLER[level] || MODELLER.high;
  /* Açık model adı: düşünme seviyesi yalnız gemini-3 ailesinde geçerli. */
  const m = model && MODEL_ADI.test(model)
    ? {model, thinkingLevel: /^gemini-3/.test(model) ? secili.thinkingLevel : null} : secili;
  const parcalar = (images || []).slice(0, AZAMI_GORSEL)
    .map(g => ({inlineData: {mimeType: g.mimeType || 'image/jpeg', data: g.base64}}));
  parcalar.push({text: String(prompt || '')});
  return {
    model: m.model,
    govde: {
      systemInstruction: system ? {parts: [{text: String(system)}]} : undefined,
      contents: [{role: 'user', parts: parcalar}],
      generationConfig: m.thinkingLevel
        ? {responseMimeType: 'application/json', thinkingConfig: {thinkingLevel: m.thinkingLevel}}
        : {responseMimeType: 'application/json'},
    },
  };
}

export async function geminiCagir(istek, anahtar){
  const {model, govde} = geminiGovdesi(istek);
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'x-goog-api-key': anahtar},
    body: JSON.stringify(govde),
  });
  const veri = await r.json().catch(() => ({}));
  if(!r.ok) throw Object.assign(new Error(veri?.error?.message || `Gemini HTTP ${r.status}`), {durum: r.status});
  const text = (veri.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if(!text) throw Object.assign(new Error('Gemini boş yanıt döndü.'), {durum: 502});
  return text;
}

/* Seçilen model kotaya takılırsa yedeklerle dene; bulunmayan model (404) atlanır. */
export async function geminiYedekli(istek, anahtar){
  const ilk = geminiGovdesi(istek).model;
  const sira = [ilk, ...YEDEK.filter(m => m !== ilk)];
  let son;
  for(const model of sira){
    try{
      const text = await geminiCagir({...istek, model: model === ilk ? istek.model : model}, anahtar);
      return {text, model};
    }catch(e){
      son = e;
      const kota = e.durum === 429 || /quota|RESOURCE_EXHAUSTED/i.test(e.message);
      /* 503 "high demand" geçici yoğunluk: sıradaki modele geç. */
      const yogun = e.durum === 503 || /high demand|overloaded|UNAVAILABLE/i.test(e.message);
      if(!(kota || yogun || e.durum === 404)) throw e;
    }
  }
  throw son;
}

async function modelListesi(anahtar){
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {headers: {'x-goog-api-key': anahtar}});
  const v = await r.json().catch(() => ({}));
  if(!r.ok) throw Object.assign(new Error(v?.error?.message || 'HTTP ' + r.status), {durum: r.status});
  return (v.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
}

async function govdeOku(req){
  if(req.body && typeof req.body === 'object') return req.body;
  if(typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let s = '';
  for await (const parca of req){
    s += parca;
    if(s.length > 50 * 1024 * 1024) throw Object.assign(new Error('Gövde çok büyük'), {durum: 413});
  }
  return JSON.parse(s || '{}');
}

function gonder(res, durum, veri){
  res.statusCode = durum;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

export default async function handler(req, res){
  const anahtar = process.env.GEMINI_API_KEY;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if(!(await oturumVar(req))) return gonder(res, 401, {error: 'Oturum gerekli.'});
  if(hizAsildi(req)) return gonder(res, 429, {error: 'Çok fazla istek — birkaç dakika sonra yeniden dene.'});
  if(req.method === 'GET'){
    if(!anahtar) return gonder(res, 503, {error: 'Sunucuda GEMINI_API_KEY tanımlı değil.', anahtarYok: true});
    try{ return gonder(res, 200, {modeller: await modelListesi(anahtar), yedek: YEDEK}); }
    catch(e){ return gonder(res, e.durum || 500, {error: e.message}); }
  }
  if(req.method !== 'POST') return gonder(res, 405, {error: 'Yalnız POST ya da GET'});
  if(!anahtar) return gonder(res, 503, {error: 'Sunucuda GEMINI_API_KEY tanımlı değil.', anahtarYok: true});
  try{
    const istek = await govdeOku(req);
    const sorun = istekDenetle(istek);
    if(sorun) return gonder(res, 400, {error: sorun});
    return gonder(res, 200, await geminiYedekli(istek, anahtar));
  }catch(e){
    return gonder(res, e.durum && e.durum < 600 ? e.durum : 500, {error: e.message || 'Üretim başarısız'});
  }
}
