import { describe, it, expect } from 'vitest';
import { CANARY_AD } from '@astra/ortak-test';
import { GirdiHatasi } from '../girdi/girdi-hata.ts';
import { ilgiDonustur } from './ilgi-hesap.ts';

function tek(ham: Record<string, unknown>) {
  return ilgiDonustur([{ id: 'u1', name: 'Örnek Ürün', ...ham }]);
}
function kodlar(ham: Record<string, unknown>): string[] {
  return tek(ham).uyarilar.map((u) => u.neden_kodu);
}

describe('ilgiDonustur', () => {
  it('kaynak yoksa ILGI_KAYNAK_YOK bilgisi ve boş sonuç verir', () => {
    for (const girdi of [undefined, null]) {
      expect(ilgiDonustur(girdi)).toEqual({ satirlar: [], atlananlar: [], uyarilar: [], bilgi: ['ILGI_KAYNAK_YOK'], kaynak_sayisi: 0 });
    }
  });

  it('boş dizi bilgi kodu olmadan boş sonuç verir', () => {
    expect(ilgiDonustur([])).toEqual({ satirlar: [], atlananlar: [], uyarilar: [], bilgi: [], kaynak_sayisi: 0 });
  });

  it.each([[{}], ['metin'], [5], [true]])('dizi olmayan ilgi (%j) SEMA_GECERSIZ yol=ilgi fırlatır', (girdi) => {
    try {
      ilgiDonustur(girdi);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(GirdiHatasi);
      expect((e as GirdiHatasi).kod).toBe('SEMA_GECERSIZ');
      expect((e as GirdiHatasi).yol).toBe('ilgi');
    }
  });

  it('tüm alanları begeniler satırına eşler', () => {
    const sonuc = ilgiDonustur([
      {
        id: 'urun-001', name: ' Örnek Ürün ', category: 'Elektronik', image: 'https://ornek.invalid/x.png', badge: { t: 'yeni' },
        price: '1.234,50', price_label: '₺1.234,50', specs: ['a'], note: 'Örnek not', links: [{ u: 'x' }], priority: 'Yüksek', favorite: 'evet',
        rating: 4, target_price: 1000, price_history: [{ date: '2026-01-01', price: 1500 }, { date: '2026-02-01', price: 1400.555 }], added_at: 1750000000000,
      },
    ]);
    expect(sonuc.uyarilar).toEqual([]);
    expect(sonuc.atlananlar).toEqual([]);
    expect(sonuc.kaynak_sayisi).toBe(1);
    expect(sonuc.satirlar).toEqual([
      {
        kod: 'urun-001', sira: 1, kategori: 'Elektronik', ad: 'Örnek Ürün', resim: 'https://ornek.invalid/x.png', rozet: { t: 'yeni' },
        fiyat: 1234.5, fiyat_etiketi: '₺1.234,50', ozellikler: ['a'], notlar: 'Örnek not', baglantilar: [{ u: 'x' }], oncelik: 'high', favori: true, puan: 4,
        hedef_fiyat: 1000, fiyat_gecmisi: [{ date: '2026-01-01', price: 1500 }, { date: '2026-02-01', price: 1400.56 }], ilk_fiyat: 1500,
        ekstra: { eski: { koleksiyon: 'ilgi_urunleri', id: 'urun-001', ts: 1750000000000 } },
      },
    ]);
  });

  it('yalnız zorunlu alanlarla güvenli varsayılanlar atanır', () => {
    const [satir] = tek({}).satirlar;
    expect(satir).toEqual({
      kod: 'u1', sira: 1, kategori: 'diger', ad: 'Örnek Ürün', resim: null, rozet: null, fiyat: null, fiyat_etiketi: null, ozellikler: [], notlar: null,
      baglantilar: [], oncelik: 'medium', favori: false, puan: null, hedef_fiyat: null, fiyat_gecmisi: [], ilk_fiyat: null,
      ekstra: { eski: { koleksiyon: 'ilgi_urunleri', id: 'u1' } },
    });
  });

  it('sayısal kimlik metne çevrilir', () => {
    const sonuc = ilgiDonustur([{ id: 5, name: 'x' }]);
    expect(sonuc.satirlar[0]!.kod).toBe('5');
    expect(sonuc.satirlar[0]!.ekstra.eski.id).toBe('5');
  });

  it('fiyatlar iki haneye yarım-yukarı yuvarlanır', () => {
    expect(tek({ price: 1.005 }).satirlar[0]!.fiyat).toBe(1.01);
    expect(tek({ price: 0.125 }).satirlar[0]!.fiyat).toBe(0.13);
    expect(tek({ price: '1,234' }).satirlar[0]!.fiyat).toBe(1.23);
    expect(tek({ price: 0 }).satirlar[0]!.fiyat).toBe(0);
    expect(tek({ target_price: '99,999' }).satirlar[0]!.hedef_fiyat).toBe(100);
  });

  describe('atlanan kayıtlar', () => {
    it('nesne olmayan öğe ILGI_KAYDI_GECERSIZ ile atlanır ve sıra numarası korunur', () => {
      const sonuc = ilgiDonustur(['x', null, 5, [], { id: 'ok', name: 'Ad' }]);
      expect(sonuc.atlananlar.map((a) => [a.kaynak_id, a.neden_kodu])).toEqual([
        ['#1', 'ILGI_KAYDI_GECERSIZ'], ['#2', 'ILGI_KAYDI_GECERSIZ'], ['#3', 'ILGI_KAYDI_GECERSIZ'], ['#4', 'ILGI_KAYDI_GECERSIZ'],
      ]);
      expect(sonuc.satirlar[0]!.sira).toBe(5);
      expect(sonuc.kaynak_sayisi).toBe(5);
    });
    it('kimliksiz kayıt KOD_BOS, çok uzun kimlik KOD_UZUN, yinelenen kimlik KOD_TEKRAR ile atlanır', () => {
      const sonuc = ilgiDonustur([
        { name: 'a' }, { id: '   ', name: 'b' }, { id: 'u'.repeat(81), name: 'c' }, { id: 'ayni', name: 'd' }, { id: 'ayni', name: 'e' }, { id: 'u'.repeat(80), name: 'f' },
      ]);
      expect(sonuc.atlananlar.map((a) => a.neden_kodu)).toEqual(['KOD_BOS', 'KOD_BOS', 'KOD_UZUN', 'KOD_TEKRAR']);
      expect(sonuc.satirlar.map((s) => s.sira)).toEqual([4, 6]);
    });
    it('adsız kayıt AD_BOS ile atlanır ve kimliği yinelenme sayılmaz', () => {
      const sonuc = ilgiDonustur([{ id: 'x', name: '  ' }, { id: 'x', name: 'Geçerli' }]);
      expect(sonuc.atlananlar.map((a) => a.neden_kodu)).toEqual(['AD_BOS']);
      expect(sonuc.satirlar).toHaveLength(1);
    });
    it('atlananlarda kayıt adı/değeri yoktur, yalnız kimlik ve kod', () => {
      const sonuc = ilgiDonustur([{ id: 'u1' }, { id: 'u2', name: CANARY_AD, price: 5 }, { id: 'u2', name: CANARY_AD }]);
      expect(JSON.stringify(sonuc.atlananlar)).not.toContain(CANARY_AD);
    });
  });

  describe('uyarılar', () => {
    it('ad 160 karakterde kırpılır (AD_UZUN_KIRPILDI)', () => {
      const sonuc = tek({ name: 'a'.repeat(200) });
      expect(sonuc.satirlar[0]!.ad).toHaveLength(160);
      expect(sonuc.uyarilar.map((u) => u.neden_kodu)).toEqual(['AD_UZUN_KIRPILDI']);
      expect(tek({ name: 'a'.repeat(160) }).uyarilar).toEqual([]);
    });
    it('uzun kategori / fiyat etiketi / not kırpılır (ALAN_KIRPILDI)', () => {
      expect(tek({ category: 'k'.repeat(41) }).satirlar[0]!.kategori).toHaveLength(40);
      expect(tek({ price_label: 'k'.repeat(121) }).satirlar[0]!.fiyat_etiketi).toHaveLength(120);
      expect(tek({ note: 'k'.repeat(2001) }).satirlar[0]!.notlar).toHaveLength(2000);
      expect(kodlar({ category: 'k'.repeat(41), note: 'n'.repeat(2001) })).toEqual(['ALAN_KIRPILDI', 'ALAN_KIRPILDI']);
    });
    it('1000 karakteri aşan resim adresi kırpılmaz, atılır (ALAN_COK_UZUN)', () => {
      const sonuc = tek({ image: 'h'.repeat(1001) });
      expect(sonuc.satirlar[0]!.resim).toBeNull();
      expect(sonuc.uyarilar.map((u) => u.neden_kodu)).toEqual(['ALAN_COK_UZUN']);
    });
    it('nesne olmayan rozet ALAN_BICIMI_GECERSIZ verir', () => {
      expect(tek({ badge: 'yeni' }).satirlar[0]!.rozet).toBeNull();
      expect(kodlar({ badge: 'yeni' })).toEqual(['ALAN_BICIMI_GECERSIZ']);
      expect(kodlar({ badge: null })).toEqual([]);
    });
    it('öncelik sözlüğü: low/medium/high ve dusuk/orta/yuksek; bilinmeyen medium + SOZLUK_BILINMIYOR', () => {
      const tablo: ReadonlyArray<[string, string]> = [['low', 'low'], ['HIGH', 'high'], ['Düşük', 'low'], ['Orta', 'medium'], ['Yüksek', 'high'], ['YÜKSEK', 'high']];
      for (const [girdi, beklenen] of tablo) expect(tek({ priority: girdi }).satirlar[0]!.oncelik).toBe(beklenen);
      expect(tek({ priority: 'acil' }).satirlar[0]!.oncelik).toBe('medium');
      expect(kodlar({ priority: 'acil' })).toEqual(['SOZLUK_BILINMIYOR']);
      expect(kodlar({ priority: '' })).toEqual([]);
      expect(kodlar({ priority: 'constructor' })).toEqual(['SOZLUK_BILINMIYOR']);
    });
    it('puan: tamsayı sorunsuz, ondalık yuvarlanır (PUAN_YUVARLANDI), aralık dışı ve geçersiz null', () => {
      expect(tek({ rating: 3 }).satirlar[0]!.puan).toBe(3);
      expect(kodlar({ rating: 3 })).toEqual([]);
      expect(tek({ rating: 3.5 }).satirlar[0]!.puan).toBe(4);
      expect(kodlar({ rating: 3.5 })).toEqual(['PUAN_YUVARLANDI']);
      expect(tek({ rating: 0.4 }).satirlar[0]!.puan).toBe(0);
      expect(kodlar({ rating: 7 })).toEqual(['ALAN_ARALIK_DISI']);
      expect(kodlar({ rating: -1 })).toEqual(['ALAN_ARALIK_DISI']);
      expect(tek({ rating: 7 }).satirlar[0]!.puan).toBeNull();
      expect(kodlar({ rating: 'abc' })).toEqual(['GECERSIZ_TUTAR']);
      expect(kodlar({ rating: '' })).toEqual([]);
      expect(tek({ rating: '4,5' }).satirlar[0]!.puan).toBe(5);
    });
    it('geçersiz ya da negatif fiyat null olur ve GECERSIZ_TUTAR uyarısı verir; boş fiyat uyarısızdır', () => {
      for (const price of ['abc', -5, '-1,5']) {
        expect(tek({ price }).satirlar[0]!.fiyat).toBeNull();
        expect(kodlar({ price })).toEqual(['GECERSIZ_TUTAR']);
      }
      for (const price of ['', '  ', null, undefined]) expect(kodlar({ price })).toEqual([]);
      expect(kodlar({ target_price: 'abc' })).toEqual(['GECERSIZ_TUTAR']);
    });
    it('added_at: ms, ISO metni kabul edilir; çözülemeyen GECERSIZ_TARIH verir', () => {
      expect(tek({ added_at: 1750000000000 }).satirlar[0]!.ekstra.eski.ts).toBe(1750000000000);
      expect(tek({ added_at: '2026-01-02T03:04:05.000Z' }).satirlar[0]!.ekstra.eski.ts).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
      for (const v of ['dün', -5, NaN, {}]) {
        const sonuc = tek({ added_at: v });
        expect(sonuc.satirlar[0]!.ekstra.eski.ts).toBeUndefined();
        expect(sonuc.uyarilar.map((u) => u.neden_kodu)).toEqual(['GECERSIZ_TARIH']);
      }
      expect(kodlar({ added_at: '' })).toEqual([]);
    });
    it('dizi olması gereken alanlar dizi değilse boş dizi + ALAN_BICIMI_GECERSIZ', () => {
      const sonuc = tek({ specs: 'x', links: { a: 1 }, price_history: 5 });
      expect(sonuc.satirlar[0]).toMatchObject({ ozellikler: [], baglantilar: [], fiyat_gecmisi: [], ilk_fiyat: null });
      expect(sonuc.uyarilar.map((u) => u.neden_kodu)).toEqual(['ALAN_BICIMI_GECERSIZ', 'ALAN_BICIMI_GECERSIZ', 'ALAN_BICIMI_GECERSIZ']);
    });
    it('geçersiz fiyat geçmişi noktaları elenir (FIYAT_GECMISI_ELENDI) ve ilk_fiyat ilk geçerli noktadan gelir', () => {
      const sonuc = tek({
        price_history: [{ date: '', price: 5 }, { date: '2026-01-01', price: -1 }, 'x', null, { price: 3 }, { date: '2026-01-02', price: 'abc' }, { date: '2026-01-03', price: '1.250,5' }],
      });
      expect(sonuc.satirlar[0]!.fiyat_gecmisi).toEqual([{ date: '2026-01-03', price: 1250.5 }]);
      expect(sonuc.satirlar[0]!.ilk_fiyat).toBe(1250.5);
      expect(sonuc.uyarilar.filter((u) => u.neden_kodu === 'FIYAT_GECMISI_ELENDI')).toHaveLength(6);
    });
    it('favori yorumu: true/1/"true"/"1"/"evet" evet, diğerleri hayır', () => {
      for (const v of [true, 1, 'true', 'TRUE', '1', 'evet', 'Evet']) expect(tek({ favorite: v }).satirlar[0]!.favori).toBe(true);
      for (const v of [false, 0, 'false', '0', 'hayır', '', null, undefined, 2, {}]) expect(tek({ favorite: v }).satirlar[0]!.favori).toBe(false);
    });
    it('uyarılarda kayıt adı/notu yoktur', () => {
      const sonuc = tek({ name: CANARY_AD + 'x'.repeat(200), note: CANARY_AD, price: CANARY_AD });
      expect(JSON.stringify(sonuc.uyarilar)).not.toContain(CANARY_AD);
    });
  });
});
