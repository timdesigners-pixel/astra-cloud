/* `dogrula`: kaynak (plan) ↔ hedef kontrol toplamı. Salt okunur, kullanıcı oturumu. Sayı ve kuruş toplamı karşılaştırılır; fark tablosu üretilir,
   fark varsa çıkış kodu 1. Plan §6 dalga a doğrulama sorguları DEĞER DÖNDÜRMEDEN uygulanır (yalnız sayı).
   Eşitlik koşulu: kaynak(plan; atlananlar zaten düşülmüş) == hedef. Sahiplenilen satırlar tutar toplamına girmez (hedef satır değiştirilmediği için). */
import { kurusToplami } from '../donusum/sayi-hesap.ts';
import { olayYazdir } from '../cikti.ts';
import type { Plan } from '../plan/plan.ts';
import type { BegeniPlanKaydi, UygulamaPlanKaydi } from '../plan/plan-tipleri.ts';
import { eslesmeDiziniKur } from '../yazici/eslesme.ts';
import type { YaziciFabrikasi } from '../yazici/yazici-arayuzu.ts';
import { KomutHatasi } from './komut-hata.ts';

export type KontrolKalemi = { ad: string; kaynak: number; hedef: number };
export type BilgiKalemi = { ad: string; sayi: number };
export type DogrulaSonucu = { kontroller: KontrolKalemi[]; farklar: KontrolKalemi[]; bilgi: BilgiKalemi[] };

/* SAF: fark tablosu = kaynak ≠ hedef olan kalemler. */
export function farklariBul(kontroller: readonly KontrolKalemi[]): KontrolKalemi[] {
  return kontroller.filter((k) => k.kaynak !== k.hedef);
}

export async function dogrula(g: { plan: Plan; yaziciKur: YaziciFabrikasi }): Promise<DogrulaSonucu> {
  if (g.plan.dalga !== 'a') throw new KomutHatasi('DALGA_YAZICI_YOK', { dalga: g.plan.dalga });
  const kayitlar = g.plan.kayitlar();
  const uygKayitlari = kayitlar.filter((k): k is UygulamaPlanKaydi => k.tablo === 'uygulama_durumu');
  const begeniKayitlari = kayitlar.filter((k): k is BegeniPlanKaydi => k.tablo === 'begeniler');

  const yazici = await g.yaziciKur();
  try {
    const eslesmeler = await yazici.eslesmeOku({ dalga: g.plan.dalga });
    const dizin = eslesmeDiziniKur(eslesmeler);
    const kontroller: KontrolKalemi[] = [];
    const bilgi: BilgiKalemi[] = [];

    /* uygulama_durumu: planlanan anahtarların hedefte bulunma sayısı (değer okunmaz; yalnız anahtar adları). */
    const uygulamalar = [...new Set(uygKayitlari.map((k) => k.uygulama))].sort();
    const hedefAnahtarlar = new Map<string, ReadonlySet<string>>();
    for (const u of uygulamalar) {
      const anahtarlar = await yazici.uygulamaAnahtarlariOku(u);
      hedefAnahtarlar.set(u, new Set(anahtarlar));
      bilgi.push({ ad: `uygulama_anahtar_${u}`, sayi: anahtarlar.length });
    }
    kontroller.push({
      ad: 'uygulama_durumu_anahtar',
      kaynak: uygKayitlari.length,
      hedef: uygKayitlari.filter((k) => hedefAnahtarlar.get(k.uygulama)?.has(k.anahtar) === true).length,
    });
    kontroller.push({
      ad: 'aktarim_eslesme_uygulama_durumu',
      kaynak: uygKayitlari.length,
      hedef: uygKayitlari.filter((k) => dizin.aktifMi(k.koleksiyon, k.kaynak_id)).length,
    });

    /* begeniler: kod sayısı + fiyat kuruş toplamı (yalnız araç tarafından yazılanlar). */
    const hedefBegeniler = await yazici.begeniKodlariOku();
    bilgi.push({ ad: 'begeniler_kodlu', sayi: hedefBegeniler.length });
    const hedefKodlar = new Set(hedefBegeniler.map((b) => b.kod));
    kontroller.push({ ad: 'begeniler_satir', kaynak: begeniKayitlari.length, hedef: begeniKayitlari.filter((k) => hedefKodlar.has(k.satir.kod)).length });
    kontroller.push({
      ad: 'aktarim_eslesme_begeniler',
      kaynak: begeniKayitlari.length,
      hedef: begeniKayitlari.filter((k) => dizin.aktifMi(k.koleksiyon, k.kaynak_id)).length,
    });

    const sahiplenildiMi = (k: BegeniPlanKaydi): boolean => {
      const e = dizin.bul(k.koleksiyon, k.kaynak_id);
      return e !== undefined && e.silindi_at === null && e.ekstra.durum === 'sahiplenildi';
    };
    const kaynakFiyatlar = begeniKayitlari.filter((k) => !sahiplenildiMi(k)).flatMap((k) => (k.satir.fiyat !== null ? [k.satir.fiyat] : []));
    const hedefIdler = begeniKayitlari.flatMap((k) => {
      const e = dizin.bul(k.koleksiyon, k.kaynak_id);
      return e !== undefined && e.silindi_at === null && e.ekstra.durum !== 'sahiplenildi' && e.hedef_id !== null ? [e.hedef_id] : [];
    });
    const hedefFiyatlar = (await yazici.begeniFiyatlariOku(hedefIdler)).flatMap((f) => (f.fiyat !== null ? [f.fiyat] : []));
    kontroller.push({ ad: 'begeniler_fiyat_kurus', kaynak: kurusToplami(kaynakFiyatlar).kurus, hedef: kurusToplami(hedefFiyatlar).kurus });

    /* Plan §6 sorguları (değer yok): dalga eşleşme sayısı, tablo dağılımı, plan atlananı. */
    const aktifler = eslesmeler.filter((e) => e.silindi_at === null);
    bilgi.push({ ad: `eslesme_dalga_${g.plan.dalga}`, sayi: aktifler.length });
    const dagilim = new Map<string, number>();
    for (const e of aktifler) dagilim.set(e.hedef_tablo, (dagilim.get(e.hedef_tablo) ?? 0) + 1);
    for (const [tablo, sayi] of [...dagilim.entries()].sort()) bilgi.push({ ad: `eslesme_tablo_${tablo}`, sayi });
    bilgi.push({ ad: 'plan_atlanan', sayi: g.plan.atlananSayisi() });

    return { kontroller, farklar: farklariBul(kontroller), bilgi };
  } finally {
    await yazici.kapat();
  }
}

/* Fark tablosu ve kontrol toplamları `cikti.ts` kapısından: yalnız ad + tamsayılar. */
export function dogrulaSonucuYazdir(s: DogrulaSonucu): void {
  for (const k of s.kontroller) {
    olayYazdir({ tur: k.kaynak === k.hedef ? 'SONUC' : 'FARK', kod: k.kaynak === k.hedef ? 'ESIT' : 'FARK_VAR', alanlar: { kontrol: k.ad, kaynak: k.kaynak, hedef: k.hedef, fark: k.hedef - k.kaynak } });
  }
  for (const b of s.bilgi) olayYazdir({ tur: 'BILGI', kod: 'SAYIM', alanlar: { ad: b.ad, sayi: b.sayi } });
  olayYazdir({ tur: s.farklar.length === 0 ? 'SONUC' : 'FARK', kod: s.farklar.length === 0 ? 'DOGRULAMA_TAMAM' : 'DOGRULAMA_FARKI', alanlar: { fark_sayisi: s.farklar.length } });
}
