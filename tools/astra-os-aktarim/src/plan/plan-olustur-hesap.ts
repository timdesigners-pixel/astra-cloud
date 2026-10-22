/* Girdiden (S + isteğe bağlı ilgi ürün listesi) deterministik dalga planı üretir. SAF: dosya/ağ/ortam/saat yok.
   Dalga a bu görevde (T4) uygulanmıştır; b ve c dönüştürücüleri sonraki görevlerdir (plan §9.1 T8/T10) → boş plan + DALGA_DONUSTURUCU_YOK. */
import { ilgiDonustur } from '../donusum/ilgi-hesap.ts';
import type { BilgiKodu, KodluKayit } from '../donusum/neden-kodu.ts';
import { uygulamaDonustur } from '../donusum/uygulama-hesap.ts';
import type { SemaSonucu } from '../girdi/sema-ayristirici-hesap.ts';
import { anahtarAdiGuvenliMi } from '../guvenlik/anahtar-adi-hesap.ts';
import { sha256Hex } from '../guvenlik/ozet.ts';
import { Plan } from './plan.ts';
import { begeniFiyatToplami, girdiOzetiKur, hedefTablolariKur, kodSayilariKur } from './plan-ozet-hesap.ts';
import { DALGALAR, ESLENMEYEN_ANAHTAR_AZAMI, ESLENMEYEN_ANAHTAR_DESENI, PlanHatasi, type Dalga, type PlanKaydi, type PlanOzetiTaslagi, type Sayac } from './plan-tipleri.ts';

export type PlanGirdisi = {
  dalga: Dalga;
  sema: SemaSonucu;
  /* Ürün listesi (`--ilgi` JSON'undan çözülmüş dizi); yoksa ILGI_KAYNAK_YOK. */
  ilgiHam?: unknown;
  /* Hedef Supabase ana makine adı (örn. '<ref>.supabase.co'); onay koduna girer, rapora yalnız 8 hex özeti çıkar. */
  hedefAnaMakine: string;
  aracSurumu: string;
};

/* Hedef proje özeti: yanlış projeye yazmayı önlemek için onay koduna girer (plan §3.3). */
export function hedefRefKur(anaMakine: string): string {
  const temiz = anaMakine.trim().toLowerCase();
  if (temiz === '') throw new PlanHatasi('HEDEF_BOS');
  return sha256Hex(`hedef:${temiz}`).slice(0, 8);
}

export function planOlustur(girdi: PlanGirdisi): Plan {
  if (!(DALGALAR as readonly string[]).includes(girdi.dalga)) throw new PlanHatasi('DALGA_GECERSIZ');
  if (typeof girdi.aracSurumu !== 'string' || !/^\d+\.\d+\.\d+$/.test(girdi.aracSurumu)) throw new PlanHatasi('SURUM_GECERSIZ');
  const hedef_ref = hedefRefKur(girdi.hedefAnaMakine);

  const kayitlar: PlanKaydi[] = [];
  const atlananlar: KodluKayit[] = [];
  const uyarilar: KodluKayit[] = [];
  const bilgi: BilgiKodu[] = [];
  const sayaclar: Sayac[] = [];

  if (girdi.dalga === 'a') {
    const uyg = uygulamaDonustur(girdi.sema.s);
    const ilgi = ilgiDonustur(girdi.ilgiHam);
    for (const s of uyg.satirlar) {
      kayitlar.push({ tablo: 'uygulama_durumu', koleksiyon: 'apps', kaynak_id: `${s.uygulama}/${s.anahtar}`, ...s });
    }
    for (const s of ilgi.satirlar) {
      kayitlar.push({ tablo: 'begeniler', koleksiyon: 'ilgi_urunleri', kaynak_id: s.kod, satir: s });
    }
    atlananlar.push(...uyg.atlananlar, ...ilgi.atlananlar);
    uyarilar.push(...uyg.uyarilar, ...ilgi.uyarilar);
    bilgi.push(...ilgi.bilgi);
    sayaclar.push({ ad: 'uygulama_kaynak_anahtar', sayi: uyg.kaynak_anahtar_sayisi });
    for (const u of uyg.uygulama_sayilari) sayaclar.push({ ad: `uygulama_${u.uygulama}`, sayi: u.sayi });
    sayaclar.push({ ad: 'ilgi_kaynak_urun', sayi: ilgi.kaynak_sayisi });
  } else {
    bilgi.push('DALGA_DONUSTURUCU_YOK');
  }

  /* Kaybolan anahtarı kullanıcı görebilsin: yalnız AD (değer değil). Ad desene uymazsa ya da IBAN/uzun rakam dizisi gibiyse listelenmez (sayısı atlanan'da kalır). */
  const eslenmeyenler = [...new Set(atlananlar.filter((a) => a.neden_kodu === 'ANAHTAR_ESLENMEDI').map((a) => a.kaynak_id))]
    .filter((ad) => ESLENMEYEN_ANAHTAR_DESENI.test(ad) && anahtarAdiGuvenliMi(ad))
    .sort()
    .slice(0, ESLENMEYEN_ANAHTAR_AZAMI);

  const taslak: PlanOzetiTaslagi = {
    dalga: girdi.dalga,
    arac_surumu: girdi.aracSurumu,
    hedef_ref,
    girdi_ozeti: girdiOzetiKur(girdi.sema.ozet),
    hedef_tablolar: hedefTablolariKur(kayitlar, atlananlar),
    kontrol_toplamlari: girdi.dalga === 'a' ? [{ ad: 'begeniler_fiyat', kurus_toplami: begeniFiyatToplami(kayitlar) }] : [],
    sayaclar,
    atlanan: kodSayilariKur(atlananlar),
    uyarilar: kodSayilariKur(uyarilar),
    bilgi_kodlari: [...new Set(bilgi)].sort(),
    ...(eslenmeyenler.length > 0 ? { eslenmeyen_anahtarlar: eslenmeyenler } : {}),
  };
  return new Plan(girdi.dalga, taslak, { kayitlar, atlananlar, uyarilar });
}
