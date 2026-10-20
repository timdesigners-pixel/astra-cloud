import { describe, it, expect } from 'vitest';
import {
  alinanBorcMu, borcDurumuCoz, borcKategoriCoz, gelirTuruCoz, hacizDurumuCoz, hacizTuruCoz, sozlukAnahtari,
} from './sozluk-hesap.ts';

const BILINMIYOR = 'SOZLUK_BILINMIYOR';
const KARISIK_GIRDILER: ReadonlyArray<unknown> = ['', '   ', 'Diğer??', 'xyz', 'constructor', '__proto__', 'toString', 'hasOwnProperty', null, undefined, 5, {}, []];

describe('sozlukAnahtari', () => {
  it('Türkçe küçük harf, aksansız, tek boşluk anahtar üretir', () => {
    expect(sozlukAnahtari('Şahıs')).toBe('sahis');
    expect(sozlukAnahtari('ŞAHIS')).toBe('sahis');
    expect(sozlukAnahtari('İCRA')).toBe('icra');
    expect(sozlukAnahtari('ICRA')).toBe('icra');
    expect(sozlukAnahtari('Kaldırıldı')).toBe('kaldirildi');
    expect(sozlukAnahtari('  Ek_İş--Gelir ')).toBe('ek is gelir');
    expect(sozlukAnahtari('Alınan   Borç')).toBe('alinan borc');
  });
  it('metin olmayan girdi boş anahtar verir', () => {
    for (const g of [null, undefined, 5, {}, true]) expect(sozlukAnahtari(g)).toBe('');
  });
});

describe('borcKategoriCoz', () => {
  const tablo: ReadonlyArray<[string, string]> = [
    ['İcra', 'icra'], ['icra', 'icra'], ['ICRA', 'icra'],
    ['Vergi', 'vergi'], ['SGK', 'sgk'], ['sgk', 'sgk'],
    ['Banka', 'banka'], ['BANKA', 'banka'],
    ['Şahıs', 'kisi'], ['sahis', 'kisi'], ['Kişi', 'kisi'], ['KİŞİ', 'kisi'],
  ];
  it.each(tablo)('%s -> %s (kod yok)', (girdi, deger) => {
    expect(borcKategoriCoz(girdi)).toEqual({ deger, kod: null });
  });
  it('bilinmeyen, boş ve Diğer kategori kisi + SOZLUK_BILINMIYOR verir', () => {
    for (const g of ['Diğer', 'Bilinmeyen Kategori', ...KARISIK_GIRDILER]) expect(borcKategoriCoz(g)).toEqual({ deger: 'kisi', kod: BILINMIYOR });
  });
});

describe('borcDurumuCoz', () => {
  const tablo: ReadonlyArray<[string, string]> = [
    ['acik', 'acik'], ['Açık', 'acik'], ['kapandi', 'kapandi'], ['Kapandı', 'kapandi'],
    ['dava', 'acik'], ['pazarlik', 'yapilandirma'], ['Pazarlık', 'yapilandirma'], ['yapilandirma', 'yapilandirma'], ['Yapılandırma', 'yapilandirma'],
  ];
  it.each(tablo)('%s -> %s (kod yok)', (girdi, deger) => {
    expect(borcDurumuCoz(girdi)).toEqual({ deger, kod: null });
  });
  it('bilinmeyen/boş durum acik + SOZLUK_BILINMIYOR verir', () => {
    for (const g of KARISIK_GIRDILER) expect(borcDurumuCoz(g)).toEqual({ deger: 'acik', kod: BILINMIYOR });
  });
});

describe('gelirTuruCoz', () => {
  const tablo: ReadonlyArray<[string, string]> = [
    ['maas', 'maas'], ['Maaş', 'maas'], ['kira', 'kira'], ['faiz', 'faiz'], ['tarla', 'tarla'],
    ['ekis', 'ek_is'], ['Ek İş', 'ek_is'], ['ek_is', 'ek_is'], ['bahis', 'bahis'], ['borc', 'alinan_borc'], ['Borç', 'alinan_borc'],
    ['alinan borc', 'alinan_borc'], ['Alınan Borç', 'alinan_borc'], ['diger', 'diger'], ['Diğer', 'diger'],
  ];
  it.each(tablo)('%s -> %s (kod yok)', (girdi, deger) => {
    expect(gelirTuruCoz(girdi)).toEqual({ deger, kod: null });
  });
  it('tur="borc" kaynağı ne olursa olsun alinan_borc yapar', () => {
    expect(gelirTuruCoz('maas', 'borc')).toEqual({ deger: 'alinan_borc', kod: null });
    expect(gelirTuruCoz('zzz', 'Borç')).toEqual({ deger: 'alinan_borc', kod: null });
    expect(gelirTuruCoz(undefined, 'borc')).toEqual({ deger: 'alinan_borc', kod: null });
  });
  it('tur borç değilse src eşlemesi kullanılır', () => {
    expect(gelirTuruCoz('kira', 'baska')).toEqual({ deger: 'kira', kod: null });
  });
  it('bilinmeyen/boş src diger + SOZLUK_BILINMIYOR verir', () => {
    for (const g of KARISIK_GIRDILER) expect(gelirTuruCoz(g)).toEqual({ deger: 'diger', kod: BILINMIYOR });
  });
});

describe('alinanBorcMu', () => {
  it('yalnız borc türünü tanır', () => {
    expect(alinanBorcMu('borc')).toBe(true);
    expect(alinanBorcMu('BORÇ')).toBe(true);
    expect(alinanBorcMu('maas')).toBe(false);
    expect(alinanBorcMu('')).toBe(false);
    expect(alinanBorcMu(undefined)).toBe(false);
  });
});

describe('hacizTuruCoz', () => {
  const tablo: ReadonlyArray<[string, string]> = [
    ['maas', 'maas'], ['Maaş', 'maas'], ['banka', 'banka'], ['kira', 'kira'], ['arac', 'arac'], ['Araç', 'arac'],
    ['tasinmaz', 'tasinmaz'], ['Taşınmaz', 'tasinmaz'], ['ucuncu', 'ucuncu'], ['Üçüncü', 'ucuncu'], ['menkul', 'menkul'], ['diger', 'menkul'], ['Diğer', 'menkul'],
  ];
  it.each(tablo)('%s -> %s (kod yok)', (girdi, deger) => {
    expect(hacizTuruCoz(girdi)).toEqual({ deger, kod: null });
  });
  it('bilinmeyen/boş tür menkul + SOZLUK_BILINMIYOR verir', () => {
    for (const g of KARISIK_GIRDILER) expect(hacizTuruCoz(g)).toEqual({ deger: 'menkul', kod: BILINMIYOR });
  });
});

describe('hacizDurumuCoz', () => {
  const tablo: ReadonlyArray<[string, string]> = [['aktif', 'aktif'], ['AKTİF', 'aktif'], ['kaldirildi', 'kalkti'], ['Kaldırıldı', 'kalkti'], ['kalkti', 'kalkti']];
  it.each(tablo)('%s -> %s (kod yok)', (girdi, deger) => {
    expect(hacizDurumuCoz(girdi)).toEqual({ deger, kod: null });
  });
  it('bilinmeyen/boş durum aktif + SOZLUK_BILINMIYOR verir', () => {
    for (const g of KARISIK_GIRDILER) expect(hacizDurumuCoz(g)).toEqual({ deger: 'aktif', kod: BILINMIYOR });
  });
});
