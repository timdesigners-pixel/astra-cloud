# Project Facts

## Stack
- **Lang:** node
- **Framework:** vanilla-ts-vite
- **DB:** postgres (supabase)
- **Frontend:** vanilla TypeScript + Vite (no framework)

## Key Paths
- Source: apps/web/src, packages/*/src
- Tests: Vitest (apps/web/vitest.config.ts), тесты рядом с модулем `*.test.ts`; общие хелперы — packages/ortak-test/src; запуск `pnpm test`
- Migrations: supabase/migrations

## Active Decisions
Нет (см. memory/decisions/)

## Known Issues
- Sayı biçimi kuralı (tr-TR): tek virgül = ondalık ('1,234' → 1.234); çok gruplu virgül = binlik ('1,234,567' → 1234567)

## Last Updated
2026-10-19 (zihin-css-kayip-secici)
