/* Tahlil okuma — Gemini vekili (Vercel sunucusuz fonksiyonu)
 *
 * POST /api/tahlil  {base64, mimeType}  → {sonuc: {tarih, kurum, ad, degerler:[{test?, ad, deger, metin, birim, ref_alt, ref_ust}]}, model}
 *
 * PDF ya da fotoğraf halindeki laboratuvar raporundan değerleri çıkarır. Yalnız giriş yapmış kullanıcıya yanıt verir;
 * anahtar yalnız sunucuda (GEMINI_API_KEY). Dosya hiçbir yerde saklanmaz. */

import { hizSayaci, oturumVar } from './_guvenlik.js';
import { geminiYedekli } from './tasarim.js';

const TURLER = /^(application\/pdf|image\/(png|jpe?g|webp|heic|heif))$/;
const AZAMI_B64 = Math.floor(4.2 * 1024 * 1024);
const hizAsildi = hizSayaci(Number(process.env.TAHLIL_HIZ || 20));

const SISTEM = `Sen bir laboratuvar raporu okuyucususun. Verilen tahlil raporundaki (PDF ya da fotoğraf) her ölçüm satırını çıkar.
Yalnızca şu şemada JSON döndür, başka metin ekleme:
{"tarih":"YYYY-AA-GG" ya da null,"kurum":"laboratuvar/hastane adı" ya da null,"ad":"raporun kısa başlığı (ör. Genel kan tahlili)" ya da null,
 "degerler":[{"ad":"testin raporda yazan adı","deger":sayı ya da null,"metin":"sayısal olmayan sonuç (ör. Negatif) ya da null","birim":"birim ya da null","ref_alt":sayı ya da null,"ref_ust":sayı ya da null}]}
Kurallar: ondalık ayıracı olarak noktayı kullan. Referans aralığı "12.0 - 16.0" ise ref_alt 12, ref_ust 16; "< 5" ise ref_alt null, ref_ust 5; "> 40" ise ref_alt 40, ref_ust null.
Tanı, yorum ya da tavsiye ekleme; yalnızca rapordaki rakamları aktar. Okunamayan alanı null bırak. Hasta adı, TC kimlik numarası ve protokol numarası gibi kişisel bilgileri çıktıya koyma.`;

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let s = '';
  for await (const parca of req) { s += parca; if (s.length > 6 * 1024 * 1024) throw Object.assign(new Error('Gövde çok büyük'), { durum: 413 }); }
  return JSON.parse(s || '{}');
}
function gonder(res, durum, veri) {
  res.statusCode = durum;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

const sayi = v => { const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN; return Number.isFinite(n) ? n : null; };
const metin = (v, n) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

/** Modelin döndürdüğü JSON'u doğrular ve temizler. */
export function sonucuDuzenle(ham) {
  let o;
  try { o = JSON.parse(String(ham).replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw Object.assign(new Error('Yapay zekâ geçerli bir yanıt döndürmedi.'), { durum: 502 }); }
  const tarih = typeof o?.tarih === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.tarih) ? o.tarih : null;
  const degerler = (Array.isArray(o?.degerler) ? o.degerler : []).slice(0, 300).map(d => ({
    ad: metin(d?.ad, 120), deger: sayi(d?.deger), metin: metin(d?.metin, 120), birim: metin(d?.birim, 30), ref_alt: sayi(d?.ref_alt), ref_ust: sayi(d?.ref_ust),
  })).filter(d => d.ad && (d.deger !== null || d.metin));
  return { tarih, kurum: metin(o?.kurum, 200), ad: metin(o?.ad, 200), degerler };
}

export default async function handler(req, res) {
  const anahtar = process.env.GEMINI_API_KEY;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!(await oturumVar(req))) return gonder(res, 401, { error: 'Oturum gerekli.' });
  if (hizAsildi(req)) return gonder(res, 429, { error: 'Çok fazla istek — birkaç dakika sonra yeniden dene.' });
  if (req.method !== 'POST') return gonder(res, 405, { error: 'Yalnız POST' });
  if (!anahtar) return gonder(res, 503, { error: 'Sunucuda GEMINI_API_KEY tanımlı değil.', anahtarYok: true });
  try {
    const g = await govdeOku(req);
    if (typeof g?.base64 !== 'string' || !g.base64 || g.base64.length > AZAMI_B64 || !/^[A-Za-z0-9+/=\s]*$/.test(g.base64)) return gonder(res, 400, { error: 'Dosya geçersiz ya da çok büyük.' });
    if (!TURLER.test(String(g.mimeType || ''))) return gonder(res, 400, { error: 'Yalnız PDF ve fotoğraf (PNG, JPEG, WEBP, HEIC) okunabilir.' });
    const { text, model } = await geminiYedekli({ prompt: 'Bu tahlil raporundaki değerleri şemaya göre çıkar.', system: SISTEM, images: [{ base64: g.base64, mimeType: g.mimeType }], level: 'medium' }, anahtar);
    return gonder(res, 200, { sonuc: sonucuDuzenle(text), model });
  } catch (e) {
    return gonder(res, e.durum && e.durum < 600 ? e.durum : 500, { error: e.message || 'Okuma başarısız' });
  }
}
