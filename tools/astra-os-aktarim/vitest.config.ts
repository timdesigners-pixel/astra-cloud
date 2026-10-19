import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /* Europe/Istanbul: tarih testleri her ortamda aynı sonucu versin (apps/web ile aynı) */
    env: { TZ: 'Europe/Istanbul' },
  },
});
