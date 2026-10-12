import { describe, it, expect } from 'vitest';
import { sayisal, sayiOku, hucreYaz, sutunToplam, tabloSirala, type Tablo } from './tablo-hesap';

/* Test tablosu kurucu: tek sütunlu, verilen biçimde. */
const tabloKur = (bicim: string | undefined, satirlar: string[][]): Tablo => ({ sutunlar: [{ ad: 'S', bicim }], satirlar });
const sutun0 = (b: Tablo) => b.satirlar.map((r) => r[0]);

describe('sayisal', () => {
  it('sayi, para ve yuzde için true döner', () => {
    expect(sayisal('sayi')).toBe(true);
    expect(sayisal('para')).toBe(true);
    expect(sayisal('yuzde')).toBe(true);
  });
  it('metin, tarih ve tanımsız için false döner', () => {
    expect(sayisal('metin')).toBe(false);
    expect(sayisal('tarih')).toBe(false);
    expect(sayisal(undefined)).toBe(false);
  });
});

describe('sayiOku', () => {
  it('binlik noktalı ve ondalık virgüllü sayıyı okur', () => {
    expect(sayiOku('1.234,50')).toBe(1234.5);
  });
  it('binlik virgüllü ve ondalık noktalı sayıyı okur', () => {
    expect(sayiOku('1,234.50')).toBe(1234.5);
  });
  it('yalnız virgüllü ondalığı okur', () => {
    expect(sayiOku('12,5')).toBe(12.5);
  });
  it('üç haneli nokta grubunu binlik sayar, diğerini ondalık', () => {
    expect(sayiOku('1.234')).toBe(1234);
    expect(sayiOku('1.5')).toBe(1.5);
  });
  it('%, ₺, TL ve TRY işaretlerini (harf duyarsız) atar', () => {
    expect(sayiOku('%12')).toBe(12);
    expect(sayiOku('₺99')).toBe(99);
    expect(sayiOku('12 TL')).toBe(12);
    expect(sayiOku('12 try')).toBe(12);
  });
  it('negatif sayıyı korur', () => {
    expect(sayiOku('-1.500,25')).toBe(-1500.25);
  });
  it('boş, null, tanımsız ve metin için NaN döner', () => {
    expect(sayiOku('')).toBeNaN();
    expect(sayiOku(null)).toBeNaN();
    expect(sayiOku(undefined)).toBeNaN();
    expect(sayiOku('abc')).toBeNaN();
  });
  it('sayı girdisini aynen döner', () => {
    expect(sayiOku(5)).toBe(5);
  });
});

describe('sutunToplam', () => {
  it('okunamayan hücreyi atlayarak toplar', () => {
    expect(sutunToplam({ satirlar: [['1.000,50'], ['x'], ['2']] }, 0)).toBe(1002.5);
  });
  it('boş satır listesi için 0 döner', () => {
    expect(sutunToplam({ satirlar: [] }, 0)).toBe(0);
  });
  it('satırlar tanımsızsa 0 döner', () => {
    expect(sutunToplam({} as unknown as Pick<Tablo, 'satirlar'>, 0)).toBe(0);
  });
  it('olmayan sütun indeksi için 0 döner', () => {
    expect(sutunToplam({ satirlar: [['5']] }, 3)).toBe(0);
  });
});

describe('hucreYaz', () => {
  it('boş, null ve tanımsız değer için boş metin döner', () => {
    expect(hucreYaz('', 'sayi')).toBe('');
    expect(hucreYaz(null, 'para')).toBe('');
    expect(hucreYaz(undefined)).toBe('');
  });
  it('sayısal biçimde okunamayan değeri olduğu gibi döner', () => {
    expect(hucreYaz('abc', 'sayi')).toBe('abc');
  });
  it('metin biçiminde girdiyi aynen döner', () => {
    expect(hucreYaz('x', 'metin')).toBe('x');
  });
  it('geçersiz tarihi aynen döner', () => {
    expect(hucreYaz('geçersiz', 'tarih')).toBe('geçersiz');
  });
  it('sayı biçiminde binlik ve ondalık ayracı Türkçe olur (gevşek kontrol)', () => {
    expect(hucreYaz('1234,5', 'sayi')).toContain('1.234,5');
  });
  it('yüzde biçimi % önekiyle başlar', () => {
    expect(hucreYaz('12', 'yuzde')).toMatch(/^%/);
  });
  it('para biçimi tutarı içerir (gevşek kontrol)', () => {
    expect(hucreYaz('1234,5', 'para')).toContain('1.234,5');
  });
});

describe('tabloSirala', () => {
  it('sayı sütununu artan sıralar, boş ve okunamayanlar sonda kalır', () => {
    const b = tabloKur('sayi', [['10'], [''], ['2'], ['x']]);
    tabloSirala(b, 0);
    expect(sutun0(b).slice(0, 2)).toEqual(['2', '10']);
    expect(sutun0(b).slice(2).sort()).toEqual(['', 'x']);
    expect(b.sira).toEqual({ c: 0, yon: 1 });
  });
  it('aynı sütuna ikinci çağrıda yön tersine döner, boşlar yine sonda kalır', () => {
    const b = tabloKur('sayi', [['10'], [''], ['2'], ['x']]);
    tabloSirala(b, 0);
    tabloSirala(b, 0);
    expect(sutun0(b).slice(0, 2)).toEqual(['10', '2']);
    expect(sutun0(b).slice(2).sort()).toEqual(['', 'x']);
    expect(b.sira).toEqual({ c: 0, yon: -1 });
  });
  it('üçüncü çağrıda yön tekrar artana döner', () => {
    const b = tabloKur('sayi', [['10'], ['2']]);
    tabloSirala(b, 0);
    tabloSirala(b, 0);
    tabloSirala(b, 0);
    expect(b.sira?.yon).toBe(1);
  });
  it('farklı sütuna geçince yön artan olur', () => {
    const b: Tablo = { sutunlar: [{ ad: 'A', bicim: 'sayi' }, { ad: 'B', bicim: 'sayi' }], satirlar: [['1', '9'], ['2', '8']] };
    tabloSirala(b, 0);
    tabloSirala(b, 0);
    tabloSirala(b, 1);
    expect(b.sira).toEqual({ c: 1, yon: 1 });
    expect(b.satirlar).toEqual([['2', '8'], ['1', '9']]);
  });
  it('metin sütununu Türkçe sıraya göre sıralar (Ç, C ile D arasında)', () => {
    const b = tabloKur('metin', [['Zeytin'], ['Çay'], ['Armut']]);
    tabloSirala(b, 0);
    expect(sutun0(b)).toEqual(['Armut', 'Çay', 'Zeytin']);
  });
  it('tarih sütununu kronolojik sıralar, boş tarih sonda kalır', () => {
    const b = tabloKur('tarih', [['2025-03-01'], ['2024-12-31'], ['']]);
    tabloSirala(b, 0);
    expect(sutun0(b)).toEqual(['2024-12-31', '2025-03-01', '']);
  });
  it('boş tabloda hata vermez ve sırayı kaydeder', () => {
    const b = tabloKur('sayi', []);
    tabloSirala(b, 0);
    expect(b.satirlar).toEqual([]);
    expect(b.sira).toEqual({ c: 0, yon: 1 });
  });
});
