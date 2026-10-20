import { describe, it, expect } from 'vitest';
import {
  CANARY_AD, CANARY_IBAN, CANARY_PAROLA, SENTETIK_MEZAR_TASLARI, canaryBul, sentetikSUret, sentetikZarflariUret,
} from '@astra/ortak-test';
import { GirdiHatasi } from './girdi-hata.ts';
import { girdiCoz } from './okuyucu.ts';

const s = sentetikSUret();
const zarflar = sentetikZarflariUret(s);

function hataAl(metin: string): GirdiHatasi {
  try {
    girdiCoz(metin);
  } catch (e) {
    expect(e).toBeInstanceOf(GirdiHatasi);
    return e as GirdiHatasi;
  }
  throw new Error('hata bekleniyordu');
}

describe('girdiCoz: desteklenen biçimler', () => {
  const beklenenBorc = s.koleksiyon.debts.length - SENTETIK_MEZAR_TASLARI.debts!.length;

  const bicimler: ReadonlyArray<[string, string]> = [
    ['düz S (uygulama yedeği)', JSON.stringify(zarflar.yedek)],
    ['{durum: S} (astra_kasa_duz çıktısı)', JSON.stringify(zarflar.kasaDuzDurum)],
    ['{govde: S}', JSON.stringify({ govde: s })],
    ['{v:0, m:"<json>"} düz zarf', JSON.stringify(zarflar.duzZarf)],
    ['{v:0, m:<nesne>} düz zarf', JSON.stringify({ v: 0, m: s })],
    ['[{durum: S}] tek satırlık dizi', JSON.stringify([zarflar.kasaDuzDurum])],
    ['[S] tek öğeli dizi', JSON.stringify([s])],
    ['JSON içinde JSON metni', JSON.stringify(JSON.stringify(s))],
    ['BOM önekli', '﻿' + JSON.stringify(s)],
    ['boşluk ve satır sonlu', '\n  \t' + JSON.stringify(s, null, 2) + '\n\n'],
    ['üç kat zarf', JSON.stringify({ durum: { govde: { v: 0, m: s } } })],
  ];

  it.each(bicimler)('%s tanınır ve aynı sonucu verir', (_ad, metin) => {
    const sonuc = girdiCoz(metin);
    expect(sonuc.s.koleksiyon.debts).toHaveLength(beklenenBorc);
    expect(sonuc.ozet.silinen_mezar_sayisi).toBe(3);
    expect(sonuc.s._v).toBe(15);
    expect(Object.keys(sonuc.s.diger.apps as object)).toHaveLength(16);
  });

  it('tüm biçimler birebir aynı S ve özeti üretir', () => {
    const ilk = girdiCoz(bicimler[0]![1]);
    for (const [, metin] of bicimler) expect(girdiCoz(metin)).toEqual(ilk);
  });

  it('mezar taşı olan kayıtlar süzülür, elenen kimlikler özetlenir', () => {
    const sonuc = girdiCoz(JSON.stringify(s));
    expect(sonuc.s.koleksiyon.debts.map((k) => k.id)).not.toContain('borc-sil-01');
    expect(sonuc.s.koleksiyon.expenses.map((k) => k.id)).not.toContain('gider-sil-01');
    expect(sonuc.s.koleksiyon.people.map((k) => k.id)).not.toContain('kisi-sil-01');
    expect(sonuc.elenenler).toEqual(
      expect.arrayContaining([
        { koleksiyon: 'debts', kaynak_id: 'borc-sil-01' },
        { koleksiyon: 'expenses', kaynak_id: 'gider-sil-01' },
        { koleksiyon: 'people', kaynak_id: 'kisi-sil-01' },
      ]),
    );
    expect(sonuc.elenenler).toHaveLength(3);
  });

  it('boş koleksiyonlu S sıfır sayılarla çözülür', () => {
    const sonuc = girdiCoz(JSON.stringify(zarflar.bosS));
    expect(Object.values(sonuc.ozet.koleksiyon_sayilari).every((n) => n === 0)).toBe(true);
    expect(sonuc.ozet.silinen_mezar_sayisi).toBe(0);
  });

  it('8 MB üstü uygulama değeri okuyucuyu bozmaz (atlama dönüştürücüde yapılır)', () => {
    const buyuk = sentetikSUret({ buyukDeger: true });
    const sonuc = girdiCoz(JSON.stringify(buyuk));
    expect(Object.keys(sonuc.s.diger.apps as object)).toHaveLength(17);
    expect((sonuc.s.diger.apps as Record<string, string>)['tasarim-atolyesi-kutuphane']!.length).toBeGreaterThan(8 * 1024 * 1024);
  });
});

describe('girdiCoz: hata yolları', () => {
  it('{v:1} ve {v:2} şifreli zarf SIFRELI_GIRDI verir', () => {
    expect(hataAl(JSON.stringify(zarflar.sifreliZarfV1)).kod).toBe('SIFRELI_GIRDI');
    expect(hataAl(JSON.stringify(zarflar.sifreliZarfV2)).kod).toBe('SIFRELI_GIRDI');
    expect(hataAl(JSON.stringify([zarflar.sifreliZarfV1])).kod).toBe('SIFRELI_GIRDI');
    expect(hataAl(JSON.stringify({ durum: zarflar.sifreliZarfV2 })).kod).toBe('SIFRELI_GIRDI');
  });

  it('bozuk (kesik) JSON BOZUK_JSON verir', () => {
    expect(hataAl(zarflar.bozukMetin).kod).toBe('BOZUK_JSON');
    expect(hataAl('{"a":').kod).toBe('BOZUK_JSON');
    expect(hataAl('not json').kod).toBe('BOZUK_JSON');
    expect(hataAl('{"v":0,"m":"{bozuk"}').kod).toBe('BOZUK_JSON');
  });

  it('boş girdi GIRDI_BOS verir', () => {
    for (const metin of ['', '   ', '\n\t', '﻿', '﻿  ']) expect(hataAl(metin).kod).toBe('GIRDI_BOS');
  });

  it('tanınmayan biçim GIRDI_BICIMI_TANINMADI verir', () => {
    const taninmayan = ['{}', '{"foo":1}', '42', 'null', 'true', '[]', '[1,2]', '[[]]', '[{"a":1},{"b":2}]', '{"v":3,"m":"x"}', '{"v":0,"m":5}', '{"v":0}'];
    for (const metin of taninmayan) expect(hataAl(metin).kod, metin).toBe('GIRDI_BICIMI_TANINMADI');
  });

  it('düz metin değeri JSON olarak çözülemezse BOZUK_JSON verir', () => {
    expect(hataAl('"düz metin"').kod).toBe('BOZUK_JSON');
  });

  it('zarf derinliği sınırı: aşırı iç içe zarf reddedilir', () => {
    let kok: unknown = s;
    for (let i = 0; i < 6; i++) kok = { durum: kok };
    expect(hataAl(JSON.stringify(kok)).kod).toBe('GIRDI_BICIMI_TANINMADI');
  });

  it('AZAMI_ZARF_DERINLIGI=4: dört adımda çözülen zarf da kabul edilir ({durum:{govde:{v:0,m:"<json>"}}})', () => {
    /* adımlar: durum -> govde -> m (metin) -> JSON.parse. Döngü dördüncü adımı yapar ama sonucu denetlemeden çıkar. */
    expect(girdiCoz(JSON.stringify({ durum: { govde: { v: 0, m: JSON.stringify(s) } } })).ozet.silinen_mezar_sayisi).toBe(3);
  });

  it('SEMA_GECERSIZ: bilinen alanlarda yanlış türler yol adıyla bildirilir', () => {
    const tablo: ReadonlyArray<[unknown, string]> = [
      [{ koleksiyon: { debts: 'metin' } }, 'koleksiyon.debts'],
      [{ koleksiyon: [] }, 'koleksiyon'],
      [{ ayar: [] }, 'ayar'],
      [{ silinen: { debts: [] } }, 'silinen'],
      [{ _v: '15', koleksiyon: {} }, '_v'],
      [{ _ts: 'x', koleksiyon: {} }, '_ts'],
      [{ diger: 5 }, 'diger'],
    ];
    for (const [kok, yol] of tablo) {
      const e = hataAl(JSON.stringify(kok));
      expect(e.kod).toBe('SEMA_GECERSIZ');
      expect(e.yol).toBe(yol);
    }
  });
});

describe('girdiCoz: hata mesajları kayıt DEĞERİ taşımaz', () => {
  const degerli: ReadonlyArray<[string, string]> = [
    ['kesik JSON (canary içeren)', `{"koleksiyon":{"debts":[{"name":"${CANARY_AD}","iban":"${CANARY_IBAN}"`],
    ['yanlış türlü koleksiyon', JSON.stringify({ koleksiyon: { debts: CANARY_AD } })],
    ['yanlış türlü ayar', JSON.stringify({ ayar: [CANARY_PAROLA] })],
    ['yanlış türlü sürüm', JSON.stringify({ _v: CANARY_AD, koleksiyon: {} })],
    ['tanınmayan nesne', JSON.stringify({ gizli: CANARY_AD, iban: CANARY_IBAN })],
    ['tanınmayan dizi', JSON.stringify([CANARY_AD, CANARY_PAROLA])],
    ['tanınmayan metin', JSON.stringify(CANARY_PAROLA)],
    ['şifreli zarf', JSON.stringify({ v: 1, i: CANARY_AD, d: CANARY_PAROLA })],
    ['bozuk iç JSON', JSON.stringify({ v: 0, m: `{"x":"${CANARY_AD}` })],
  ];
  it.each(degerli)('%s', (_ad, metin) => {
    const e = hataAl(metin);
    expect(canaryBul(e.message)).toEqual([]);
    expect(canaryBul(JSON.stringify({ kod: e.kod, yol: e.yol, sayi: e.sayi, ad: e.name, mesaj: e.message, yigin: String(e.stack).split('\n')[0] }))).toEqual([]);
    expect(e.message).toMatch(/^GIRDI_HATASI [A-Z_]+( yol=[A-Za-z_.]+)?( sayi=\d+)?$/);
  });
});

describe('GirdiHatasi', () => {
  it('mesajı yalnız kod, yol ve sayıdan kurar', () => {
    expect(new GirdiHatasi('GIRDI_BOS').message).toBe('GIRDI_HATASI GIRDI_BOS');
    expect(new GirdiHatasi('SEMA_GECERSIZ', 'koleksiyon.debts').message).toBe('GIRDI_HATASI SEMA_GECERSIZ yol=koleksiyon.debts');
    expect(new GirdiHatasi('GIRDI_COK_BUYUK', null, 7).message).toBe('GIRDI_HATASI GIRDI_COK_BUYUK sayi=7');
    const e = new GirdiHatasi('SEMA_GECERSIZ', 'ayar', 2);
    expect([e.kod, e.yol, e.sayi, e.name]).toEqual(['SEMA_GECERSIZ', 'ayar', 2, 'GirdiHatasi']);
  });
});
