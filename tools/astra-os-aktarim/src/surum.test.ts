import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ARAC_ADI } from './index.ts';
import { ARAC_SURUMU } from './surum.ts';

describe('ARAC_SURUMU', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string };

  it('package.json sürümüyle aynıdır (onay kodu girdisi)', () => {
    expect(ARAC_SURUMU).toBe(pkg.version);
  });
  it('MAJOR.MINOR.PATCH biçimindedir (plan şeması bunu ister)', () => {
    expect(ARAC_SURUMU).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('paket adı ARAC_ADI ile aynıdır', () => {
    expect(ARAC_ADI).toBe(pkg.name);
  });
});
