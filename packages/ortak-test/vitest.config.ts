import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /* Europe/Istanbul: apps/web ve tools ile aynı saat dilimi */
    env: { TZ: 'Europe/Istanbul' },
  },
});
