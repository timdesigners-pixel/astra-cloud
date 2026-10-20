import { describe, it, expect } from 'vitest';
import { SAYI_METNI_VARYANTLARI } from '@astra/ortak-test';
import { kurusaCevir, kurusToplami, kurusYuvarla, trSayi, tutarCoz } from './sayi-hesap.ts';

describe('trSayi', () => {
  const tablo: ReadonlyArray<[unknown, number]> = [
    ['1,234', 1.234],
    ['1,234,567', 1234567],
    ['1.234,56', 1234.56],
    ['1,234.5', 1234.5],
    ['1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ['1.234', 1234],
    ['1.234.567', 1234567],
    ['12.5', 12.5],
    ['12,5', 12.5],
    ['0,5', 0.5],
    [',5', 0.5],
    ['.5', 0.5],
    ['%12', 12],
    ['12%', 12],
    ['₺99', 99],
    ['99₺', 99],
    ['12 TL', 12],
    ['12 tl', 12],
    ['TRY 5', 5],
    ['try5', 5],
    ['₺ 1.234,56', 1234.56],
    ['-1.234,56', -1234.56],
    ['-₺5', -5],
    ['−5', -5],
    ['+7', 7],
    ['  42  ', 42],
    ['1 234', 1234],
    ['1 234,5', 1234.5],
    ['0', 0],
    ['007', 7],
    [5, 5],
    [-3.25, -3.25],
    [0, 0],
  ];
  it.each(tablo)('%j -> %d', (girdi, beklenen) => {
    expect(trSayi(girdi)).toBe(beklenen);
  });

  const gecersiz: ReadonlyArray<unknown> = [
    '', '   ', 'abc', '12abc', 'abc12', '1e5', '--5', '+-5', 'TL', '₺', '%', '1.2.3', '1,23,456', '1.234,56,7', '1,234.56.7', '1.234,5.6',
    '1,,234', '..', ',', '.', '١٢٣', '0x10', 'Infinity', 'NaN',
    null, undefined, true, {}, [], [1], NaN, Infinity, -Infinity, () => 1,
  ];
  it.each(gecersiz.map((g) => [g]))('%j -> NaN', (girdi) => {
    expect(trSayi(girdi)).toBeNaN();
  });

  it('ortak sentetik tr-TR varyant tablosunun hepsini çözer', () => {
    for (const v of SAYI_METNI_VARYANTLARI) {
      const sonuc = trSayi(v.metin);
      if (v.beklenen === null) expect(sonuc, v.aciklama).toBeNaN();
      else expect(sonuc, v.aciklama).toBe(v.beklenen);
    }
  });
});

describe('tutarCoz', () => {
  it('geçerli metinde tamam: true ve değeri döner', () => {
    expect(tutarCoz('1.234,56')).toEqual({ tamam: true, deger: 1234.56 });
    expect(tutarCoz(0)).toEqual({ tamam: true, deger: 0 });
    expect(tutarCoz('-12,5')).toEqual({ tamam: true, deger: -12.5 });
  });
  it.each([[''], ['abc'], [null], [undefined], [NaN], [{}]])('%j için GECERSIZ_TUTAR kodu döner', (girdi) => {
    expect(tutarCoz(girdi)).toEqual({ tamam: false, kod: 'GECERSIZ_TUTAR' });
  });
});

describe('kurusaCevir', () => {
  const tablo: ReadonlyArray<[number, number]> = [
    [1.005, 101], /* kayan nokta 1.00499.. olsa da ondalık metin üzerinden yarım-yukarı */
    [0.125, 13],
    [2.675, 268],
    [0.005, 1],
    [0.004, 0],
    [0.1 + 0.2, 30],
    [1234.5, 123450],
    [0, 0],
    [100, 10000],
    [15000.5, 1500050],
    [-1.005, -101],
    [-0.125, -13],
    [-12.34, -1234],
    [1e-7, 0],
  ];
  it.each(tablo)('%d -> %d kuruş', (girdi, beklenen) => {
    expect(kurusaCevir(girdi)).toBe(beklenen);
  });
  it('negatif sınır değerler sıfırdan uzağa yuvarlanır (simetrik)', () => {
    for (const x of [0.005, 0.015, 1.005, 2.675, 10.125]) expect(kurusaCevir(-x)).toBe(-kurusaCevir(x));
  });
  it.each([[NaN], [Infinity], [-Infinity], [1e21], [Number.MAX_SAFE_INTEGER], [-Number.MAX_SAFE_INTEGER]])('%d güvenli tamsayı dışında NaN döner', (girdi) => {
    expect(kurusaCevir(girdi)).toBeNaN();
  });
});

describe('kurusYuvarla', () => {
  it('iki haneye yarım-yukarı yuvarlar', () => {
    expect(kurusYuvarla(1.005)).toBe(1.01);
    expect(kurusYuvarla(0.125)).toBe(0.13);
    expect(kurusYuvarla(1.004)).toBe(1);
    expect(kurusYuvarla(-1.005)).toBe(-1.01);
    expect(kurusYuvarla(1234.5)).toBe(1234.5);
  });
  it('geçersizde NaN döner', () => {
    expect(kurusYuvarla(NaN)).toBeNaN();
    expect(kurusYuvarla(Infinity)).toBeNaN();
  });
});

describe('kurusToplami', () => {
  it('tutarların kuruşlarını tamsayı olarak toplar (kayan nokta kayması yok)', () => {
    expect(kurusToplami([0.1, 0.2])).toEqual({ kurus: 30, gecersiz: 0 });
    expect(kurusToplami([1.005, 2.5, -0.125])).toEqual({ kurus: 101 + 250 - 13, gecersiz: 0 });
    expect(kurusToplami([125000, 15000.5, 54321.99])).toEqual({ kurus: 12500000 + 1500050 + 5432199, gecersiz: 0 });
  });
  it('boş listede sıfır döner', () => {
    expect(kurusToplami([])).toEqual({ kurus: 0, gecersiz: 0 });
  });
  it('geçersiz öğeleri atlar ve ayrıca sayar (sessiz düşme yok)', () => {
    expect(kurusToplami([1, NaN, Infinity, 2])).toEqual({ kurus: 300, gecersiz: 2 });
  });
  it('negatif tutarlar (bahis zararı) toplamdan düşer', () => {
    expect(kurusToplami([1000, -1250.5])).toEqual({ kurus: 100000 - 125050, gecersiz: 0 });
  });
  it('toplam sonuç Σ yuvarlanmış kuruşa eşittir, yuvarlanmış toplama değil', () => {
    /* üç kez 0.005 → her biri 1 kuruş = 3; (0.015 toplamı yuvarlansa 2 olurdu) */
    expect(kurusToplami([0.005, 0.005, 0.005]).kurus).toBe(3);
  });
});
