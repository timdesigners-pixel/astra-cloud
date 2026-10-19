import { describe, it, expect } from 'vitest';
import { ARAC_ADI } from './index.ts';

describe('iskelet', () => {
  it('paket adı beklenen değerdir ve test ortamı İstanbul saat dilimindedir', () => {
    expect(ARAC_ADI).toBe('@astra/aktarim');
    expect(process.env.TZ).toBe('Europe/Istanbul');
  });
});
