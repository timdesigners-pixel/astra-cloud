/* Yapay zekâ danışman sohbeti — Gemini vekili (Vercel sunucusuz fonksiyonu)
 *
 * POST /api/sohbet  {rol, mesajlar:[{rol:'user'|'model', metin}], baglam?}  → {yanit, model}
 *
 * Yalnız giriş yapmış kullanıcıya yanıt verir; anahtar yalnız sunucuda (GEMINI_API_KEY). `baglam`, kullanıcının
 * isteğiyle gönderdiği kısa finans özetidir; hiçbir yerde saklanmaz. */

import { hizSayaci, oturumVar } from './_guvenlik.js';

const hizAsildi = hizSayaci(Number(process.env.SOHBET_HIZ || 60));
const MODELLER = (process.env.GEMINI_SOHBET_MODELLERI || 'gemini-3.5-flash,gemini-3.8-flash,gemini-3.7-flash,gemini-3-flash-preview,gemini-2.5-flash').split(',').map(x => x.trim()).filter(Boolean);
const AZAMI_MESAJ = 30, AZAMI_METIN = 6000, AZAMI_BAGLAM = 8000;

export const ROLLER = {
  genel_finans: `Sen ASTRA Finans OS'un baş finans danışmanısın. Kullanıcının bütçe dengesini korumasına, nakit akışını yönetmesine ve hedeflerine ulaşmasına yardımcı olursun.
Net, açık ve gerçekçi ol; gereksiz laf kalabalığı yapma, madde imleri kullan; para birimini belirt; tavsiyeni uygulanabilir adımlara böl.`,
  icra_hukuk: `Sen Türk İcra ve İflas Hukuku, borç yapılandırma ve yasal riskler konusunda uzman bir finansal hukuk danışmanısın.
İcra takibinde tebligat süreleri (7 gün, 30 gün itiraz/ödeme süreleri), 89/1-2-3 haciz ihbarnameleri, maaş haczi (1/4 kuralı), taksitlendirme sözleşmeleri ve İİK 340 gibi konularda rehberlik edersin.
Yanıtların bilgilendirme ve strateji amaçlıdır, avukatlık sözleşmesi teşkil etmez; kritik süreler için avukata danışılmasını hatırlat.`,
  sermaye_strateji: `Sen varlık dağıtımı, sermaye koruma ve portföy stratejisi uzmanısın. Enflasyona karşı sermaye koruma, kur riski, likidite yönetimi ve 90 günlük nakit akışı konularında analitik, temkinli öneriler üretirsin. Yatırım tavsiyesi vermediğini belirt.`,
  butce_denetci: `Sen titiz bir bütçe denetçisisin. Gereksiz abonelikleri ve gizli maliyetleri bulur, gelir-gider makasını açacak tasarruf stratejileri önerir, alımları acil / ertelenebilir diye sınıflandırırsın.`,
};

async function govdeOku(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  let s = '';
  for await (const parca of req) { s += parca; if (s.length > 200000) throw Object.assign(new Error('Gövde çok büyük'), { durum: 413 }); }
  return JSON.parse(s || '{}');
}
function gonder(res, durum, veri) {
  res.statusCode = durum;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(veri));
}

/** İstemci gövdesini doğrular; geçersizse hata mesajı, değilse temizlenmiş {rol, mesajlar, baglam} döndürür. */
export function sohbetiDenetle(g) {
  if (!g || typeof g !== 'object') return { hata: 'Geçersiz istek' };
  const rol = Object.prototype.hasOwnProperty.call(ROLLER, g.rol) ? g.rol : 'genel_finans';
  if (!Array.isArray(g.mesajlar) || !g.mesajlar.length) return { hata: 'Mesaj yok' };
  const mesajlar = g.mesajlar.slice(-AZAMI_MESAJ).map(m => ({ rol: m?.rol === 'model' ? 'model' : 'user', metin: String(m?.metin ?? '').slice(0, AZAMI_METIN) })).filter(m => m.metin.trim());
  if (!mesajlar.length || mesajlar[mesajlar.length - 1].rol !== 'user') return { hata: 'Son mesaj kullanıcıdan olmalı' };
  return { rol, mesajlar, baglam: typeof g.baglam === 'string' ? g.baglam.slice(0, AZAMI_BAGLAM) : '' };
}

async function gemini(model, sistem, mesajlar, anahtar) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': anahtar },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sistem }] }, contents: mesajlar.map(m => ({ role: m.rol, parts: [{ text: m.metin }] })) }),
  });
  const v = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(v?.error?.message || `Gemini HTTP ${r.status}`), { durum: r.status });
  const text = (v.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw Object.assign(new Error('Gemini boş yanıt döndü.'), { durum: 502 });
  return text;
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
    const d = sohbetiDenetle(await govdeOku(req));
    if (d.hata) return gonder(res, 400, { error: d.hata });
    const sistem = `${ROLLER[d.rol]}\n\nYanıtını Türkçe ver.${d.baglam ? `\n\nKullanıcının isteğiyle paylaştığı güncel finans özeti (başka veri yok, uydurma):\n${d.baglam}` : ''}`;
    let son;
    for (const model of MODELLER) {
      try { return gonder(res, 200, { yanit: await gemini(model, sistem, d.mesajlar, anahtar), model }); }
      catch (e) {
        son = e;
        const gecici = e.durum === 429 || e.durum === 503 || e.durum === 404 || /quota|RESOURCE_EXHAUSTED|high demand|overloaded|UNAVAILABLE/i.test(e.message);
        if (!gecici) throw e;
      }
    }
    throw son;
  } catch (e) {
    return gonder(res, e.durum && e.durum < 600 ? e.durum : 500, { error: e.message || 'Yanıt alınamadı' });
  }
}
