/* Eşlenmeyen uygulama anahtarı ADLARININ rapora/çıktıya girip giremeyeceği. SAF. Tek kaynak: plan (listeyi kurar) ve rapor şeması (doğrular) aynı kuralı kullanır.
   Amaç: IBAN/dosya no gibi sayısal kimlik, ad gibi görünerek (ayraçlı da) çıktıya sızmasın. Kural muhafazakârdır, yanlış reddetmek yanlış sızdırmaktan iyidir:
   - ardışık 8+ rakam → listelenmez;
   - ayraçlarla ('-', '_', '.', boşluk) bölünmüş olsa da toplam rakam sayısı >= 12 → listelenmez (örn. 'TR33-0006-1005-1978-6457-8413-26').
   Sınır: ayraçlarla bölünmüş 12'den az rakam ('a1234-5678' gibi) kabul edilir; harflerle bölünmüş uzun kimlik de bu kuralla yakalanmayabilir (son savunma: cikti.ts IBAN deseni). */
export const AZAMI_ARDISIK_RAKAM = 8;
export const AZAMI_TOPLAM_RAKAM = 12;

export function anahtarAdiGuvenliMi(ad: string): boolean {
  if (new RegExp(`\\d{${AZAMI_ARDISIK_RAKAM},}`).test(ad)) return false;
  /* Ayraçlar çıkarılır; kalan metindeki rakamlar sayılır. */
  const rakamlar = ad.replace(/[-_.\s]/g, '').replace(/\D/g, '');
  return rakamlar.length < AZAMI_TOPLAM_RAKAM;
}
