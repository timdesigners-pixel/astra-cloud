import { describe, it, expect } from 'vitest';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { bellekStatikYukleyiciKur } from './bellek-statik-yukleyici.ts';
import { YaziciHatasi } from './yazici-arayuzu.ts';

const YOL = 'oynatma-listelerim/hero.json';
const bayt = (s: string): Uint8Array => new TextEncoder().encode(s);

async function hata(p: Promise<unknown>): Promise<YaziciHatasi> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(YaziciHatasi);
    return e as YaziciHatasi;
  }
  throw new Error('YaziciHatasi bekleniyordu');
}

describe('bellek statik yükleyici', () => {
  it('yükler, geri indirir; boyut ve sha256 yüklenenle aynıdır', async () => {
    const y = bellekStatikYukleyiciKur();
    expect(await y.yukle(YOL, bayt('{"a":1}'))).toBe('YUKLENDI');
    expect(await y.dogrula(YOL)).toEqual({ boyut: 7, sha256: sha256HexBayt(bayt('{"a":1}')) });
    expect([y.yuklemeCagrisi, y.dogrulamaCagrisi, y.yuklenenYollar]).toEqual([1, 1, [YOL]]);
  });
  it('mevcut nesneyi EZMEZ ve NESNE_VAR döner', async () => {
    const y = bellekStatikYukleyiciKur({ onceden: { [YOL]: bayt('eski') } });
    expect(await y.yukle(YOL, bayt('yeni'))).toBe('NESNE_VAR');
    expect(new TextDecoder().decode(y.depo.get(YOL))).toBe('eski');
    expect(y.yuklenenYollar).toEqual([]);
  });
  it('ikinci yükleme de NESNE_VAR verir (yalnız ilki yazar)', async () => {
    const y = bellekStatikYukleyiciKur();
    expect(await y.yukle(YOL, bayt('1'))).toBe('YUKLENDI');
    expect(await y.yukle(YOL, bayt('2'))).toBe('NESNE_VAR');
    expect(new TextDecoder().decode(y.depo.get(YOL))).toBe('1');
  });
  it('yüklenen bayt kopyalanır (sonradan değişiklik depoyu etkilemez)', async () => {
    const y = bellekStatikYukleyiciKur();
    const kaynak = bayt('abc');
    await y.yukle(YOL, kaynak);
    kaynak[0] = 0;
    expect(new TextDecoder().decode(y.depo.get(YOL))).toBe('abc');
  });
  it('beyaz liste dışı yol YOL_IZINSIZ verir (yükleme ve doğrulamada) ve depoya yazmaz', async () => {
    const y = bellekStatikYukleyiciKur();
    for (const yol of ['../x.json', '/oynatma-listelerim/hero.json', 'oynatma-listelerim/index.html', 'dosyalar/x.json', 'oynatma-listelerim\\hero.json']) {
      expect((await hata(y.yukle(yol, bayt('x')))).kod).toBe('YOL_IZINSIZ');
      expect((await hata(y.dogrula(yol))).kod).toBe('YOL_IZINSIZ');
    }
    expect(y.depo.size).toBe(0);
    expect(y.yuklemeCagrisi).toBe(5);
  });
  it('olmayan nesneyi doğrulamak INDIRME_HATASI (404) verir', async () => {
    const e = await hata(bellekStatikYukleyiciKur().dogrula(YOL));
    expect([e.kod, e.durum]).toEqual(['INDIRME_HATASI', 404]);
  });
  it('N. yüklemede enjekte edilen hata fırlar (durum 500)', async () => {
    const y = bellekStatikYukleyiciKur({ yuklemeHatasi: { sira: 2, kod: 'DEPO_DOLU' } });
    await y.yukle(YOL, bayt('1'));
    const e = await hata(y.yukle('oynatma-listelerim/kucuk.json', bayt('2')));
    expect([e.kod, e.durum]).toEqual(['DEPO_DOLU', 500]);
  });
  it('indirmeyiBozYol: geri indirilen içerik farklı çıkar (son bayt eksik)', async () => {
    const y = bellekStatikYukleyiciKur({ indirmeyiBozYol: YOL });
    await y.yukle(YOL, bayt('{"a":1}'));
    const uzak = await y.dogrula(YOL);
    expect(uzak.boyut).toBe(6);
    expect(uzak.sha256).not.toBe(sha256HexBayt(bayt('{"a":1}')));
  });
});
