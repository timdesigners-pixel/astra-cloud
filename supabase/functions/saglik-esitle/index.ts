// Akıllı saat / telefon sağlık verisi alıcısı. Anahtar: Sağlık › Cihaz Senkronu sayfasında üretilir.
//   POST  gövde: basit JSON, { olcumler: [...] } ya da Health Auto Export JSON'u
//   GET   adres: ?anahtar=…&adim=8421&nabiz=72&uyku_saat=7.5   (Kısayollar gibi yalnız adres açabilen araçlar için)
// Anahtar: "Authorization: Bearer …", "x-astra-anahtar" üst bilgisi ya da ?anahtar= parametresi.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cevir } from './cevir.ts';

const ENV = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(ENV('SUPABASE_URL'), ENV('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const AZAMI_GOVDE = 4 * 1024 * 1024;
const KAYNAKLAR = ['saat', 'telefon'];
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization, x-astra-anahtar', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const yanit = (durum: number, govde: unknown) =>
  new Response(JSON.stringify(govde), { status: durum, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const ozet = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, '0')).join('');
const istanbulBugun = () => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') return yanit(405, { hata: 'Yalnız GET ve POST' });
  const url = new URL(req.url);
  const baslik = req.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? req.headers.get('x-astra-anahtar') ?? url.searchParams.get('anahtar') ?? '';
  if (!/^astra_sag_[A-Za-z0-9_-]{20,80}$/.test(baslik)) return yanit(401, { hata: 'Anahtar eksik ya da geçersiz' });

  const { data: anahtar } = await admin.from('saglik_anahtarlari').select('id, sahip_id, kullanim_sayisi')
    .eq('belirtec_ozeti', await ozet(baslik)).is('iptal_at', null).maybeSingle();
  if (!anahtar) return yanit(401, { hata: 'Anahtar tanınmadı ya da iptal edilmiş' });

  const sonuc = async (metin: string) => {
    await admin.from('saglik_anahtarlari').update({ son_kullanim: new Date().toISOString(), son_sonuc: metin.slice(0, 300), kullanim_sayisi: anahtar.kullanim_sayisi + 1 }).eq('id', anahtar.id);
  };

  let govde: unknown;
  let kaynak = 'telefon';
  if (req.method === 'GET') {
    const o: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { if (k !== 'anahtar' && k !== 'kaynak') o[k] = v; });
    govde = o;
    kaynak = url.searchParams.get('kaynak') ?? kaynak;
  } else {
    const metin = await req.text();
    if (metin.length > AZAMI_GOVDE) { await sonuc('Gövde çok büyük'); return yanit(413, { hata: 'Gövde çok büyük (en fazla 4 MB)' }); }
    try { govde = JSON.parse(metin); } catch { await sonuc('Geçersiz JSON'); return yanit(400, { hata: 'Gövde geçerli JSON değil' }); }
    const k = (govde as { kaynak?: unknown } | null)?.kaynak ?? url.searchParams.get('kaynak');
    if (typeof k === 'string') kaynak = k;
  }
  if (!KAYNAKLAR.includes(kaynak)) kaynak = 'telefon';

  const { satirlar, sorun } = cevir(govde, istanbulBugun());
  if (sorun) { await sonuc(sorun); return yanit(422, { hata: sorun }); }

  const kayit = satirlar.map(s => ({ sahip_id: anahtar.sahip_id, kaynak, cihaz: 'esitleme', ...s }));
  for (let i = 0; i < kayit.length; i += 500) {
    const { error } = await admin.from('saglik_olcumleri').upsert(kayit.slice(i, i + 500), { onConflict: 'sahip_id,gun,tur,kaynak' });
    if (error) { await sonuc('Kaydedilemedi'); return yanit(500, { hata: 'Kaydedilemedi' }); }
  }

  // Günlük Karşılama ve palet aynı günlük kaydı okuduğu için adım, nabız ve uykuyu oraya da yansıt.
  const gunler = new Map<string, Record<string, unknown>>();
  for (const s of satirlar) {
    const g = gunler.get(s.gun) ?? { sahip_id: anahtar.sahip_id, gun: s.gun, cihaz: 'esitleme' };
    if (s.tur === 'adim') g.adim = Math.round(s.deger);
    if (s.tur === 'nabiz') g.nabiz = Math.round(s.deger);
    if (s.tur === 'uyku_dk') g.uyku = `${Math.floor(s.deger / 60)}s ${Math.round(s.deger % 60)}dk`;
    gunler.set(s.gun, g);
  }
  const yansit = [...gunler.values()].filter(g => 'adim' in g || 'nabiz' in g || 'uyku' in g);
  for (let i = 0; i < yansit.length; i += 200) await admin.from('saglik_gunluk').upsert(yansit.slice(i, i + 200), { onConflict: 'sahip_id,gun' });

  const gunSayisi = new Set(satirlar.map(s => s.gun)).size;
  await sonuc(`${satirlar.length} ölçüm, ${gunSayisi} gün`);
  return yanit(200, { tamam: true, olcum: satirlar.length, gun: gunSayisi, ilk: satirlar[0]?.gun ?? null, kaynak });
});
