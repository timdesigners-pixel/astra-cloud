import { describe, it, expect } from 'vitest';
import { CANARY_IBAN, SENTETIK_GECERSIZ_IBAN, ibanBoslukluYaz, testIbanlari } from '@astra/ortak-test';
import { ibanGecerliMi, ibanKoduBul, ibanNormallestir, ibanSon4 } from './iban-hesap.ts';

const GECERLI = testIbanlari(77, 10);

describe('ibanNormallestir', () => {
  it('boşluk, tire ve kesme işaretini atar, büyük harfe çevirir', () => {
    expect(ibanNormallestir(' tr12 3456-7890 ')).toBe('TR1234567890');
    expect(ibanNormallestir("tr12'3456")).toBe('TR123456');
  });
  it('metin olmayan girdi için boş metin döner', () => {
    for (const g of [null, undefined, 5, {}, []]) expect(ibanNormallestir(g)).toBe('');
  });
});

describe('ibanGecerliMi', () => {
  it('mod-97 geçerli TR IBAN\'ları kabul eder (bitişik, boşluklu, küçük harfli)', () => {
    for (const iban of GECERLI) {
      expect(ibanGecerliMi(iban)).toBe(true);
      expect(ibanGecerliMi(ibanBoslukluYaz(iban))).toBe(true);
      expect(ibanGecerliMi(iban.toLowerCase())).toBe(true);
    }
    expect(ibanGecerliMi(CANARY_IBAN)).toBe(true);
  });
  it('mod-97 geçersiz IBAN\'ı reddeder', () => {
    expect(ibanGecerliMi(SENTETIK_GECERSIZ_IBAN)).toBe(false);
    /* her geçerli IBAN\'ın son hanesi değişince geçersizleşir */
    for (const iban of GECERLI) expect(ibanGecerliMi(iban.slice(0, -1) + String((Number(iban.slice(-1)) + 1) % 10))).toBe(false);
  });
  it('biçim hatalarını reddeder (kısa, uzun, yanlış ülke, harf içeren)', () => {
    const iyi = GECERLI[0]!;
    expect(ibanGecerliMi(iyi.slice(0, -1))).toBe(false);
    expect(ibanGecerliMi(iyi + '0')).toBe(false);
    expect(ibanGecerliMi('DE89370400440532013000')).toBe(false);
    expect(ibanGecerliMi('DE' + iyi.slice(2))).toBe(false);
    expect(ibanGecerliMi(iyi.slice(0, 10) + 'X' + iyi.slice(11))).toBe(false);
    expect(ibanGecerliMi('TR')).toBe(false);
  });
  it('metin olmayan ve boş girdiyi reddeder', () => {
    for (const g of [null, undefined, '', '   ', 5, {}]) expect(ibanGecerliMi(g)).toBe(false);
  });
});

describe('ibanKoduBul', () => {
  it('geçerli IBAN için null döner', () => {
    expect(ibanKoduBul(GECERLI[0])).toBeNull();
    expect(ibanKoduBul(ibanBoslukluYaz(GECERLI[1]!))).toBeNull();
  });
  it('boş girdi IBAN_BOS verir', () => {
    for (const g of ['', '   ', null, undefined, ' - ']) expect(ibanKoduBul(g)).toBe('IBAN_BOS');
  });
  it('geçersiz IBAN IBAN_GECERSIZ verir', () => {
    expect(ibanKoduBul(SENTETIK_GECERSIZ_IBAN)).toBe('IBAN_GECERSIZ');
    expect(ibanKoduBul('abc')).toBe('IBAN_GECERSIZ');
  });
  it('sonuç kodunda düz IBAN yoktur', () => {
    for (const g of [GECERLI[0], SENTETIK_GECERSIZ_IBAN, '']) {
      const sonuc = String(ibanKoduBul(g));
      expect(sonuc).toMatch(/^(null|IBAN_BOS|IBAN_GECERSIZ)$/);
    }
  });
});

describe('ibanSon4', () => {
  it('normalleştirilmiş IBAN\'ın son 4 hanesini verir ve düz IBAN\'ı içermez', () => {
    for (const iban of GECERLI) {
      const son4 = ibanSon4(ibanBoslukluYaz(iban));
      expect(son4).toBe(iban.slice(-4));
      expect(son4).toHaveLength(4);
      expect(JSON.stringify({ son4 })).not.toContain(iban);
    }
  });
  it('4 karakterden kısa girdide boş metin döner', () => {
    for (const g of ['', 'ab', 'a b c', null, undefined, 12]) expect(ibanSon4(g)).toBe('');
  });
});
