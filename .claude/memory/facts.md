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
—

## Last Updated
2026-10-12 (vitest-kurulumu)
