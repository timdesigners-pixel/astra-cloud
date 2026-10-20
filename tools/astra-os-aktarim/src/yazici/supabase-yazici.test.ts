/* Ağ KULLANILMAZ: Supabase istemcisi zincirleme sorgu kurucusunu taklit eden sahte nesnedir.
   Canlıda doğrulanacak: gerçek PostgREST/RLS davranışı, oturum açma, GRANT'ler (README "canlıda doğrulama"). */
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CANARY_AD, CANARY_IBAN, CANARY_PAROLA, canaryBul } from '@astra/ortak-test';
import { ISTEK_ZAMAN_ASIMI_MS, supabaseYaziciOlustur, zamanAsimliFetch } from './supabase-yazici.ts';
import { DALGA_YAZICI_YOK, YaziciHatasi } from './yazici-arayuzu.ts';

type Zincir = [string, unknown[]];
type Cagri = { tur: 'from' | 'rpc'; ad: string; zincir: Zincir[]; param?: unknown };
type Yanit = { data: unknown; error: unknown };

function kur(yanit: (c: Cagri, sira: number) => Yanit | Promise<Yanit>) {
  const cagrilar: Cagri[] = [];
  const kurucu = (c: Cagri) => {
    const b: Record<string, unknown> = {};
    for (const ad of ['select', 'insert', 'update', 'eq', 'is', 'in', 'not', 'order', 'range']) {
      b[ad] = (...a: unknown[]) => {
        c.zincir.push([ad, a]);
        return b;
      };
    }
    b.then = (coz: (v: Yanit) => unknown, red: (e: unknown) => unknown) => Promise.resolve(yanit(c, cagrilar.indexOf(c))).then(coz, red);
    return b;
  };
  const stopAutoRefresh = vi.fn(async () => undefined);
  const istemci = {
    from: (ad: string) => {
      const c: Cagri = { tur: 'from', ad, zincir: [] };
      cagrilar.push(c);
      return kurucu(c);
    },
    rpc: (ad: string, param: unknown) => {
      const c: Cagri = { tur: 'rpc', ad, zincir: [], param };
      cagrilar.push(c);
      return kurucu(c);
    },
    auth: { stopAutoRefresh },
  } as unknown as SupabaseClient;
  return { yazici: supabaseYaziciOlustur(istemci), cagrilar, stopAutoRefresh };
}
const tamam = (data: unknown = []): Yanit => ({ data, error: null });
const adim = (c: Cagri, ad: string): unknown[] | undefined => c.zincir.find(([a]) => a === ad)?.[1];

async function hata(p: Promise<unknown>): Promise<YaziciHatasi> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(YaziciHatasi);
    return e as YaziciHatasi;
  }
  throw new Error('YaziciHatasi bekleniyordu');
}
const UUID = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

describe('eslesmeOku', () => {
  it('açık sütun listesi, kaynak süzgeci ve sıralamayla sorgular (select * yok)', async () => {
    const { yazici, cagrilar } = kur(() => tamam([]));
    await yazici.eslesmeOku();
    const c = cagrilar[0]!;
    expect(c.ad).toBe('aktarim_eslesme');
    expect(adim(c, 'select')).toEqual(['id,koleksiyon,kaynak_id,hedef_tablo,hedef_id,hedef_ref,aktarim_id,dalga,silindi_at,ekstra']);
    expect(adim(c, 'eq')).toEqual(['kaynak', 'astra-os']);
    expect(adim(c, 'order')).toEqual(['id']);
    expect(adim(c, 'range')).toEqual([0, 999]);
    expect(String(adim(c, 'select')![0])).not.toContain('*');
  });
  it('aktarim_id ve dalga süzgeçlerini ekler', async () => {
    const { yazici, cagrilar } = kur(() => tamam([]));
    await yazici.eslesmeOku({ aktarim_id: UUID(1), dalga: 'b' });
    expect(cagrilar[0]!.zincir.filter(([a]) => a === 'eq').map(([, a]) => a)).toEqual([['kaynak', 'astra-os'], ['aktarim_id', UUID(1)], ['dalga', 'b']]);
  });
  it('1000 satırlık sayfaları birleştirir', async () => {
    const sayfa = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));
    const { yazici, cagrilar } = kur((_c, sira) => tamam(sira === 0 ? sayfa(1000) : sira === 1 ? sayfa(3) : []));
    expect(await yazici.eslesmeOku()).toHaveLength(1003);
    expect(cagrilar.map((c) => adim(c, 'range'))).toEqual([[0, 999], [1000, 1999]]);
  });
  it('dizi olmayan yanıtı boş sayar', async () => {
    expect(await kur(() => tamam(null)).yazici.eslesmeOku()).toEqual([]);
  });
});

describe('hata süzme', () => {
  const sizintili = { code: '23505', message: `Key (ad)=(${CANARY_AD}) already exists`, details: CANARY_IBAN, hint: CANARY_PAROLA };

  it('dönen hata nesnesi (error) süzülür: yalnız kod ve çağıranın tablosu', async () => {
    const { yazici } = kur(() => ({ data: null, error: sizintili }));
    const e = await hata(yazici.satirEkle('begeniler', [{ kod: 'k1', ad: 'x' }]));
    expect([e.kod, e.tablo, e.durum]).toEqual(['23505', 'begeniler', null]);
    expect(canaryBul(`${e.message} ${JSON.stringify(e)} ${e.stack ?? ''}`)).toEqual([]);
  });
  it('fırlatılan hata (ağ) da süzülür', async () => {
    const { yazici } = kur(() => {
      throw Object.assign(new Error(`${CANARY_AD} ${CANARY_IBAN}`), { code: 'ECONNRESET' });
    });
    const e = await hata(yazici.eslesmeOku());
    expect([e.kod, e.tablo]).toEqual(['ECONNRESET', 'aktarim_eslesme']);
    expect(canaryBul(e.message)).toEqual([]);
  });
  it('kodsuz hata BILINMEYEN_HATA olur', async () => {
    const { yazici } = kur(() => ({ data: null, error: { message: CANARY_AD } }));
    expect((await hata(yazici.eslesmeOku())).kod).toBe('BILINMEYEN_HATA');
  });
  it('RPC hatasında tablo bilgisi yoktur', async () => {
    const { yazici } = kur(() => ({ data: null, error: sizintili }));
    const e = await hata(yazici.uygulamaDurumuYaz('odeme', 'a', 'v'));
    expect([e.kod, e.tablo]).toEqual(['23505', null]);
  });
});

describe('eslesmeEkle / eslesmeGuncelle', () => {
  const girdi = { koleksiyon: 'apps', kaynak_id: 'odeme/a', hedef_tablo: 'uygulama_durumu', hedef_id: null, hedef_ref: 'odeme/a', aktarim_id: UUID(1), dalga: 'a' as const, ekstra: { durum: 'yazildi' as const } };

  it('boş listede istek atmaz', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    await yazici.eslesmeEkle([]);
    expect(cagrilar).toEqual([]);
  });
  it('satırları toplu insert eder (ekstra kopyalanır)', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    await yazici.eslesmeEkle([girdi]);
    const [govde] = adim(cagrilar[0]!, 'insert')!;
    expect(govde).toEqual([girdi]);
    expect((govde as { ekstra: unknown }[])[0]!.ekstra).not.toBe(girdi.ekstra);
  });
  it('güncelleme yalnız verilen alanları gönderir ve etkilenen satır yoksa ESLESME_YOK verir', async () => {
    const { yazici, cagrilar } = kur(() => tamam([]));
    const e = await hata(yazici.eslesmeGuncelle('s1', { silindi_at: '2026-06-15T09:00:00.000Z' }));
    expect([e.kod, e.tablo]).toEqual(['ESLESME_YOK', 'aktarim_eslesme']);
    expect(adim(cagrilar[0]!, 'update')).toEqual([{ silindi_at: '2026-06-15T09:00:00.000Z' }]);
    expect(adim(cagrilar[0]!, 'eq')).toEqual(['id', 's1']);
    expect(adim(cagrilar[0]!, 'select')).toEqual(['id']);
  });
  it('etkilenen satır varsa başarılıdır', async () => {
    await expect(kur(() => tamam([{ id: 's1' }])).yazici.eslesmeGuncelle('s1', { silindi_at: null })).resolves.toBeUndefined();
  });
});

describe('satirEkle', () => {
  it('yalnız insert GRANT\'indeki sütunları gönderir (id, silindi_at, sahip_id vb. düşer)', async () => {
    const { yazici, cagrilar } = kur(() => tamam([{ id: UUID(1), kod: 'k1' }]));
    await yazici.satirEkle('begeniler', [{ kod: 'k1', ad: 'x', fiyat: 1, id: 'sahte', silindi_at: 'x', sahip_id: 'x', olusturma: 'x', surum: 9 }]);
    const [govde] = adim(cagrilar[0]!, 'insert')!;
    expect(Object.keys((govde as Record<string, unknown>[])[0]!).sort()).toEqual(['ad', 'fiyat', 'kod']);
    expect(adim(cagrilar[0]!, 'select')).toEqual(['id,kod']);
  });
  it('kimlikleri kod ile eşler', async () => {
    const { yazici } = kur(() => tamam([{ id: UUID(2), kod: 'k2' }, { id: UUID(1), kod: 'k1' }]));
    expect(await yazici.satirEkle('begeniler', [{ kod: 'k1', ad: 'a' }, { kod: 'k2', ad: 'b' }])).toEqual([{ id: UUID(2), kod: 'k2' }, { id: UUID(1), kod: 'k1' }]);
  });
  it('dönen satır sayısı uyuşmazsa SATIR_SAYISI_UYUSMADI verir', async () => {
    const { yazici } = kur(() => tamam([{ id: UUID(1), kod: 'k1' }]));
    expect((await hata(yazici.satirEkle('begeniler', [{ kod: 'k1', ad: 'a' }, { kod: 'k2', ad: 'b' }]))).kod).toBe('SATIR_SAYISI_UYUSMADI');
  });
  it('boş listede istek atmaz; başka tablo DALGA_YAZICI_YOK verir', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    expect(await yazici.satirEkle('begeniler', [])).toEqual([]);
    expect((await hata(yazici.satirEkle('borclar' as never, [{ kod: 'x' }]))).kod).toBe(DALGA_YAZICI_YOK);
    expect(cagrilar).toEqual([]);
  });
});

describe('satirGizle', () => {
  it('yalnız silindi_at yazar, yalnız silinmemiş satırlara dokunur ve 100\'lük yığınlar kullanır', async () => {
    const idler = Array.from({ length: 250 }, (_, i) => UUID(i + 1));
    const { yazici, cagrilar } = kur(() => tamam());
    await yazici.satirGizle('begeniler', idler);
    expect(cagrilar).toHaveLength(3);
    expect(cagrilar.map((c) => (adim(c, 'in')![1] as string[]).length)).toEqual([100, 100, 50]);
    for (const c of cagrilar) {
      expect(Object.keys((adim(c, 'update')![0] as Record<string, unknown>))).toEqual(['silindi_at']);
      expect(adim(c, 'in')![0]).toBe('id');
      expect(adim(c, 'is')).toEqual(['silindi_at', null]);
    }
  });
  it('boş listede istek atmaz; başka tablo DALGA_YAZICI_YOK verir', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    await yazici.satirGizle('begeniler', []);
    expect(cagrilar).toEqual([]);
    expect((await hata(yazici.satirGizle('borclar' as never, ['x']))).kod).toBe(DALGA_YAZICI_YOK);
  });
});

describe('begeniler okuma', () => {
  it('kodları silinmemiş ve kodlu satırlardan açık sütunlarla okur; bozuk satırları atar', async () => {
    const { yazici, cagrilar } = kur(() => tamam([{ id: UUID(1), kod: 'k1', olusturma: '2026-01-01T00:00:00Z' }, { id: UUID(2), kod: 'k2' }, { id: 5, kod: 'k3' }, { id: UUID(4), kod: null }]));
    expect(await yazici.begeniKodlariOku()).toEqual([{ id: UUID(1), kod: 'k1', olusturma: '2026-01-01T00:00:00Z' }, { id: UUID(2), kod: 'k2', olusturma: null }]);
    const c = cagrilar[0]!;
    expect(adim(c, 'select')).toEqual(['id,kod,olusturma']);
    expect(adim(c, 'is')).toEqual(['silindi_at', null]);
    expect(adim(c, 'not')).toEqual(['kod', 'is', null]);
  });
  it('fiyatları okur; sayı, sayısal metin ve geçersiz değerleri ayırır; 100\'lük yığınlar kullanır', async () => {
    const idler = Array.from({ length: 150 }, (_, i) => UUID(i + 1));
    const { yazici, cagrilar } = kur((c) => tamam(c.zincir.some(([a, x]) => a === 'in' && (x[1] as string[]).includes(UUID(1))) ? [{ id: UUID(1), fiyat: 12.5 }, { id: UUID(2), fiyat: '7.25' }, { id: UUID(3), fiyat: 'abc' }, { id: UUID(4), fiyat: null }, { id: UUID(5), fiyat: '' }, { id: 5, fiyat: 1 }] : []));
    const sonuc = await yazici.begeniFiyatlariOku(idler);
    expect(sonuc).toEqual([{ id: UUID(1), fiyat: 12.5 }, { id: UUID(2), fiyat: 7.25 }, { id: UUID(3), fiyat: null }, { id: UUID(4), fiyat: null }, { id: UUID(5), fiyat: null }]);
    expect(cagrilar).toHaveLength(2);
    expect(adim(cagrilar[0]!, 'select')).toEqual(['id,fiyat']);
    expect(adim(cagrilar[0]!, 'is')).toEqual(['silindi_at', null]);
  });
});

describe('uygulama_durumu RPC\'leri', () => {
  it('anahtar adlarını okur (değerler atılır); dizi/null yanıt boş sayılır', async () => {
    const { yazici, cagrilar } = kur(() => tamam({ a: CANARY_PAROLA, b: CANARY_IBAN }));
    const adlar = await yazici.uygulamaAnahtarlariOku('odeme');
    expect(adlar).toEqual(['a', 'b']);
    expect(canaryBul(JSON.stringify(adlar))).toEqual([]);
    expect(cagrilar[0]).toMatchObject({ tur: 'rpc', ad: 'uygulama_durumu_oku', param: { p_uygulama: 'odeme' } });
    expect(await kur(() => tamam([1, 2])).yazici.uygulamaAnahtarlariOku('odeme')).toEqual([]);
    expect(await kur(() => tamam(null)).yazici.uygulamaAnahtarlariOku('odeme')).toEqual([]);
  });
  it('yaz: değer olduğu gibi (yeniden serileştirme yok) gönderilir', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    const deger = ' {"a" : 1}\n';
    await yazici.uygulamaDurumuYaz('odeme', 'odeme-raporu-v1', deger);
    expect(cagrilar[0]).toMatchObject({ ad: 'uygulama_durumu_yaz', param: { p_uygulama: 'odeme', p_anahtar: 'odeme-raporu-v1', p_deger: deger } });
  });
  it('sil: tek anahtar gönderilir; boş anahtar ANAHTAR_BOS ile ağa çıkmadan reddedilir (tüm uygulamayı silmez)', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    await yazici.uygulamaDurumuSil('odeme', 'a');
    expect(cagrilar[0]).toMatchObject({ ad: 'uygulama_durumu_sil', param: { p_uygulama: 'odeme', p_anahtar: 'a' } });
    for (const bos of ['', null as unknown as string, undefined as unknown as string]) expect((await hata(yazici.uygulamaDurumuSil('odeme', bos))).kod).toBe('ANAHTAR_BOS');
    expect(cagrilar).toHaveLength(1);
  });
  it('bekleyen RPC adları DALGA_YAZICI_YOK, bilinmeyen RPC_IZINSIZ verir; hiçbirinde ağ isteği yoktur', async () => {
    const { yazici, cagrilar } = kur(() => tamam());
    for (const ad of ['iban_ekle', 'icra_kaydet', 'icra_sil', 'dava_kaydet', 'sifre_kaydet'] as const) expect((await hata(yazici.rpcCagir(ad, {}))).kod).toBe(DALGA_YAZICI_YOK);
    expect((await hata(yazici.rpcCagir('drop_table' as never, {}))).kod).toBe('RPC_IZINSIZ');
    expect(cagrilar).toEqual([]);
  });
});

describe('kapat', () => {
  it('otomatik yenilemeyi durdurur; durdurma hatası işi bozmaz', async () => {
    const { yazici, stopAutoRefresh } = kur(() => tamam());
    await yazici.kapat();
    expect(stopAutoRefresh).toHaveBeenCalledTimes(1);
    stopAutoRefresh.mockRejectedValueOnce(new Error(CANARY_AD));
    await expect(yazici.kapat()).resolves.toBeUndefined();
  });
});

describe('zamanAsimliFetch', () => {
  it('varsayılan istek zaman aşımı 30 saniyedir', () => {
    expect(ISTEK_ZAMAN_ASIMI_MS).toBe(30_000);
  });
  it('isteği sinyal ekleyerek iletir ve yanıtı döndürür', async () => {
    const temel = vi.fn(async (_g: unknown, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response('ok');
    });
    const f = zamanAsimliFetch(1000, temel as unknown as typeof fetch);
    const yanit = await f('https://ornek.invalid/x', { method: 'POST', headers: { a: 'b' } });
    expect(await yanit.text()).toBe('ok');
    expect(temel.mock.calls[0]![1]).toMatchObject({ method: 'POST', headers: { a: 'b' } });
  });
  it('süre dolunca ZAMAN_ASIMI koduyla hata verir (mesaj URL taşımaz)', async () => {
    const temel = vi.fn((_g: unknown, init?: RequestInit) => new Promise<Response>((_coz, red) => init!.signal!.addEventListener('abort', () => red(new Error('iptal https://ornek.invalid/gizli')))));
    const f = zamanAsimliFetch(15, temel as unknown as typeof fetch);
    try {
      await f('https://ornek.invalid/gizli');
      expect.unreachable();
    } catch (e) {
      expect((e as { cause?: { code?: string } }).cause?.code).toBe('ZAMAN_ASIMI');
      expect((e as Error).message).toBe('zaman asimi');
    }
  });
  it('zaman aşımı dışındaki hatayı olduğu gibi iletir', async () => {
    const asil = new Error('baglanti');
    const f = zamanAsimliFetch(1000, vi.fn(async () => { throw asil; }) as unknown as typeof fetch);
    await expect(f('https://ornek.invalid/x')).rejects.toBe(asil);
  });
  it('çağıranın kendi sinyali de iptali tetikler', async () => {
    const dis = new AbortController();
    const temel = vi.fn((_g: unknown, init?: RequestInit) => new Promise<Response>((_coz, red) => init!.signal!.addEventListener('abort', () => red(new Error('dis iptal')))));
    const f = zamanAsimliFetch(5000, temel as unknown as typeof fetch);
    const p = f('https://ornek.invalid/x', { signal: dis.signal });
    dis.abort();
    await expect(p).rejects.toThrowError('dis iptal');
  });
});
