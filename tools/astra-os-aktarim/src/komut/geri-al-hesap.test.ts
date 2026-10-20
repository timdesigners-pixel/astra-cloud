import { describe, it, expect } from 'vitest';
import { GERI_ONAY_DESENI, YETIM_ONAY_DESENI, geriAlOnayKodu, onayEsitMi, yetimOnayKodu, type GeriAlKodGirdisi } from './geri-al-hesap.ts';

function girdi(ek: Partial<GeriAlKodGirdisi> = {}): GeriAlKodGirdisi {
  return {
    aktarim: '11111111-1111-4111-8111-000000000001', dalga: null, hedefRef: 'abcd1234', uygulamaDurumlariniSil: false,
    sayimlar: [{ hedef_tablo: 'begeniler', yazildi: 6, sahiplenildi: 1 }, { hedef_tablo: 'uygulama_durumu', yazildi: 16, sahiplenildi: 0 }], ...ek,
  };
}

describe('geriAlOnayKodu', () => {
  it('ONAY-geri-<12 hex> biçiminde ve deterministiktir', () => {
    const k = geriAlOnayKodu(girdi());
    expect(k).toMatch(GERI_ONAY_DESENI);
    expect(geriAlOnayKodu(girdi())).toBe(k);
  });
  it('sayım sırası kodu değiştirmez', () => {
    const g = girdi();
    expect(geriAlOnayKodu(girdi({ sayimlar: [...g.sayimlar].reverse() }))).toBe(geriAlOnayKodu(g));
  });
  it('aktarım, dalga, hedef proje, bayrak ve her sayım değişince kod değişir', () => {
    const temel = geriAlOnayKodu(girdi());
    const degisik = [
      girdi({ aktarim: '22222222-2222-4222-8222-000000000002' }),
      girdi({ aktarim: null, dalga: 'a' }),
      girdi({ dalga: 'a' }),
      girdi({ hedefRef: 'zzzz9999' }),
      girdi({ uygulamaDurumlariniSil: true }),
      girdi({ sayimlar: [{ hedef_tablo: 'begeniler', yazildi: 7, sahiplenildi: 1 }, { hedef_tablo: 'uygulama_durumu', yazildi: 16, sahiplenildi: 0 }] }),
      girdi({ sayimlar: [{ hedef_tablo: 'begeniler', yazildi: 6, sahiplenildi: 2 }, { hedef_tablo: 'uygulama_durumu', yazildi: 16, sahiplenildi: 0 }] }),
      girdi({ sayimlar: [] }),
    ];
    const kodlar = degisik.map(geriAlOnayKodu);
    for (const k of kodlar) expect(k).not.toBe(temel);
    expect(new Set(kodlar).size).toBe(kodlar.length);
  });
});

describe('yetimOnayKodu', () => {
  const g = { hedefRef: 'abcd1234', idler: ['b', 'a', 'c'], baslangic: '2026-06-01T00:00:00Z' };
  it('ONAY-yetim-<12 hex> biçiminde, deterministik ve kimlik sırasından bağımsızdır', () => {
    const k = yetimOnayKodu(g);
    expect(k).toMatch(YETIM_ONAY_DESENI);
    expect(yetimOnayKodu({ ...g, idler: ['c', 'b', 'a'] })).toBe(k);
  });
  it('hedef, başlangıç ve kimlik kümesi değişince kod değişir', () => {
    const k = yetimOnayKodu(g);
    expect(yetimOnayKodu({ ...g, hedefRef: 'zzzz9999' })).not.toBe(k);
    expect(yetimOnayKodu({ ...g, baslangic: '2026-06-02T00:00:00Z' })).not.toBe(k);
    expect(yetimOnayKodu({ ...g, idler: ['a', 'b'] })).not.toBe(k);
    expect(yetimOnayKodu({ ...g, idler: [...g.idler, 'd'] })).not.toBe(k);
  });
  it('geri alma kodu ile yetim kodu aynı alanda birbirine benzemez (ön ek farklı)', () => {
    expect(GERI_ONAY_DESENI.test(yetimOnayKodu(g))).toBe(false);
    expect(YETIM_ONAY_DESENI.test(geriAlOnayKodu(girdi()))).toBe(false);
  });
});

describe('onayEsitMi', () => {
  const k = geriAlOnayKodu(girdi());
  it('doğru kodu kabul eder', () => {
    expect(onayEsitMi(k, GERI_ONAY_DESENI, k)).toBe(true);
  });
  it('yanlış, biçimsiz, boş ve metin olmayan kodu reddeder', () => {
    for (const v of ['', 'ONAY-geri-000000000000', k.toUpperCase(), ` ${k}`, `${k}0`, k.slice(1), undefined, null, 5, {}]) expect(onayEsitMi(k, GERI_ONAY_DESENI, v)).toBe(false);
  });
  it('desene uymayan beklenen kod hiçbir girdiyi kabul etmez', () => {
    expect(onayEsitMi(k, YETIM_ONAY_DESENI, k)).toBe(false);
  });
});
