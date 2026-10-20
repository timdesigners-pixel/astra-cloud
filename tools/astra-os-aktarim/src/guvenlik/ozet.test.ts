import { describe, it, expect } from 'vitest';
import { ozetOlustur, sabitSureliEsitMi, sha256Hex, sha256HexBayt } from './ozet.ts';

describe('sha256Hex', () => {
  it('bilinen test vektörlerini üretir', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('UTF-8 kodlar (Türkçe karakterler)', () => {
    expect(sha256Hex('İ')).toBe(sha256HexBayt(new TextEncoder().encode('İ')));
    expect(sha256Hex('İ')).not.toBe(sha256Hex('I'));
  });
});

describe('sha256HexBayt', () => {
  it('ham baytı özetler', () => {
    expect(sha256HexBayt(new Uint8Array([0x61, 0x62, 0x63]))).toBe(sha256Hex('abc'));
    expect(sha256HexBayt(new Uint8Array())).toBe(sha256Hex(''));
  });
  it('geçersiz UTF-8 baytlarında bayt sadakati korunur', () => {
    expect(sha256HexBayt(new Uint8Array([0xff, 0xfe]))).not.toBe(sha256HexBayt(new Uint8Array([0xff, 0xff])));
  });
});

describe('ozetOlustur', () => {
  it('parça parça besleme tek parçayla aynı özeti verir', () => {
    const o = ozetOlustur();
    o.guncelle('a');
    o.guncelle('b');
    o.guncelle('c');
    expect(o.hex()).toBe(sha256Hex('abc'));
  });
});

describe('sabitSureliEsitMi', () => {
  it('eşit metni kabul eder', () => {
    expect(sabitSureliEsitMi('ONAY-a-0123456789ab', 'ONAY-a-0123456789ab')).toBe(true);
    expect(sabitSureliEsitMi('', '')).toBe(true);
  });
  it('farklı ve farklı uzunluktaki metni reddeder (hata fırlatmaz)', () => {
    expect(sabitSureliEsitMi('abc', 'abd')).toBe(false);
    expect(sabitSureliEsitMi('abc', 'abcd')).toBe(false);
    expect(sabitSureliEsitMi('abc', '')).toBe(false);
  });
  it('çok baytlı karakterlerde bayt uzunluğuna göre karşılaştırır', () => {
    expect(sabitSureliEsitMi('ı', 'i')).toBe(false);
    expect(sabitSureliEsitMi('ş', 'ş')).toBe(true);
  });
});
