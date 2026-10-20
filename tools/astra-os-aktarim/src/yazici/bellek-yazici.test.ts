import { describe, it, expect } from 'vitest';
import { CANARY_AD, CANARY_IBAN, CANARY_PAROLA, canaryBul } from '@astra/ortak-test';
import { bellekDeposuKur, bellekYaziciKur } from './bellek-yazici.ts';
import { DALGA_YAZICI_YOK, YaziciHatasi, type EslesmeGirdisi } from './yazici-arayuzu.ts';

const AKTARIM = '11111111-1111-4111-8111-000000000001';
function eg(ek: Partial<EslesmeGirdisi> = {}): EslesmeGirdisi {
  return { koleksiyon: 'apps', kaynak_id: 'odeme/a', hedef_tablo: 'uygulama_durumu', hedef_id: null, hedef_ref: 'odeme/a', aktarim_id: AKTARIM, dalga: 'a', ekstra: { durum: 'yazildi' }, ...ek };
}
function begeni(kod: string, ek: Record<string, unknown> = {}): Record<string, unknown> & { kod: string } {
  return { kod, ad: `Ad ${kod}`, fiyat: 1, ...ek };
}
async function hata(p: Promise<unknown>): Promise<YaziciHatasi> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(YaziciHatasi);
    return e as YaziciHatasi;
  }
  throw new Error('YaziciHatasi bekleniyordu');
}

describe('bellek yazıcı: eşleşme tablosu', () => {
  it('ekler, okur ve sorgu süzgeçlerini uygular', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeEkle([eg(), eg({ kaynak_id: 'odeme/b', dalga: 'b', aktarim_id: '22222222-2222-4222-8222-000000000002' })]);
    expect(await y.eslesmeOku()).toHaveLength(2);
    expect(await y.eslesmeOku({ dalga: 'a' })).toHaveLength(1);
    expect(await y.eslesmeOku({ aktarim_id: '22222222-2222-4222-8222-000000000002' })).toHaveLength(1);
    expect(await y.eslesmeOku({ dalga: 'c' })).toEqual([]);
  });
  it('okunan satır depodaki nesnenin KOPYASIDIR (dışarıdan değiştirilemez)', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeEkle([eg()]);
    const [s] = await y.eslesmeOku();
    s!.ekstra.durum = 'bozuk';
    expect((await y.eslesmeOku())[0]!.ekstra.durum).toBe('yazildi');
  });
  it('tekil indeks kısmi değildir: aynı (koleksiyon, kaynak_id) silinmiş olsa bile 23505', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeEkle([eg()]);
    const [s] = await y.eslesmeOku();
    await y.eslesmeGuncelle(s!.id, { silindi_at: '2026-06-15T09:00:00.000Z' });
    expect((await hata(y.eslesmeEkle([eg()]))).kod).toBe('23505');
  });
  it('toplu ekleme atomiktir: bir satır bozuksa hiçbiri eklenmez', async () => {
    const y = bellekYaziciKur();
    expect((await hata(y.eslesmeEkle([eg(), eg({ kaynak_id: 'x', hedef_id: null, hedef_ref: null })]))).kod).toBe('23514');
    expect(y.depo.eslesme).toEqual([]);
    expect((await hata(y.eslesmeEkle([eg(), eg()]))).kod).toBe('23505');
    expect(y.depo.eslesme).toEqual([]);
  });
  it('CHECK kısıtları: geçersiz koleksiyon, kaynak_id uzunluğu, hedef_ref uzunluğu, dalga', async () => {
    const y = bellekYaziciKur();
    for (const k of [eg({ koleksiyon: 'Apps' }), eg({ kaynak_id: '' }), eg({ kaynak_id: 'x'.repeat(201) }), eg({ hedef_ref: 'r'.repeat(261) }), eg({ dalga: 'z' as never }), eg({ hedef_tablo: 'Tablo!' })]) {
      expect((await hata(y.eslesmeEkle([k]))).kod).toBe('23514');
    }
  });
  it('güncelleme yalnız izinli sütunları değiştirir; olmayan satır ESLESME_YOK', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeEkle([eg()]);
    const [s] = await y.eslesmeOku();
    await y.eslesmeGuncelle(s!.id, { dalga: 'b', kaynak_id: 'degisti' } as never);
    const [g] = await y.eslesmeOku();
    expect(g!.dalga).toBe('b');
    expect(g!.kaynak_id).toBe('odeme/a');
    expect((await hata(y.eslesmeGuncelle('yok', { dalga: 'a' }))).kod).toBe('ESLESME_YOK');
  });
});

describe('bellek yazıcı: begeniler', () => {
  it('ekler, kimlik/kod çifti döner ve kod tekilliğini uygular (23505)', async () => {
    const y = bellekYaziciKur();
    const eklenen = await y.satirEkle('begeniler', [begeni('k1'), begeni('k2')]);
    expect(eklenen.map((e) => e.kod)).toEqual(['k1', 'k2']);
    expect(new Set(eklenen.map((e) => e.id)).size).toBe(2);
    expect((await hata(y.satirEkle('begeniler', [begeni('k1')]))).kod).toBe('23505');
    expect((await hata(y.satirEkle('begeniler', [begeni('k9'), begeni('k9')]))).kod).toBe('23505');
    expect(y.depo.begeniler.map((b) => b.kod)).toEqual(['k1', 'k2']);
  });
  it('adı boş satır 23502 verir', async () => {
    const y = bellekYaziciKur();
    expect((await hata(y.satirEkle('begeniler', [begeni('k1', { ad: '' })]))).kod).toBe('23502');
  });
  it('gizlenen (soft delete) satırın kodu yeniden kullanılabilir ve okumada görünmez', async () => {
    const y = bellekYaziciKur();
    const [e] = await y.satirEkle('begeniler', [begeni('k1', { fiyat: 5 })]);
    await y.satirGizle('begeniler', [e!.id]);
    expect(await y.begeniKodlariOku()).toEqual([]);
    expect(await y.begeniFiyatlariOku([e!.id])).toEqual([]);
    await expect(y.satirEkle('begeniler', [begeni('k1')])).resolves.toHaveLength(1);
    expect(y.depo.begeniler).toHaveLength(2); /* fiziksel silme yok */
  });
  it('kod ve fiyat okuma yalnız silinmemiş satırları verir; fiyatı olmayan null döner', async () => {
    const y = bellekYaziciKur();
    const e = await y.satirEkle('begeniler', [begeni('k1', { fiyat: 12.5 }), begeni('k2', { fiyat: undefined })]);
    expect((await y.begeniFiyatlariOku(e.map((x) => x.id))).map((f) => f.fiyat)).toEqual([12.5, null]);
    expect((await y.begeniKodlariOku()).map((b) => b.kod)).toEqual(['k1', 'k2']);
  });
  it('başlangıç verisi (önceden var olan kullanıcı satırları) okunur', async () => {
    const y = bellekYaziciKur(bellekDeposuKur({ begeniler: [begeni('on-1')] }));
    expect((await y.begeniKodlariOku())[0]!.kod).toBe('on-1');
  });
  it('satırlar eklenirken kopyalanır (sonradan değişiklik depoyu etkilemez)', async () => {
    const y = bellekYaziciKur();
    const satir = begeni('k1', { ozellikler: ['a'] });
    await y.satirEkle('begeniler', [satir]);
    (satir.ozellikler as string[]).push('b');
    expect(y.depo.begeniler[0]!.ozellikler).toEqual(['a']);
  });
});

describe('bellek yazıcı: uygulama_durumu', () => {
  it('yazar, anahtarları okur (yalnız adlar) ve aynı anahtarı EZER (upsert)', async () => {
    const y = bellekYaziciKur();
    await y.uygulamaDurumuYaz('odeme', 'a', 'v1');
    await y.uygulamaDurumuYaz('odeme', 'a', 'v2');
    await y.uygulamaDurumuYaz('odeme', 'b', 'v3');
    expect(await y.uygulamaAnahtarlariOku('odeme')).toEqual(['a', 'b']);
    expect(y.depo.uygulamaDurumu.get('odeme')!.get('a')).toBe('v2');
    expect(await y.uygulamaAnahtarlariOku('yok')).toEqual([]);
  });
  it('22023: geçersiz uygulama kodu, boş/uzun anahtar, 8 MB üstü değer, metin olmayan değer', async () => {
    const y = bellekYaziciKur();
    expect((await hata(y.uygulamaDurumuYaz('Odeme', 'a', 'v'))).kod).toBe('22023');
    expect((await hata(y.uygulamaDurumuYaz('odeme', '', 'v'))).kod).toBe('22023');
    expect((await hata(y.uygulamaDurumuYaz('odeme', 'a'.repeat(201), 'v'))).kod).toBe('22023');
    expect((await hata(y.uygulamaDurumuYaz('odeme', 'a', 'x'.repeat(8388609)))).kod).toBe('22023');
    expect((await hata(y.uygulamaDurumuYaz('odeme', 'a', 5 as unknown as string))).kod).toBe('22023');
    await expect(y.uygulamaDurumuYaz('odeme', 'a', 'x'.repeat(8388608))).resolves.toBeUndefined();
  });
  it('silme tek anahtarı siler; boş anahtar ANAHTAR_BOS verir (tüm uygulamayı silmez)', async () => {
    const y = bellekYaziciKur(bellekDeposuKur({ uygulamaDurumu: { odeme: { a: '1', b: '2' } } }));
    await y.uygulamaDurumuSil('odeme', 'a');
    expect(await y.uygulamaAnahtarlariOku('odeme')).toEqual(['b']);
    expect((await hata(y.uygulamaDurumuSil('odeme', ''))).kod).toBe('ANAHTAR_BOS');
    expect(await y.uygulamaAnahtarlariOku('odeme')).toEqual(['b']);
  });
});

describe('bellek yazıcı: RPC ve dalga sınırı', () => {
  it('bekleyen RPC adları DALGA_YAZICI_YOK, bilinmeyen ad RPC_IZINSIZ verir', async () => {
    const y = bellekYaziciKur();
    for (const ad of ['iban_ekle', 'icra_kaydet', 'icra_sil', 'dava_kaydet', 'sifre_kaydet'] as const) expect((await hata(y.rpcCagir(ad, {}))).kod).toBe(DALGA_YAZICI_YOK);
    expect((await hata(y.rpcCagir('baska_rpc' as never, {}))).kod).toBe('RPC_IZINSIZ');
  });
  it('canlı RPC\'ler çalışır', async () => {
    const y = bellekYaziciKur();
    await y.rpcCagir('uygulama_durumu_yaz', { p_uygulama: 'odeme', p_anahtar: 'a', p_deger: 'v' });
    expect(await y.rpcCagir('uygulama_durumu_oku', { p_uygulama: 'odeme' })).toEqual({ a: 'v' });
  });
  it('begeniler dışındaki tabloya ekleme/gizleme DALGA_YAZICI_YOK verir', async () => {
    const y = bellekYaziciKur();
    expect((await hata(y.satirEkle('borclar' as never, [begeni('x')]))).kod).toBe(DALGA_YAZICI_YOK);
    expect((await hata(y.satirGizle('borclar' as never, ['x']))).kod).toBe(DALGA_YAZICI_YOK);
  });
});

describe('bellek yazıcı: hata enjeksiyonu ve sayaçlar', () => {
  it('N. çağrıda yalnız bir kez hata fırlatır ve işlemden ÖNCE (yan etki yok)', async () => {
    const y = bellekYaziciKur();
    y.hataEnjekte({ n: 2, yontem: 'uygulamaDurumuYaz', kod: '23505' });
    await y.uygulamaDurumuYaz('odeme', 'a', '1');
    expect((await hata(y.uygulamaDurumuYaz('odeme', 'b', '2'))).kod).toBe('23505');
    expect(await y.uygulamaAnahtarlariOku('odeme')).toEqual(['a']);
    await y.uygulamaDurumuYaz('odeme', 'b', '2');
    expect(await y.uygulamaAnahtarlariOku('odeme')).toEqual(['a', 'b']);
  });
  it('yöntem verilmezse tüm çağrılar sayılır', async () => {
    const y = bellekYaziciKur();
    y.hataEnjekte({ n: 3, kod: '22023' });
    await y.eslesmeOku();
    await y.begeniKodlariOku();
    expect((await hata(y.uygulamaAnahtarlariOku('odeme'))).kod).toBe('22023');
  });
  it('enjekte edilen ayrıntı (canary) hata nesnesine, mesajına ve JSON\'una girmez', async () => {
    const ayrinti = `${CANARY_AD} ${CANARY_IBAN} ${CANARY_PAROLA}`;
    const y = bellekYaziciKur();
    y.hataEnjekte({ n: 1, yontem: 'satirEkle', kod: '23505', ayrinti });
    const e = await hata(y.satirEkle('begeniler', [begeni('k1')]));
    expect([e.kod, e.tablo, e.durum]).toEqual(['23505', 'begeniler', null]);
    expect(canaryBul(`${e.message} ${JSON.stringify(e)} ${e.stack ?? ''}`)).toEqual([]);
    expect(e.message).toBe('YAZICI_HATASI kod=23505 durum=- tablo=begeniler');
  });
  it('cagriSayisi yöntem bazında ve toplam sayar; kapat sayılır ve kapatildiMi true olur', async () => {
    const y = bellekYaziciKur();
    await y.eslesmeOku();
    await y.eslesmeOku();
    await y.begeniKodlariOku();
    expect(y.cagriSayisi('eslesmeOku')).toBe(2);
    expect(y.cagriSayisi('begeniKodlariOku')).toBe(1);
    expect(y.cagriSayisi('satirEkle')).toBe(0);
    expect(y.cagriSayisi()).toBe(3);
    expect(y.kapatildiMi()).toBe(false);
    await y.kapat();
    expect(y.kapatildiMi()).toBe(true);
    expect(y.cagriSayisi('kapat')).toBe(1);
  });
  it('aynı depoya bağlı yeni yazıcı kalıcı veriyi görür (ikinci çalıştırma simülasyonu), sayaçlar ayrıdır', async () => {
    const depo = bellekDeposuKur();
    const y1 = bellekYaziciKur(depo);
    await y1.uygulamaDurumuYaz('odeme', 'a', '1');
    const y2 = bellekYaziciKur(depo);
    expect(await y2.uygulamaAnahtarlariOku('odeme')).toEqual(['a']);
    expect(y2.cagriSayisi('uygulamaDurumuYaz')).toBe(0);
  });
  it('saat enjekte edilebilir (olusturma damgası)', async () => {
    const y = bellekYaziciKur(bellekDeposuKur(), { saat: () => new Date('2026-06-15T09:00:00.000Z') });
    await y.satirEkle('begeniler', [begeni('k1')]);
    expect((await y.begeniKodlariOku())[0]!.olusturma).toBe('2026-06-15T09:00:00.000Z');
  });
});
