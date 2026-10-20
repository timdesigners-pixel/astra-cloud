import { describe, it, expect } from 'vitest';
import { CANARY_AD, canaryBul } from '@astra/ortak-test';
import { GirdiHatasi } from './girdi-hata.ts';
import { KOLEKSIYON_ADLARI, duzNesneMi, mezarMi, mezarsizSuz, semaAyristir, semaKokuMu } from './sema-ayristirici-hesap.ts';

describe('duzNesneMi', () => {
  it('yalnız düz nesneyi kabul eder', () => {
    expect(duzNesneMi({})).toBe(true);
    for (const v of [null, undefined, [], [1], 'a', 5, true, () => 1]) expect(duzNesneMi(v)).toBe(false);
  });
});

describe('semaKokuMu', () => {
  it('S imza anahtarlarından biri varsa true', () => {
    for (const a of ['koleksiyon', 'ayar', 'silinen', 'statements', 'ledger', 'dayLog', 'diger']) expect(semaKokuMu({ [a]: {} })).toBe(true);
  });
  it('imzasız nesne ve nesne olmayan değer false', () => {
    for (const v of [{}, { _v: 1 }, { durum: {} }, { v: 0, m: '' }, null, [], 'x']) expect(semaKokuMu(v)).toBe(false);
  });
});

describe('mezarMi / mezarsizSuz', () => {
  it('yalnız kendi özellikleri sayılır (prototip anahtarları mezar değildir)', () => {
    expect(mezarMi({ a: 1 }, 'a')).toBe(true);
    expect(mezarMi({}, 'constructor')).toBe(false);
    expect(mezarMi({}, 'toString')).toBe(false);
    expect(mezarMi(undefined, 'a')).toBe(false);
  });
  it('mezar taşlı kayıtları eler, kimliksizi tutar, sayısal kimliği metin sayar', () => {
    const kayitlar = [{ id: 'a' }, { id: 'b' }, { id: 5 }, { ad: 'kimliksiz' }, { id: null }, { id: 'constructor' }];
    const { kalan, elenen } = mezarsizSuz(kayitlar, { b: 1, '5': 2 });
    expect(elenen).toEqual(['b', '5']);
    expect(kalan).toEqual([{ id: 'a' }, { ad: 'kimliksiz' }, { id: null }, { id: 'constructor' }]);
  });
  it('mezar listesi yoksa hiçbir şey elenmez', () => {
    const { kalan, elenen } = mezarsizSuz([{ id: 'a' }], undefined);
    expect(kalan).toHaveLength(1);
    expect(elenen).toEqual([]);
  });
});

describe('semaAyristir', () => {
  it('boş nesneden tüm koleksiyonları boş olan S üretir', () => {
    const { s, ozet, elenenler } = semaAyristir({});
    expect(Object.keys(s.koleksiyon).sort()).toEqual([...KOLEKSIYON_ADLARI].sort());
    expect(Object.values(s.koleksiyon).every((d) => Array.isArray(d) && d.length === 0)).toBe(true);
    expect(s._v).toBeNull();
    expect(s._ts).toBeNull();
    expect(s.ayar).toEqual({});
    expect(ozet).toMatchObject({ silinen_mezar_sayisi: 0, bilinmeyen_anahtar_sayisi: 0, gecersiz_kayit_sayisi: 0 });
    expect(elenenler).toEqual([]);
  });

  it('29 bilinen koleksiyon adı vardır', () => {
    expect(KOLEKSIYON_ADLARI).toHaveLength(29);
  });

  it('mezar taşı süzer ve kalan sayıyı özete yazar', () => {
    const { s, ozet, elenenler } = semaAyristir({
      koleksiyon: { debts: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], expenses: [{ id: 'x' }] },
      silinen: { debts: { b: 111 }, expenses: { yok: 1 } },
    });
    expect(s.koleksiyon.debts.map((k) => k.id)).toEqual(['a', 'c']);
    expect(ozet.koleksiyon_sayilari.debts).toBe(2);
    expect(ozet.koleksiyon_sayilari.expenses).toBe(1);
    expect(ozet.silinen_mezar_sayisi).toBe(1);
    expect(elenenler).toEqual([{ koleksiyon: 'debts', kaynak_id: 'b' }]);
  });

  it('başka listenin mezar taşı bu listeyi etkilemez', () => {
    const { s } = semaAyristir({ koleksiyon: { debts: [{ id: 'a' }] }, silinen: { expenses: { a: 1 } } });
    expect(s.koleksiyon.debts).toHaveLength(1);
  });

  it('nesne olmayan dizi öğelerini atar ve gecersiz_kayit_sayisi ile sayar', () => {
    const { s, ozet } = semaAyristir({ koleksiyon: { debts: [{ id: 'a' }, 'x', null, 5, [], { id: 'b' }] } });
    expect(s.koleksiyon.debts).toHaveLength(2);
    expect(ozet.gecersiz_kayit_sayisi).toBe(4);
  });

  it('bilinmeyen kök ve koleksiyon anahtarlarını sayar, S\'ye almaz', () => {
    const { s, ozet } = semaAyristir({ koleksiyon: { debts: [], bilinmeyenListe: [{ id: 'x' }] }, fazlalik: 1, baska: 2 });
    expect(ozet.bilinmeyen_anahtar_sayisi).toBe(3);
    expect(Object.keys(s.koleksiyon)).not.toContain('bilinmeyenListe');
  });

  it('null koleksiyon ve null bölümler boş sayılır', () => {
    const { s } = semaAyristir({ koleksiyon: { debts: null }, ayar: null, silinen: null, diger: null });
    expect(s.koleksiyon.debts).toEqual([]);
    expect(s.ayar).toEqual({});
    expect(s.diger).toEqual({});
  });

  it('_v ve _ts sayı olarak taşınır', () => {
    const { s } = semaAyristir({ _v: 15, _ts: 1750000000000 });
    expect([s._v, s._ts]).toEqual([15, 1750000000000]);
  });

  it('kök nesne değilse GIRDI_BICIMI_TANINMADI fırlatır', () => {
    for (const v of [null, [], 'x', 5]) {
      expect(() => semaAyristir(v)).toThrowError(GirdiHatasi);
      try {
        semaAyristir(v);
      } catch (e) {
        expect((e as GirdiHatasi).kod).toBe('GIRDI_BICIMI_TANINMADI');
      }
    }
  });

  it('sayı alanı sonsuz ya da metinse SEMA_GECERSIZ fırlatır, mesaj değeri taşımaz', () => {
    for (const v of ['15', CANARY_AD, true, {}]) {
      try {
        semaAyristir({ _v: v });
        expect.unreachable();
      } catch (e) {
        expect((e as GirdiHatasi).kod).toBe('SEMA_GECERSIZ');
        expect(canaryBul((e as GirdiHatasi).message)).toEqual([]);
        expect((e as GirdiHatasi).message).toBe('GIRDI_HATASI SEMA_GECERSIZ yol=_v');
      }
    }
  });

  it('S içindeki kayıt nesneleri girdiyle aynı kalır (değer dönüşümü yok)', () => {
    const kayit = { id: 'a', name: CANARY_AD, tutar: '1.234,50' };
    expect(semaAyristir({ koleksiyon: { debts: [kayit] } }).s.koleksiyon.debts[0]).toEqual(kayit);
  });
});
