/* Dalga planı tipleri. Plan kayıt DEĞERLERİNİ bellekte taşır; dışarı yalnız `PlanOzeti` (sayı/kod) çıkar. */
import type { BilgiKodu, KodluKayit, NedenKodu } from '../donusum/neden-kodu.ts';
import type { BegeniSatiri } from '../donusum/ilgi-hesap.ts';
import type { UygulamaSatiri } from '../donusum/uygulama-hesap.ts';

export const DALGALAR = ['a', 'b', 'c'] as const;
export type Dalga = (typeof DALGALAR)[number];

/* `aktarim_eslesme.hedef_tablo` ile aynı küme (plan §5.1). */
export const HEDEF_TABLOLARI = [
  'kisiler', 'ibanlar', 'hesaplar', 'borclar', 'icra_dosyalari', 'icra_planlari', 'icra_hacizler', 'davalar', 'ajanda_olaylari',
  'gelirler', 'giderler', 'vadeler', 'odemeler', 'varliklar', 'hedefler', 'alinacaklar', 'istekler', 'begeniler', 'limitler',
  'todolar', 'zihin_sayfalari', 'sifre_hesaplari', 'ayarlar', 'uygulama_durumu',
] as const;
export type HedefTablo = (typeof HEDEF_TABLOLARI)[number];

export type UygulamaPlanKaydi = { tablo: 'uygulama_durumu'; koleksiyon: 'apps'; kaynak_id: string } & UygulamaSatiri;
export type BegeniPlanKaydi = { tablo: 'begeniler'; koleksiyon: 'ilgi_urunleri'; kaynak_id: string; satir: BegeniSatiri };
export type PlanKaydi = UygulamaPlanKaydi | BegeniPlanKaydi;

export type SayiSatiri = { koleksiyon: string; sayi: number };
export type GirdiOzeti = {
  koleksiyon_sayilari: SayiSatiri[];
  silinen_mezar_sayisi: number;
  bilinmeyen_anahtar_sayisi: number;
  gecersiz_kayit_sayisi: number;
};
export type HedefTabloOzeti = { tablo: HedefTablo; yeni: number; atlanan: number };
export type KontrolToplami = { ad: string; kurus_toplami: number };
export type Sayac = { ad: string; sayi: number };
export type KodSatiri = { koleksiyon: string; neden_kodu: NedenKodu; sayi: number };

/* Onay kodu hariç özet: onay kodu bu özetin özetidir. */
export type PlanOzetiTaslagi = {
  dalga: Dalga;
  arac_surumu: string;
  hedef_ref: string;
  girdi_ozeti: GirdiOzeti;
  hedef_tablolar: HedefTabloOzeti[];
  kontrol_toplamlari: KontrolToplami[];
  sayaclar: Sayac[];
  atlanan: KodSatiri[];
  uyarilar: KodSatiri[];
  bilgi_kodlari: BilgiKodu[];
};
export type PlanOzeti = PlanOzetiTaslagi & { onay_kodu: string };

export type PlanVerisi = { kayitlar: readonly PlanKaydi[]; atlananlar: readonly KodluKayit[]; uyarilar: readonly KodluKayit[] };

/* Plan kurma hataları: yalnız kod taşır, girdi değeri taşımaz. */
export class PlanHatasi extends Error {
  kod: 'HEDEF_BOS' | 'DALGA_GECERSIZ' | 'SURUM_GECERSIZ';

  constructor(kod: 'HEDEF_BOS' | 'DALGA_GECERSIZ' | 'SURUM_GECERSIZ') {
    super(`PLAN_HATASI ${kod}`);
    this.name = 'PlanHatasi';
    this.kod = kod;
  }
}
