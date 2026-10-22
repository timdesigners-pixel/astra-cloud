/* Komut katmanı hataları: yalnız sabit kod (+ tamsayı/kısa kod alanları) taşır; girdi değeri taşımaz. */
import type { OlayDegeri } from '../cikti.ts';

export type KullanimHataKodu =
  | 'KOMUT_BILINMIYOR'
  | 'BAYRAK_BILINMIYOR'
  | 'BAYRAK_DEGERI_YOK'
  | 'PIN_ARGUMANI_YASAK'
  | 'DALGA_GEREKLI'
  | 'DALGA_GECERSIZ'
  | 'GIRDI_GEREKLI'
  | 'AKTARIM_GEREKLI'
  | 'AKTARIM_GECERSIZ'
  | 'BASLANGIC_GEREKLI'
  | 'BASLANGIC_GECERSIZ'
  | 'KAYNAK_GEREKLI'
  /* --rapor, girdi dosyasının üzerine yazacaktı ya da sembolik bağlantı: yazılmadan reddedilir. */
  | 'RAPOR_YOLU_CAKISIYOR'
  | 'RAPOR_SEMBOLIK_BAGLANTI'
  | 'KOVA_GECERSIZ'
  /* statik-yukle kapsamı dışı: `dosyalar` kovası kaynak depoda yok (kova→kova kopyası ayrı iştir); `ilgi` H-4 ile menüden kaldırıldı. */
  | 'KAPSAM_DISI_DOSYALAR_KOVASI'
  | 'KAPSAM_DISI_ILGI';

/* Kullanım hatası → çıkış kodu 2. */
export class KullanimHatasi extends Error {
  kod: KullanimHataKodu;

  constructor(kod: KullanimHataKodu) {
    super(`KULLANIM_HATASI ${kod}`);
    this.name = 'KullanimHatasi';
    this.kod = kod;
  }
}

export type KomutHataKodu =
  | 'ONAY_UYUSMADI'
  | 'DALGA_YAZICI_YOK'
  | 'DESTEKLENMEYEN_TABLO'
  | 'STATIK_PLAN_SORUNLU'
  | 'STATIK_YUKLEYICI_YOK'
  | 'STATIK_DOSYA_DEGISTI'
  | 'STATIK_DOGRULAMA_FARKI';

export class KomutHatasi extends Error {
  kod: KomutHataKodu;
  alanlar: Readonly<Record<string, OlayDegeri>>;
  cikis: 1 | 2;

  constructor(kod: KomutHataKodu, alanlar: Readonly<Record<string, OlayDegeri>> = {}, cikis: 1 | 2 = 1) {
    super(`KOMUT_HATASI ${kod}`);
    this.name = 'KomutHatasi';
    this.kod = kod;
    this.alanlar = alanlar;
    this.cikis = cikis;
  }
}
