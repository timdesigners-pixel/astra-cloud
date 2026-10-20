/* Dönüştürücülerin ve planın ortak rapor kodları. Kodlar sabit bir kümedir: rapora kayıt metni değil yalnız bu kodlar girer. */

export const NEDEN_KODLARI = [
  'MEZAR_TASI', 'GECERSIZ_TUTAR', 'GECERSIZ_TARIH', 'AD_BOS', 'AD_UZUN_KIRPILDI', 'SOZLUK_BILINMIYOR', 'IBAN_GECERSIZ', 'IBAN_TEKRAR',
  'ICRA_BORC_ESLESTI', 'PARA_BIRIMI_TRY_DISI', 'SIFRELI_GIRDI', 'DEGER_COK_BUYUK', 'ANAHTAR_COK_UZUN', 'TEKRAR_ESLESME',
  'ANAHTAR_COK_FAZLA', 'ANAHTAR_ESLENMEDI', 'DEGER_METIN_DEGIL', 'KOD_BOS', 'KOD_UZUN', 'KOD_TEKRAR', 'ILGI_KAYDI_GECERSIZ',
  'ALAN_KIRPILDI', 'ALAN_COK_UZUN', 'ALAN_BICIMI_GECERSIZ', 'ALAN_ARALIK_DISI', 'PUAN_YUVARLANDI', 'FIYAT_GECMISI_ELENDI',
] as const;
export type NedenKodu = (typeof NEDEN_KODLARI)[number];

/* Bilgi kodları: hata değil, "bu girdi/dalga için üretilecek veri yok" bildirimi. */
export const BILGI_KODLARI = ['ILGI_KAYNAK_YOK', 'DALGA_DONUSTURUCU_YOK'] as const;
export type BilgiKodu = (typeof BILGI_KODLARI)[number];

/* Atlanan ya da uyarı alan kayıt. `kaynak_id` yalnız bellekte ve onay özetinde kullanılır; rapora girmez (rapora yalnız sayı girer). */
export type KodluKayit = { koleksiyon: string; kaynak_id: string; neden_kodu: NedenKodu };
