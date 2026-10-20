import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Gizli } from '../ayar.ts';
import { OturumHatasi, oturumAc } from './oturum.ts';

const PIN = '654321';
const ERISIM = 'ERISIM-JETONU-SENTETIK';
const YENILEME = 'YENILEME-JETONU-SENTETIK';

type Invoke = { data?: unknown; error?: unknown };
function sahteIstemci(invoke: Invoke | (() => Invoke | Promise<Invoke>), setSession: unknown = { data: { session: { x: 1 } }, error: null }) {
  const invokeFn = vi.fn(async () => (typeof invoke === 'function' ? invoke() : invoke));
  const setSessionFn = vi.fn(async () => setSession);
  const istemci = { functions: { invoke: invokeFn }, auth: { setSession: setSessionFn } } as unknown as SupabaseClient;
  return { istemci, invokeFn, setSessionFn };
}
function hataIleBaslik(durum: unknown, govde: unknown = {}) {
  return { error: { context: { status: durum, json: async () => govde } } };
}
async function hata(p: Promise<unknown>): Promise<OturumHatasi> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(OturumHatasi);
    return e as OturumHatasi;
  }
  throw new Error('OturumHatasi bekleniyordu');
}

describe('oturumAc: PIN biçimi', () => {
  it.each([[''], ['12345'], ['123456789'], ['abcdef'], ['12 3456'], ['12345a'], ['١٢٣٤٥٦'], [' 123456']])('geçersiz PIN %j istek atılmadan PIN_BICIMI verir', async (pin) => {
    const { istemci, invokeFn } = sahteIstemci({ data: {} });
    const e = await hata(oturumAc(istemci, new Gizli(pin)));
    expect(e.kod).toBe('PIN_BICIMI');
    expect(invokeFn).not.toHaveBeenCalled();
    expect(e.message).not.toContain(pin.trim() || 'x@@');
  });
  it.each([['123456'], ['1234567'], ['12345678']])('6–8 haneli PIN %s kabul edilir', async (pin) => {
    const { istemci, invokeFn } = sahteIstemci({ data: { access_token: ERISIM, refresh_token: YENILEME } });
    await expect(oturumAc(istemci, new Gizli(pin))).resolves.toBeUndefined();
    expect(invokeFn).toHaveBeenCalledWith('pin-giris', { body: { pin } });
  });
});

describe('oturumAc: başarı', () => {
  it('jetonlarla oturum kurar (yalnız bellekte)', async () => {
    const { istemci, setSessionFn } = sahteIstemci({ data: { access_token: ERISIM, refresh_token: YENILEME } });
    await oturumAc(istemci, new Gizli(PIN));
    expect(setSessionFn).toHaveBeenCalledWith({ access_token: ERISIM, refresh_token: YENILEME });
  });
  it('sunucu gövdeyi metin döndürürse JSON olarak çözer', async () => {
    const { istemci, setSessionFn } = sahteIstemci({ data: JSON.stringify({ access_token: ERISIM, refresh_token: YENILEME }) });
    await oturumAc(istemci, new Gizli(PIN));
    expect(setSessionFn).toHaveBeenCalledTimes(1);
  });
  it('metin gövde JSON değilse SUNUCU_HATASI verir', async () => {
    const { istemci, setSessionFn } = sahteIstemci({ data: 'bu json degil' });
    expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kod).toBe('SUNUCU_HATASI');
    expect(setSessionFn).not.toHaveBeenCalled();
  });
  it.each([[{}], [null], [undefined], [{ access_token: ERISIM }], [{ refresh_token: YENILEME }], [{ access_token: '', refresh_token: YENILEME }], [{ access_token: ERISIM, refresh_token: '' }], [{ access_token: 5, refresh_token: 6 }]])('eksik/boş jeton %j SUNUCU_HATASI verir', async (data) => {
    const { istemci, setSessionFn } = sahteIstemci({ data });
    expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kod).toBe('SUNUCU_HATASI');
    expect(setSessionFn).not.toHaveBeenCalled();
  });
  it('setSession hata ya da boş oturum dönerse OTURUM_KURULAMADI verir', async () => {
    for (const sonuc of [{ data: { session: null }, error: null }, { data: { session: { x: 1 } }, error: { message: 'x' } }]) {
      const { istemci } = sahteIstemci({ data: { access_token: ERISIM, refresh_token: YENILEME } }, sonuc);
      expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kod).toBe('OTURUM_KURULAMADI');
    }
  });
});

describe('oturumAc: sunucu hataları', () => {
  it('401 PIN_HATALI + kalan deneme sayısı', async () => {
    const { istemci } = sahteIstemci(hataIleBaslik(401, { kalan: 2 }));
    const e = await hata(oturumAc(istemci, new Gizli(PIN)));
    expect([e.kod, e.kalan]).toEqual(['PIN_HATALI', 2]);
    expect(e.message).toBe('OTURUM_HATASI PIN_HATALI kalan=2');
  });
  it('kalan tamsayı değilse null olur', async () => {
    for (const kalan of [1.5, '2', null, undefined, {}]) {
      const { istemci } = sahteIstemci(hataIleBaslik(401, { kalan }));
      expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kalan).toBeNull();
    }
  });
  it('gövde okunamazsa 401 yine PIN_HATALI olur (kalan null)', async () => {
    const { istemci } = sahteIstemci({ error: { context: { status: 401, json: async () => { throw new Error('bozuk'); } } } });
    const e = await hata(oturumAc(istemci, new Gizli(PIN)));
    expect([e.kod, e.kalan]).toEqual(['PIN_HATALI', null]);
  });
  it.each([[423, 'KILITLI'], [409, 'KURULMAMIS'], [500, 'SUNUCU_HATASI'], [502, 'SUNUCU_HATASI'], [400, 'SUNUCU_HATASI'], [404, 'SUNUCU_HATASI']])('HTTP %i -> %s', async (durum, kod) => {
    const { istemci } = sahteIstemci(hataIleBaslik(durum, { kilitBitis: '2026-01-01T00:00:00Z' }));
    expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kod).toBe(kod);
  });
  it('durum kodu yoksa (ağ hatası) BAGLANTI_YOK verir', async () => {
    for (const error of [new Error('fetch failed'), { context: {} }, { context: { status: '401' } }, { message: 'x' }, {}]) {
      const { istemci } = sahteIstemci({ error });
      expect((await hata(oturumAc(istemci, new Gizli(PIN)))).kod).toBe('BAGLANTI_YOK');
    }
  });
  it('TEK deneme: yanlış PIN\'de yeniden deneme yoktur', async () => {
    const { istemci, invokeFn } = sahteIstemci(hataIleBaslik(401, { kalan: 1 }));
    await hata(oturumAc(istemci, new Gizli(PIN)));
    expect(invokeFn).toHaveBeenCalledTimes(1);
  });
  it('kilitli hesapta da yeniden deneme yoktur', async () => {
    const { istemci, invokeFn } = sahteIstemci(hataIleBaslik(423));
    await hata(oturumAc(istemci, new Gizli(PIN)));
    expect(invokeFn).toHaveBeenCalledTimes(1);
  });
});

describe('oturumAc: PIN ve jeton hata nesnesine sızmaz', () => {
  it('tüm hata yollarında PIN ve jetonlar mesajda, JSON\'da ve yığında yoktur', async () => {
    const senaryolar: Invoke[] = [
      hataIleBaslik(401, { kalan: 2, pin: PIN, access_token: ERISIM }),
      hataIleBaslik(423, { pin: PIN }),
      hataIleBaslik(500, { access_token: ERISIM, refresh_token: YENILEME, pin: PIN }),
      { error: new Error(`fetch failed pin=${PIN}`) },
      { data: { access_token: '', refresh_token: YENILEME } },
      { data: `${PIN} ${ERISIM}` },
    ];
    for (const s of senaryolar) {
      const { istemci } = sahteIstemci(s);
      const e = await hata(oturumAc(istemci, new Gizli(PIN)));
      const tum = `${e.message} ${JSON.stringify(e)} ${e.stack ?? ''}`;
      for (const sir of [PIN, ERISIM, YENILEME]) expect(tum).not.toContain(sir);
    }
  });
});
