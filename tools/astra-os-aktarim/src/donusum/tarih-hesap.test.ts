import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SENTETIK_TEMEL_TS } from '@astra/ortak-test';
import { donemBasi, donemGecerliMi, donemSonu, gunGecerliMi, istanbulGunu } from './tarih-hesap.ts';

describe('istanbulGunu', () => {
  it('UTC 21:30 ertesi İstanbul gününe düşer (UTC+3)', () => {
    expect(istanbulGunu(Date.UTC(2026, 5, 15, 21, 30))).toBe('2026-06-16');
  });
  it('UTC 20:59:59 hâlâ aynı gündür, 21:00:00 ertesi gündür', () => {
    expect(istanbulGunu(Date.UTC(2026, 5, 15, 20, 59, 59))).toBe('2026-06-15');
    expect(istanbulGunu(Date.UTC(2026, 5, 15, 21, 0, 0))).toBe('2026-06-16');
  });
  it('00:00–03:00 İstanbul kayması: UTC 21:00–23:59 hep ertesi gündür', () => {
    for (const saat of [21, 22, 23]) expect(istanbulGunu(Date.UTC(2026, 0, 10, saat, 0))).toBe('2026-01-11');
  });
  it('yıl ve ay sınırını geçer (31 Aralık UTC 21:30 → 1 Ocak)', () => {
    expect(istanbulGunu(Date.UTC(2026, 11, 31, 21, 30))).toBe('2027-01-01');
    expect(istanbulGunu(Date.UTC(2026, 0, 31, 22, 0))).toBe('2026-02-01');
    expect(istanbulGunu(Date.UTC(2028, 1, 28, 21, 0))).toBe('2028-02-29');
  });
  it('kış ve yaz aynı ofseti kullanır (kalıcı UTC+3)', () => {
    expect(istanbulGunu(Date.UTC(2026, 0, 15, 21, 0))).toBe('2026-01-16');
    expect(istanbulGunu(Date.UTC(2026, 6, 15, 21, 0))).toBe('2026-07-16');
  });
  it('sentetik temel zaman damgası (UTC 09:00) aynı günde kalır', () => {
    expect(istanbulGunu(SENTETIK_TEMEL_TS)).toBe('2026-06-15');
  });
  it('epoch sıfır geçerli bir gündür', () => {
    expect(istanbulGunu(0)).toBe('1970-01-01');
  });
  it.each([[NaN], [Infinity], [-Infinity], [8.64e15 + 1], ['1750000000000'], [null], [undefined]])('%j için null döner', (girdi) => {
    expect(istanbulGunu(girdi as number)).toBeNull();
  });

  it('süreç saat diliminden bağımsızdır (TZ=UTC, Europe/Istanbul, America/Los_Angeles alt süreçlerinde aynı sonuç)', () => {
    const modul = fileURLToPath(new URL('./tarih-hesap.ts', import.meta.url));
    const kod = `import { istanbulGunu } from ${JSON.stringify(modul)}; process.stdout.write(JSON.stringify([istanbulGunu(Date.UTC(2026,5,15,21,30)), istanbulGunu(Date.UTC(2026,11,31,20,59)), istanbulGunu(Date.UTC(2026,11,31,21,0))]));`;
    const sonuclar = ['UTC', 'Europe/Istanbul', 'America/Los_Angeles', 'Pacific/Kiritimati'].map((tz) =>
      execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', kod], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }),
    );
    for (const s of sonuclar) expect(s).toBe('["2026-06-16","2026-12-31","2027-01-01"]');
  });
});

describe('donemBasi / donemSonu', () => {
  const tablo: ReadonlyArray<[string, string, string]> = [
    ['2026-01', '2026-01-01', '2026-01-31'],
    ['2026-02', '2026-02-01', '2026-02-28'],
    ['2028-02', '2028-02-01', '2028-02-29'], /* artık yıl */
    ['2000-02', '2000-02-01', '2000-02-29'], /* 400'e bölünür */
    ['2100-02', '2100-02-01', '2100-02-28'], /* 100'e bölünür, artık değil */
    ['2026-04', '2026-04-01', '2026-04-30'],
    ['2026-12', '2026-12-01', '2026-12-31'],
  ];
  it.each(tablo)('%s -> %s .. %s', (donem, basi, sonu) => {
    expect(donemBasi(donem)).toBe(basi);
    expect(donemSonu(donem)).toBe(sonu);
  });
  it.each([[''], ['2026'], ['2026-1'], ['2026-13'], ['2026-00'], ['26-01'], ['0999-01'], ['2026-01-15'], ['abc'], [' 2026-01']])('geçersiz dönem %j için null döner', (donem) => {
    expect(donemBasi(donem)).toBeNull();
    expect(donemSonu(donem)).toBeNull();
    expect(donemGecerliMi(donem)).toBe(false);
  });
  it('metin olmayan girdiye null döner', () => {
    expect(donemBasi(null as unknown as string)).toBeNull();
    expect(donemSonu(5 as unknown as string)).toBeNull();
    expect(donemGecerliMi(undefined as unknown as string)).toBe(false);
  });
  it('donemGecerliMi geçerli dönemi kabul eder', () => {
    expect(donemGecerliMi('2026-06')).toBe(true);
  });
});

describe('gunGecerliMi', () => {
  it.each([['2026-06-15'], ['2028-02-29'], ['2000-02-29'], ['2026-12-31'], ['2026-01-01']])('%s geçerlidir', (gun) => {
    expect(gunGecerliMi(gun)).toBe(true);
  });
  it.each([['2026-02-29'], ['2100-02-29'], ['2026-04-31'], ['2026-13-01'], ['2026-00-10'], ['2026-06-00'], ['2026-6-15'], ['0999-01-01'], ['dün'], [''], ['2026-06-15T00:00']])('%s geçersizdir', (gun) => {
    expect(gunGecerliMi(gun)).toBe(false);
  });
  it('metin olmayan girdi geçersizdir', () => {
    expect(gunGecerliMi(20260615 as unknown as string)).toBe(false);
  });
});
