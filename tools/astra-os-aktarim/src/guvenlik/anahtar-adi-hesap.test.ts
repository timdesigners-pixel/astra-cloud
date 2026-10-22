import { describe, expect, it } from 'vitest';
import { anahtarAdiGuvenliMi } from './anahtar-adi-hesap.ts';

describe('anahtarAdiGuvenliMi', () => {
  it.each(['TR33-0006-1005-1978-6457-8413-26', 'TR33_0006_1005_1978_6457_8413_26', 'TR33.0006.1005.1978.6457.8413.26', 'TR33 0006 1005 1978 6457 8413 26', 'ayar-12345678', 'x123456789012', 'a1-2b-3c-4d-5e-6f-7g-8h-9i-0j-1k-2l'])(
    'rakam ağırlıklı ad %j reddedilir',
    (ad) => expect(anahtarAdiGuvenliMi(ad)).toBe(false),
  );
  it.each(['ayar-1234567', 'a1234-5678', 'yeni-ayar', 'astra_ozel_v2', 'tema.2024.koyu', 'k-12345-67-89'])('masum ad %j kabul edilir (toplam rakam < 12, ardışık < 8)', (ad) =>
    expect(anahtarAdiGuvenliMi(ad)).toBe(true),
  );
  it('sınır: 11 rakam (ayraçlı) kabul, 12 rakam (ayraçlı) ret', () => {
    expect(anahtarAdiGuvenliMi('a-1234-5678-901')).toBe(true);
    expect(anahtarAdiGuvenliMi('a-1234-5678-9012')).toBe(false);
  });
});
