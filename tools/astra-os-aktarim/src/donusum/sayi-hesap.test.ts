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

describe('trSayi: baş grup 0 olan noktalı dize ondalıktır (binlik değil; 1000 kat büyütme hatası)', () => {
  const ondalik: ReadonlyArray<[string, number]> = [
    ['0.125', 0.125],
    ['0.500', 0.5],
    ['0.999', 0.999],
    ['0.000', 0],
    ['-0.123', -0.123],
    ['+0.123', 0.123],
    ['₺0.125', 0.125],
    ['0.125 TL', 0.125],
    ['00.123', 0.123], /* baş sıfırlı grup da binlik sayılmaz */
    ['01.234', 1.234],
    ['.125', 0.125],
  ];
  it.each(ondalik)('%j -> %d (ondalık)', (girdi, beklenen) => {
    expect(trSayi(girdi)).toBe(beklenen);
  });

  const binlik: ReadonlyArray<[string, number]> = [
    ['1.234', 1234],
    ['12.345.678', 12345678],
    ['10.250', 10250],
    ['1.005', 1005],
    ['100.000', 100000],
    ['999.999', 999999],
    ['-1.234', -1234],
    ['₺1.234', 1234],
    ['1.234.567', 1234567],
  ];
  it.each(binlik)('%j -> %d (binlik, değişmez)', (girdi, beklenen) => {
    expect(trSayi(girdi)).toBe(beklenen);
  });

  it('sınır: 0 ile başlayan çok gruplu dize binlik olamaz ve ondalık da olamaz -> NaN', () => {
    expect(trSayi('0.125.000')).toBeNaN();
    expect(trSayi('0.123.456')).toBeNaN();
    expect(trSayi('0,123,456')).toBeNaN();
  });

  it('sınır: karışık ayraçta baş grup 0 ise bozuk gruplama sayılır -> NaN (eski davranış 123.45 idi)', () => {
    expect(trSayi('0.123,45')).toBeNaN();
    expect(trSayi('0,123.45')).toBeNaN();
  });

  it('sınır: 4 haneli baş grup binlik değildir, ondalık okunur (1234.567)', () => {
    expect(trSayi('1234.567')).toBe(1234.567);
  });

  it('ondalık metin kuruşa çevrilince 1000 kat sapmaz (0.125 -> 13 kuruş, 0.500 -> 50 kuruş)', () => {
    expect(kurusaCevir(trSayi('0.125'))).toBe(13);
    expect(kurusaCevir(trSayi('0.500'))).toBe(50);
    expect(kurusaCevir(trSayi('0.999'))).toBe(100);
    expect(kurusaCevir(trSayi('-0.123'))).toBe(kurusaCevir(-0.123));
    expect(kurusaCevir(trSayi('1.005'))).toBe(100500); /* binlik: 1005 TL */
  });

  it('metin ve sayı biçimi aynı tutarı verir (0.125 dize === 0.125 sayı)', () => {
    expect(trSayi('0.125')).toBe(trSayi(0.125));
  });

  it('tutarCoz da aynı kuralı izler', () => {
    expect(tutarCoz('0.125')).toEqual({ tamam: true, deger: 0.125 });
    expect(tutarCoz('1.005')).toEqual({ tamam: true, deger: 1005 });
    expect(tutarCoz('0.125.000')).toEqual({ tamam: false, kod: 'GECERSIZ_TUTAR' });
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
