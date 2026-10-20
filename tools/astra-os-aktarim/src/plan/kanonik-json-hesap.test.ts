import { describe, it, expect } from 'vitest';
import { kanonikYaz } from './kanonik-json-hesap.ts';

function kanonik(deger: unknown): string {
  const parcalar: string[] = [];
  kanonikYaz(deger, (p) => void parcalar.push(p));
  return parcalar.join('');
}

describe('kanonikYaz', () => {
  it('nesne anahtarlarını sıralar; girdi sırası sonucu değiştirmez', () => {
    expect(kanonik({ b: 1, a: 2, c: { z: 1, y: 2 } })).toBe('{"a":2,"b":1,"c":{"y":2,"z":1}}');
    expect(kanonik({ c: { y: 2, z: 1 }, a: 2, b: 1 })).toBe(kanonik({ b: 1, a: 2, c: { z: 1, y: 2 } }));
  });
  it('dizi sırasını korur', () => {
    expect(kanonik([3, 1, 2])).toBe('[3,1,2]');
    expect(kanonik([[], [[]], {}])).toBe('[[],[[]],{}]');
  });
  it('ilkel türleri JSON ile uyumlu yazar', () => {
    expect(kanonik('ş"\\\n')).toBe(JSON.stringify('ş"\\\n'));
    expect(kanonik(true)).toBe('true');
    expect(kanonik(false)).toBe('false');
    expect(kanonik(null)).toBe('null');
    expect(kanonik(undefined)).toBe('null');
    expect(kanonik(12.5)).toBe('12.5');
    expect(kanonik(-3)).toBe('-3');
  });
  it('negatif sıfırı sıfır yazar', () => {
    expect(kanonik(-0)).toBe('0');
    expect(kanonik({ a: -0 })).toBe('{"a":0}');
  });
  it('tanımsız nesne alanlarını atlar (undefined anahtarı yok sayılır)', () => {
    expect(kanonik({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(kanonik({ a: null })).toBe('{"a":null}');
  });
  it('JSON.stringify ile anahtar sıralı eşdeğerdir', () => {
    const nesne = { z: [1, { b: 'ç', a: null }], a: 'x', m: { k: true } };
    expect(kanonik(nesne)).toBe('{"a":"x","m":{"k":true},"z":[1,{"a":null,"b":"ç"}]}');
    expect(JSON.parse(kanonik(nesne))).toEqual(nesne);
  });
  it('sonsuz ve NaN sayıda KANONIK_SAYI_GECERSIZ fırlatır', () => {
    for (const n of [NaN, Infinity, -Infinity]) expect(() => kanonik(n)).toThrowError('KANONIK_SAYI_GECERSIZ');
    expect(() => kanonik({ a: [NaN] })).toThrowError('KANONIK_SAYI_GECERSIZ');
  });
  it('fonksiyon, sembol ve bigint için KANONIK_TUR_GECERSIZ fırlatır', () => {
    for (const v of [() => 1, Symbol('x'), 5n]) expect(() => kanonik(v)).toThrowError('KANONIK_TUR_GECERSIZ');
  });
  it('büyük girdiyi parça parça besler (tek metne çevirmez)', () => {
    const parcalar: string[] = [];
    kanonikYaz({ a: [1, 2, 3], b: 'x' }, (p) => void parcalar.push(p));
    expect(parcalar.length).toBeGreaterThan(5);
  });
});
