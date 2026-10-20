/* Eski sistem serbest metin değerlerini hedef şemanın sabit listelerine çeviren sözlükler (spec B, plan H-6/H-10).
   Her sözlük `{deger, kod}` döndürür; bilinmeyen değerde kod 'SOZLUK_BILINMIYOR' olur ve güvenli bir varsayılan atanır. Kayıt metni rapora girmez. */

export type SozlukKodu = 'SOZLUK_BILINMIYOR';
export type SozlukSonucu<T extends string> = { deger: T; kod: SozlukKodu | null };

export type BorcTuru = 'kisi' | 'banka' | 'icra' | 'vergi' | 'sgk';
export type BorcDurumu = 'acik' | 'yapilandirma' | 'kapandi';
export type GelirTuru = 'maas' | 'kira' | 'faiz' | 'tarla' | 'ek_is' | 'bahis' | 'alinan_borc' | 'diger';
export type HacizTuru = 'maas' | 'banka' | 'kira' | 'arac' | 'tasinmaz' | 'ucuncu' | 'menkul';
export type HacizDurumu = 'aktif' | 'kalkti';

const TR_HARF: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/* Sözlük anahtarı: Türkçe küçük harf, aksansız, '_' ve '-' boşluk, tek boşluk. 'Şahıs'→'sahis', 'Kaldırıldı'→'kaldirildi'. */
export function sozlukAnahtari(girdi: unknown): string {
  if (typeof girdi !== 'string') return '';
  return girdi
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (h) => TR_HARF[h] ?? h)
    .replace(/[_\-\s]+/g, ' ')
    .trim();
}

function ara<T extends string>(tablo: Readonly<Record<string, T>>, girdi: unknown, varsayilan: T): SozlukSonucu<T> {
  const anahtar = sozlukAnahtari(girdi);
  if (Object.hasOwn(tablo, anahtar)) return { deger: tablo[anahtar]!, kod: null };
  return { deger: varsayilan, kod: 'SOZLUK_BILINMIYOR' };
}

const BORC_KATEGORI: Readonly<Record<string, BorcTuru>> = {
  icra: 'icra',
  vergi: 'vergi',
  sgk: 'sgk',
  banka: 'banka',
  sahis: 'kisi',
  kisi: 'kisi',
};

/* Borç kategorisi → `borclar.tur`: İcra→icra, Vergi→vergi, SGK→sgk, Banka→banka, Şahıs/Kişi→kisi; "Diğer"/bilinmeyen/boş → kisi + SOZLUK_BILINMIYOR. */
export function borcKategoriCoz(kategori: unknown): SozlukSonucu<BorcTuru> {
  return ara(BORC_KATEGORI, kategori, 'kisi');
}

const BORC_DURUM: Readonly<Record<string, BorcDurumu>> = {
  acik: 'acik',
  kapandi: 'kapandi',
  dava: 'acik',
  pazarlik: 'yapilandirma',
  yapilandirma: 'yapilandirma',
};

/* Borç durumu → `borclar.durum`: acik→acik, kapandi→kapandi, dava→acik, pazarlik→yapilandirma; bilinmeyen/boş → acik + SOZLUK_BILINMIYOR. */
export function borcDurumuCoz(durum: unknown): SozlukSonucu<BorcDurumu> {
  return ara(BORC_DURUM, durum, 'acik');
}

const GELIR_SRC: Readonly<Record<string, GelirTuru>> = {
  maas: 'maas',
  kira: 'kira',
  faiz: 'faiz',
  tarla: 'tarla',
  'ek is': 'ek_is',
  ekis: 'ek_is',
  bahis: 'bahis',
  borc: 'alinan_borc',
  'alinan borc': 'alinan_borc',
  diger: 'diger',
};

/* Alınan borç kaydı mı: gelir `tur` alanı 'borc' (KARAR-KAYDI: alınan borç gelir sayılmaz). */
export function alinanBorcMu(tur: unknown): boolean {
  return sozlukAnahtari(tur) === 'borc';
}

/* Gelir `src` (+ isteğe bağlı `tur`) → `gelirler.tur`. tur='borc' kaynağı her zaman alinan_borc yapar; bilinmeyen/boş src → diger + SOZLUK_BILINMIYOR. */
export function gelirTuruCoz(src: unknown, tur?: unknown): SozlukSonucu<GelirTuru> {
  if (alinanBorcMu(tur)) return { deger: 'alinan_borc', kod: null };
  return ara(GELIR_SRC, src, 'diger');
}

const HACIZ_TUR: Readonly<Record<string, HacizTuru>> = {
  maas: 'maas',
  banka: 'banka',
  kira: 'kira',
  arac: 'arac',
  tasinmaz: 'tasinmaz',
  ucuncu: 'ucuncu',
  menkul: 'menkul',
  diger: 'menkul',
};

/* Haciz türü → `icra_hacizler.tur`: diger→menkul; bilinmeyen/boş → menkul + SOZLUK_BILINMIYOR. */
export function hacizTuruCoz(tur: unknown): SozlukSonucu<HacizTuru> {
  return ara(HACIZ_TUR, tur, 'menkul');
}

const HACIZ_DURUM: Readonly<Record<string, HacizDurumu>> = {
  aktif: 'aktif',
  kaldirildi: 'kalkti',
  kalkti: 'kalkti',
};

/* Haciz durumu → `icra_hacizler.durum`: kaldirildi→kalkti; bilinmeyen/boş → aktif + SOZLUK_BILINMIYOR. */
export function hacizDurumuCoz(durum: unknown): SozlukSonucu<HacizDurumu> {
  return ara(HACIZ_DURUM, durum, 'aktif');
}
