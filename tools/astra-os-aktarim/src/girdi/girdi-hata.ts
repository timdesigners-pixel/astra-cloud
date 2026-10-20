/* Girdi okuma/ayrıştırma hata kodları. Mesajlar kayıt DEĞERİ taşımaz: yalnız kod, şema yolu ve sayı. */
export type GirdiHataKodu =
  | 'GIRDI_YOLU_YOK'
  | 'DOSYA_OKUNAMADI'
  | 'GIRDI_COK_BUYUK'
  | 'GIRDI_BOS'
  | 'BOZUK_JSON'
  | 'SIFRELI_GIRDI'
  | 'GIRDI_BICIMI_TANINMADI'
  | 'SEMA_GECERSIZ';

/* Anlamlı ama değersiz hata: `yol` yalnız bilinen şema adlarından (örn. 'koleksiyon.debts') kurulur, girdiden kopyalanmaz. */
export class GirdiHatasi extends Error {
  kod: GirdiHataKodu;
  yol: string | null;
  sayi: number | null;

  constructor(kod: GirdiHataKodu, yol: string | null = null, sayi: number | null = null) {
    super(mesajKur(kod, yol, sayi));
    this.name = 'GirdiHatasi';
    this.kod = kod;
    this.yol = yol;
    this.sayi = sayi;
  }
}

function mesajKur(kod: GirdiHataKodu, yol: string | null, sayi: number | null): string {
  let m = `GIRDI_HATASI ${kod}`;
  if (yol !== null) m += ` yol=${yol}`;
  if (sayi !== null) m += ` sayi=${sayi}`;
  return m;
}
