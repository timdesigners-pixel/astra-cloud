/* Ortam değişkeni okuyucu: `process.env` YALNIZ bu dosyada okunur. Değerler `Gizli` sarmalayıcıda tutulur; hiçbir yere yazdırılmaz,
   loglanmaz, hata mesajına konmaz (hatalar yalnız kod + değişken ADI taşır). */
import { ORTAM_PIN, ORTAM_SERVIS_ANAHTARI, ORTAM_SUPABASE_ANON, ORTAM_SUPABASE_URL, type OrtamAdi } from './guvenlik/ortam-adlari.ts';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/* Sır sarmalayıcı: dize/JSON/inspect dönüşümlerinde '[gizli]' görünür; değer yalnız `ac()` ile alınır. */
export class Gizli {
  #deger: string;

  constructor(deger: string) {
    this.#deger = deger;
  }

  ac(): string {
    return this.#deger;
  }

  toString(): string {
    return '[gizli]';
  }

  toJSON(): string {
    return '[gizli]';
  }

  [INSPECT](): string {
    return '[gizli]';
  }

  [Symbol.toPrimitive](): string {
    return '[gizli]';
  }
}

export type AyarHataKodu = 'ORTAM_EKSIK' | 'URL_GECERSIZ';

/* Hata yalnız kod ve (varsa) değişken adını taşır; değer asla. */
export class AyarHatasi extends Error {
  kod: AyarHataKodu;
  degisken: OrtamAdi | null;

  constructor(kod: AyarHataKodu, degisken: OrtamAdi | null = null) {
    super(`AYAR_HATASI ${kod}${degisken !== null ? ` degisken=${degisken}` : ''}`);
    this.name = 'AyarHatasi';
    this.kod = kod;
    this.degisken = degisken;
  }
}

export type Ortam = Readonly<Record<string, string | undefined>>;

const ANA_MAKINE_DESENI = /^[a-z0-9][a-z0-9-]{1,62}\.supabase\.co$/;

/* Hedef URL doğrulaması: yalnız `https://<ref>.supabase.co` (yol/sorgu/kimlik/port yok). Dönüş: küçük harfli ana makine adı. */
export function hedefAnaMakineCoz(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    throw new AyarHatasi('URL_GECERSIZ', ORTAM_SUPABASE_URL);
  }
  const yolTemiz = u.pathname === '/' || u.pathname === '';
  if (u.protocol !== 'https:' || u.username !== '' || u.password !== '' || u.port !== '' || u.search !== '' || u.hash !== '' || !yolTemiz) {
    throw new AyarHatasi('URL_GECERSIZ', ORTAM_SUPABASE_URL);
  }
  const ana = u.hostname.toLowerCase();
  if (!ANA_MAKINE_DESENI.test(ana)) throw new AyarHatasi('URL_GECERSIZ', ORTAM_SUPABASE_URL);
  return ana;
}

/* Rapora girecek kısaltma: proje ref'inin ilk 4 karakteri ('mwrb...'). */
export function anaMakineKisalt(anaMakine: string): string {
  return `${anaMakine.split('.')[0]!.slice(0, 4)}...`;
}

function oku(ortam: Ortam, ad: OrtamAdi): string | null {
  const d = ortam[ad];
  return typeof d === 'string' && d.trim() !== '' ? d.trim() : null;
}

function zorunluOku(ortam: Ortam, ad: OrtamAdi): Gizli {
  const d = oku(ortam, ad);
  if (d === null) throw new AyarHatasi('ORTAM_EKSIK', ad);
  return new Gizli(d);
}

/* Yalnız hedef proje (kuru çalıştırma onay kodu için gerekir; kimlik bilgisi değildir ve okunmaz). */
export function hedefOku(ortam: Ortam = process.env): { anaMakine: string; kisa: string } {
  const anaMakine = hedefAnaMakineCoz(zorunluOku(ortam, ORTAM_SUPABASE_URL).ac());
  return { anaMakine, kisa: anaMakineKisalt(anaMakine) };
}

export type Ayar = {
  anaMakine: string;
  kisa: string;
  supabaseUrl: Gizli;
  anonAnahtar: Gizli;
  /* PIN isteğe bağlı: yoksa komut katmanı TTY'de yankısız ister. */
  pin: Gizli | null;
  /* Yalnız statik-yukle için istenir; diğer komutlarda hiç okunmaz. */
  servisAnahtari: Gizli | null;
};

export type AyarSecenegi = { servisAnahtari?: boolean };

/* Çevrimiçi komutlar için tam ayar. Servis anahtarı yalnız `servisAnahtari: true` ise okunur ve o zaman zorunludur. */
export function ayarOku(secenek: AyarSecenegi = {}, ortam: Ortam = process.env): Ayar {
  const hedef = hedefOku(ortam);
  const pinHam = oku(ortam, ORTAM_PIN);
  return {
    anaMakine: hedef.anaMakine,
    kisa: hedef.kisa,
    supabaseUrl: zorunluOku(ortam, ORTAM_SUPABASE_URL),
    anonAnahtar: zorunluOku(ortam, ORTAM_SUPABASE_ANON),
    pin: pinHam !== null ? new Gizli(pinHam) : null,
    servisAnahtari: secenek.servisAnahtari === true ? zorunluOku(ortam, ORTAM_SERVIS_ANAHTARI) : null,
  };
}
