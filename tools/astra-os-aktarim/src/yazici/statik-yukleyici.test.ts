import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CANARY_AD, CANARY_ANAHTAR, CANARY_IBAN, canaryBul } from '@astra/ortak-test';
import { Gizli, type Ayar } from '../ayar.ts';
import { sha256HexBayt } from '../guvenlik/ozet.ts';
import { STATIK_ISTEK_ZAMAN_ASIMI_MS, statikYukleyiciOlustur, supabaseStatikYukleyiciAc } from './statik-yukleyici.ts';
import { YaziciHatasi } from './yazici-arayuzu.ts';

const YOL = 'pinterest-panolarim/detay/07.json';
const TABAN = 'https://abcd1234.supabase.co';
const bayt = (s: string): Uint8Array => new TextEncoder().encode(s);

type Sonuc = { error: unknown };
function sahteIstemci(sonuc: Sonuc | (() => Sonuc)): { istemci: SupabaseClient; upload: ReturnType<typeof vi.fn>; from: ReturnType<typeof vi.fn> } {
  const upload = vi.fn(async () => (typeof sonuc === 'function' ? sonuc() : sonuc));
  const from = vi.fn(() => ({ upload }));
  return { istemci: { storage: { from } } as unknown as SupabaseClient, upload, from };
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

describe('statikYukleyiciOlustur: yukle', () => {
  it('apps kovasına upsert:false ile yükler ve YUKLENDI döner', async () => {
    const { istemci, upload, from } = sahteIstemci({ error: null });
    const y = statikYukleyiciOlustur(istemci, TABAN, vi.fn());
    const veri = bayt('{"a":1}');
    expect(await y.yukle(YOL, veri)).toBe('YUKLENDI');
    expect(from).toHaveBeenCalledWith('apps');
    expect(upload).toHaveBeenCalledWith(YOL, veri, { contentType: 'application/json', upsert: false, cacheControl: '86400' });
  });

  it('409 (statusCode/status, sayı ya da metin) NESNE_VAR döner; mesaja bakılmaz', async () => {
    for (const error of [{ statusCode: '409', message: CANARY_AD }, { statusCode: 409 }, { status: 409 }, { status: '409', message: 'The resource already exists' }]) {
      const { istemci } = sahteIstemci({ error });
      expect(await statikYukleyiciOlustur(istemci, TABAN, vi.fn()).yukle(YOL, bayt('x'))).toBe('NESNE_VAR');
    }
  });

  it('yalnız mesajında "already exists" geçen hata NESNE_VAR sayılmaz (durum kodu şart)', async () => {
    const { istemci } = sahteIstemci({ error: { message: 'The resource already exists' } });
    const e = await hata(statikYukleyiciOlustur(istemci, TABAN, vi.fn()).yukle(YOL, bayt('x')));
    expect(e.kod).toBe('BILINMEYEN_HATA');
  });

  it('diğer hatalar süzülür: yalnız kod/durum/tablo; mesaj, ayrıntı ve yol sızmaz', async () => {
    const { istemci } = sahteIstemci({ error: { code: 'PGRST301', statusCode: 403, message: `${CANARY_AD} ${YOL}`, details: CANARY_IBAN, hint: CANARY_ANAHTAR } });
    const e = await hata(statikYukleyiciOlustur(istemci, TABAN, vi.fn()).yukle(YOL, bayt('x')));
    expect([e.kod, e.durum, e.tablo]).toEqual(['PGRST301', 403, 'storage_objects']);
    expect(canaryBul(`${e.message} ${JSON.stringify(e)}`)).toEqual([]);
    expect(e.message).not.toContain(YOL);
  });

  it('fırlatılan istisna da süzülür', async () => {
    const { istemci } = sahteIstemci(() => {
      throw Object.assign(new Error(CANARY_AD), { code: 'ECONNRESET', cause: { details: CANARY_IBAN } });
    });
    const e = await hata(statikYukleyiciOlustur(istemci, TABAN, vi.fn()).yukle(YOL, bayt('x')));
    expect(e.kod).toBe('ECONNRESET');
    expect(canaryBul(e.message)).toEqual([]);
  });

  it('beyaz liste dışı yol ağa çıkmadan YOL_IZINSIZ ile reddedilir', async () => {
    const { istemci, upload, from } = sahteIstemci({ error: null });
    const y = statikYukleyiciOlustur(istemci, TABAN, vi.fn());
    for (const yol of ['../x.json', '/etc/passwd', 'oynatma-listelerim/index.html', 'dosyalar/x.json', 'oynatma-listelerim/detay/1.json', 'a\0b']) {
      expect((await hata(y.yukle(yol, bayt('x')))).kod, yol).toBe('YOL_IZINSIZ');
    }
    expect(upload).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('veritabanı çağrısı yapmaz: istemcide yalnız storage kullanılır', async () => {
    const dokunulan: string[] = [];
    const istemci = new Proxy({}, { get: (_t, ad) => { dokunulan.push(String(ad)); return ad === 'storage' ? { from: () => ({ upload: async () => ({ error: null }) }) } : undefined; } }) as unknown as SupabaseClient;
    await statikYukleyiciOlustur(istemci, TABAN, vi.fn()).yukle(YOL, bayt('x'));
    expect(new Set(dokunulan)).toEqual(new Set(['storage']));
  });
});

describe('statikYukleyiciOlustur: dogrula', () => {
  it('genel adresten önbelleksiz indirir; boyut ve sha256 döner (taban sonundaki bölüler atılır)', async () => {
    const icerik = bayt('{"n":7}');
    const getir = vi.fn(async () => new Response(icerik, { status: 200 }));
    const y = statikYukleyiciOlustur(sahteIstemci({ error: null }).istemci, `${TABAN}//`, getir as unknown as typeof fetch);
    expect(await y.dogrula(YOL)).toEqual({ boyut: 7, sha256: sha256HexBayt(icerik) });
    expect(getir).toHaveBeenCalledTimes(1);
    expect(getir).toHaveBeenCalledWith(`${TABAN}/storage/v1/object/public/apps/${YOL}`, { headers: { 'Cache-Control': 'no-cache' } });
  });

  it('başarısız yanıt INDIRME_HATASI + HTTP durumu verir', async () => {
    const getir = vi.fn(async () => new Response(CANARY_AD, { status: 404 }));
    const e = await hata(statikYukleyiciOlustur(sahteIstemci({ error: null }).istemci, TABAN, getir as unknown as typeof fetch).dogrula(YOL));
    expect([e.kod, e.durum, e.tablo]).toEqual(['INDIRME_HATASI', 404, 'storage_objects']);
    expect(canaryBul(e.message)).toEqual([]);
  });

  it('ağ hatası süzülür (mesaj/yol sızmaz)', async () => {
    const getir = vi.fn(async () => {
      throw Object.assign(new Error(`${CANARY_AD} ${TABAN}`), { code: 'ENOTFOUND' });
    });
    const e = await hata(statikYukleyiciOlustur(sahteIstemci({ error: null }).istemci, TABAN, getir as unknown as typeof fetch).dogrula(YOL));
    expect(e.kod).toBe('ENOTFOUND');
    expect(canaryBul(e.message)).toEqual([]);
    expect(e.message).not.toContain('abcd1234');
  });

  it('beyaz liste dışı yol ağa çıkmadan reddedilir', async () => {
    const getir = vi.fn();
    const y = statikYukleyiciOlustur(sahteIstemci({ error: null }).istemci, TABAN, getir as unknown as typeof fetch);
    expect((await hata(y.dogrula('../x.json'))).kod).toBe('YOL_IZINSIZ');
    expect(getir).not.toHaveBeenCalled();
  });

  it('yol parçaları kodlanır ama bölüler korunur', async () => {
    const getir = vi.fn(async () => new Response('{}', { status: 200 }));
    await statikYukleyiciOlustur(sahteIstemci({ error: null }).istemci, TABAN, getir as unknown as typeof fetch).dogrula('oynatma-listelerim/detay/01.json');
    expect((getir.mock.calls[0] as unknown[])[0]).toBe(`${TABAN}/storage/v1/object/public/apps/oynatma-listelerim/detay/01.json`);
  });
});

describe('supabaseStatikYukleyiciAc', () => {
  const ayar = (servis: Gizli | null): Ayar => ({
    anaMakine: 'abcd1234.supabase.co', kisa: 'abcd...', supabaseUrl: new Gizli(TABAN), anonAnahtar: new Gizli('anon-sentetik'), pin: null, servisAnahtari: servis,
  });
  it('servis anahtarı yoksa ağa çıkmadan SERVIS_ANAHTARI_YOK ile durur', () => {
    try {
      supabaseStatikYukleyiciAc(ayar(null));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(YaziciHatasi);
      expect((e as YaziciHatasi).kod).toBe('SERVIS_ANAHTARI_YOK');
    }
  });
  it('istek zaman aşımı 2 dakikadır', () => {
    expect(STATIK_ISTEK_ZAMAN_ASIMI_MS).toBe(120_000);
  });
});
