/* IBAN yardımcıları. Düz IBAN yalnız bellekte tutulur: bu dosya hiçbir şey yazmaz, hata metinlerine değer koymaz, sonuçlarda yalnız kod/son 4 hane döner.
   Neden yeni: sunucu tarafındaki `iban_gecerli_mi` (SQL) istemci aracından çağrılamaz; dry-run sınıflandırması çevrimdışı çalışmalıdır. */

export type IbanKodu = 'IBAN_BOS' | 'IBAN_GECERSIZ';

const TR_IBAN = /^TR\d{24}$/;

/* Boşluk, kesme işareti, tire temizler; büyük harfe çevirir. Metin değilse '' döner. */
export function ibanNormallestir(girdi: unknown): string {
  if (typeof girdi !== 'string') return '';
  return girdi.replace(/[\s  '’‘`´\-]+/g, '').toUpperCase();
}

/* Normalleştirilmiş IBAN'ın mod-97 (ISO 13616) sağlaması; ülke/uzunluk denetimi yapmaz. */
function mod97Tamam(iban: string): boolean {
  const duzen = iban.slice(4) + iban.slice(0, 4);
  let kalan = 0;
  for (const h of duzen) {
    const kod = h.charCodeAt(0);
    if (kod >= 48 && kod <= 57) kalan = (kalan * 10 + (kod - 48)) % 97;
    else if (kod >= 65 && kod <= 90) kalan = (kalan * 100 + (kod - 55)) % 97;
    else return false;
  }
  return kalan === 1;
}

/* TR biçimi (TR + 24 rakam = 26 karakter) ve mod-97 geçerli mi. Girdi normalleştirilir. */
export function ibanGecerliMi(girdi: unknown): boolean {
  const n = ibanNormallestir(girdi);
  return TR_IBAN.test(n) && mod97Tamam(n);
}

/* IBAN sınıfı: null = geçerli; boş girdi → 'IBAN_BOS'; biçim/mod-97 hatası → 'IBAN_GECERSIZ' (rapor kodu). */
export function ibanKoduBul(girdi: unknown): IbanKodu | null {
  if (ibanNormallestir(girdi) === '') return 'IBAN_BOS';
  return ibanGecerliMi(girdi) ? null : 'IBAN_GECERSIZ';
}

/* Normalleştirilmiş IBAN'ın son 4 karakteri (`iban_son4` karşılığı); 4 karakterden kısaysa ''. */
export function ibanSon4(girdi: unknown): string {
  const n = ibanNormallestir(girdi);
  return n.length >= 4 ? n.slice(-4) : '';
}
