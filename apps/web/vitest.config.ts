import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /* Europe/Istanbul: tarih/yerel biçim testleri her ortamda aynı sonucu versin */
    env: { TZ: 'Europe/Istanbul' },
  },
});
