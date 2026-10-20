import { describe, it, expect } from 'vitest';
import { CANARY_AD, CANARY_IBAN, CANARY_PAROLA, canaryBul } from '@astra/ortak-test';
import { hataGuvenli } from './sir-koruma.ts';

const SIZINTILI = { message: `Key (ad)=(${CANARY_AD}) already exists`, details: `iban=${CANARY_IBAN}`, hint: CANARY_PAROLA };

describe('hataGuvenli', () => {
  it('PostgREST hatasında yalnız kod döner; message/details/hint hiç okunmaz', () => {
    const s = hataGuvenli({ code: '23505', ...SIZINTILI });
    expect(s).toEqual({ kod: '23505', durum: null, tablo: null });
    expect(canaryBul(JSON.stringify(s))).toEqual([]);
  });

  it('kod alanı code alanından önceliklidir', () => {
    expect(hataGuvenli({ kod: 'YEREL', code: '23505' }).kod).toBe('YEREL');
    expect(hataGuvenli({ code: 'PGRST116' }).kod).toBe('PGRST116');
  });

  it.each([
    ['boşluklu', 'kod ile bosluk'],
    ['canary değer', CANARY_AD],
    ['IBAN', CANARY_IBAN + 'ç'],
    ['41 karakter', 'A'.repeat(41)],
    ['boş', ''],
    ['eğik çizgi', 'a/b'],
    ['sayı', 23505],
    ['nesne', { toString: () => '23505' }],
    ['null', null],
  ])('desen dışı kod (%s) BILINMEYEN_HATA olur', (_ad, kod) => {
    expect(hataGuvenli({ code: kod }).kod).toBe('BILINMEYEN_HATA');
  });

  it('40 karakterlik kod ve nokta/tire/alt çizgi kabul edilir', () => {
    expect(hataGuvenli({ code: 'A'.repeat(40) }).kod).toBe('A'.repeat(40));
    expect(hataGuvenli({ code: 'a.b-c_d' }).kod).toBe('a.b-c_d');
  });

  it('HTTP durumu durum, status ya da statusCode alanından 100–599 aralığında alınır', () => {
    expect(hataGuvenli({ code: 'X', durum: 409 }).durum).toBe(409);
    expect(hataGuvenli({ code: 'X', status: 500 }).durum).toBe(500);
    expect(hataGuvenli({ code: 'X', statusCode: 404 }).durum).toBe(404);
    expect(hataGuvenli({ code: 'X', durum: 99, status: 503 }).durum).toBe(503);
  });

  it.each([[600], [99], [200.5], ['409'], [NaN], [null], [{}]])('geçersiz durum %j yok sayılır', (d) => {
    expect(hataGuvenli({ code: 'X', status: d }).durum).toBeNull();
  });

  it('tablo adı yalnız çağıranın verdiği, desene uyan değerdir', () => {
    expect(hataGuvenli({ code: 'X' }, 'begeniler').tablo).toBe('begeniler');
    expect(hataGuvenli({ code: 'X' }, 'aktarim_eslesme').tablo).toBe('aktarim_eslesme');
    expect(hataGuvenli({ code: 'X', tablo: 'hileli', table: 'hileli2' }).tablo).toBeNull();
    for (const t of ['Begeniler', 'a', 'x'.repeat(41), 'tablo-adi', CANARY_AD, '', 'public.begeniler']) expect(hataGuvenli({ code: 'X' }, t).tablo).toBeNull();
  });

  it('Error örneğinin mesajı sızmaz', () => {
    const e = Object.assign(new Error(`${CANARY_AD} ${CANARY_PAROLA}`), { code: '22023', details: CANARY_IBAN });
    const s = hataGuvenli(e, 'begeniler');
    expect(s).toEqual({ kod: '22023', durum: null, tablo: 'begeniler' });
    expect(canaryBul(JSON.stringify(s))).toEqual([]);
  });

  it('hata fırlatan erişimci (getter) yok sayılır', () => {
    const kotu = {
      get code(): string {
        throw new Error(CANARY_AD);
      },
      get status(): number {
        throw new Error(CANARY_AD);
      },
    };
    expect(hataGuvenli(kotu)).toEqual({ kod: 'BILINMEYEN_HATA', durum: null, tablo: null });
  });

  it.each([[null], [undefined], ['düz metin'], [42], [true], [[]], [Symbol.iterator]])('nesne olmayan hata %j BILINMEYEN_HATA verir', (hata) => {
    expect(hataGuvenli(hata)).toEqual({ kod: 'BILINMEYEN_HATA', durum: null, tablo: null });
  });

  it('metin hata değeri sızmaz', () => {
    expect(canaryBul(JSON.stringify(hataGuvenli(CANARY_AD)))).toEqual([]);
  });
});
