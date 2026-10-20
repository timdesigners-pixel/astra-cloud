import { describe, it, expect } from 'vitest';
import type { KodluKayit } from '../donusum/neden-kodu.ts';
import type { SemaOzeti } from '../girdi/sema-ayristirici-hesap.ts';
import { begeniFiyatToplami, girdiOzetiKur, hedefTablolariKur, kodSayilariKur } from './plan-ozet-hesap.ts';
import type { BegeniPlanKaydi, PlanKaydi, UygulamaPlanKaydi } from './plan-tipleri.ts';

function begeni(kod: string, fiyat: number | null): BegeniPlanKaydi {
  return {
    tablo: 'begeniler', koleksiyon: 'ilgi_urunleri', kaynak_id: kod,
    satir: {
      kod, sira: 1, kategori: 'diger', ad: 'x', resim: null, rozet: null, fiyat, fiyat_etiketi: null, ozellikler: [], notlar: null, baglantilar: [],
      oncelik: 'medium', favori: false, puan: null, hedef_fiyat: null, fiyat_gecmisi: [], ilk_fiyat: null, ekstra: { eski: { koleksiyon: 'ilgi_urunleri', id: kod } },
    },
  };
}
function uyg(uygulama: string, anahtar: string): UygulamaPlanKaydi {
  return { tablo: 'uygulama_durumu', koleksiyon: 'apps', kaynak_id: `${uygulama}/${anahtar}`, uygulama, anahtar, deger: '1' };
}

describe('kodSayilariKur', () => {
  it('(koleksiyon, neden) başına sayar ve deterministik sıralar', () => {
    const girdi: KodluKayit[] = [
      { koleksiyon: 'ilgi_urunleri', kaynak_id: 'b', neden_kodu: 'KOD_TEKRAR' },
      { koleksiyon: 'apps', kaynak_id: 'x', neden_kodu: 'ANAHTAR_ESLENMEDI' },
      { koleksiyon: 'apps', kaynak_id: 'y', neden_kodu: 'ANAHTAR_ESLENMEDI' },
      { koleksiyon: 'apps', kaynak_id: 'z', neden_kodu: 'DEGER_COK_BUYUK' },
      { koleksiyon: 'ilgi_urunleri', kaynak_id: 'c', neden_kodu: 'AD_BOS' },
    ];
    const beklenen = [
      { koleksiyon: 'apps', neden_kodu: 'ANAHTAR_ESLENMEDI', sayi: 2 },
      { koleksiyon: 'apps', neden_kodu: 'DEGER_COK_BUYUK', sayi: 1 },
      { koleksiyon: 'ilgi_urunleri', neden_kodu: 'AD_BOS', sayi: 1 },
      { koleksiyon: 'ilgi_urunleri', neden_kodu: 'KOD_TEKRAR', sayi: 1 },
    ];
    expect(kodSayilariKur(girdi)).toEqual(beklenen);
    expect(kodSayilariKur([...girdi].reverse())).toEqual(beklenen);
  });
  it('boş girdide boş liste döner ve kaynak kimliğini çıktıya koymaz', () => {
    expect(kodSayilariKur([])).toEqual([]);
    expect(JSON.stringify(kodSayilariKur([{ koleksiyon: 'apps', kaynak_id: 'GIZLI-KIMLIK', neden_kodu: 'MEZAR_TASI' }]))).not.toContain('GIZLI-KIMLIK');
  });
});

describe('girdiOzetiKur', () => {
  it('koleksiyon sayılarını ada göre sıralı listeye çevirir', () => {
    const ozet = {
      koleksiyon_sayilari: { people: 2, debts: 5, expenses: 0 },
      silinen_mezar_sayisi: 3, bilinmeyen_anahtar_sayisi: 1, gecersiz_kayit_sayisi: 4,
    } as unknown as SemaOzeti;
    expect(girdiOzetiKur(ozet)).toEqual({
      koleksiyon_sayilari: [{ koleksiyon: 'debts', sayi: 5 }, { koleksiyon: 'expenses', sayi: 0 }, { koleksiyon: 'people', sayi: 2 }],
      silinen_mezar_sayisi: 3, bilinmeyen_anahtar_sayisi: 1, gecersiz_kayit_sayisi: 4,
    });
  });
});

describe('hedefTablolariKur', () => {
  it('tablo başına yeni ve atlanan sayar; yalnız sayısı olan tablolar listelenir, tablo adına göre sıralıdır', () => {
    const kayitlar: PlanKaydi[] = [uyg('a', 'k1'), uyg('a', 'k2'), begeni('x', 1)];
    const atlananlar: KodluKayit[] = [
      { koleksiyon: 'apps', kaynak_id: 'q', neden_kodu: 'ANAHTAR_ESLENMEDI' },
      { koleksiyon: 'ilgi_urunleri', kaynak_id: 'r', neden_kodu: 'AD_BOS' },
      { koleksiyon: 'ilgi_urunleri', kaynak_id: 's', neden_kodu: 'AD_BOS' },
      { koleksiyon: 'debts', kaynak_id: 't', neden_kodu: 'MEZAR_TASI' }, /* haritada yok: sayılmaz */
    ];
    expect(hedefTablolariKur(kayitlar, atlananlar)).toEqual([
      { tablo: 'begeniler', yeni: 1, atlanan: 2 },
      { tablo: 'uygulama_durumu', yeni: 2, atlanan: 1 },
    ]);
  });
  it('kayıt yoksa boş liste döner', () => {
    expect(hedefTablolariKur([], [])).toEqual([]);
  });
});

describe('begeniFiyatToplami', () => {
  it('yalnız begeniler fiyatlarını tam sayı kuruş olarak toplar; null fiyat ve uygulama kayıtları hariç', () => {
    expect(begeniFiyatToplami([begeni('a', 1.01), begeni('b', null), begeni('c', 0.13), uyg('x', 'y')])).toBe(114);
  });
  it('kayan nokta kayması olmadan toplar', () => {
    expect(begeniFiyatToplami([begeni('a', 0.1), begeni('b', 0.2)])).toBe(30);
  });
  it('kayıt yoksa sıfır döner', () => {
    expect(begeniFiyatToplami([])).toBe(0);
  });
});
