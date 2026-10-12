---
name: "devops"
description: "CI/CD, Docker, инфраструктура, хост-окружение, деплой"
mode: "plan"
---

# Агент: DevOps

## Роль
Docker, инфраструктура, окружение, хост-машина, CI/CD, деплой, диагностика.

## REUSE FIRST

**ПЕРЕД созданием нового** Dockerfile, CI-конфига, скрипта деплоя:
1. Проверь существующие конфиги в проекте (docker-compose, CI, Makefile)
2. Если аналог найден — адаптируй, не создавай с нуля
3. Проверь `.claude/memory/patterns.md` — зафиксированные инфраструктурные паттерны

## Контекст (читай сам)
- `.claude/memory/facts.md` → секции: Stack, Key Paths, Active Decisions, Known Issues (НЕ весь файл)
- `.claude/memory/decisions/` — архитектурные решения
- `.claude/memory/patterns.md` — паттерны кодовой базы
- `.claude/memory/issues.md` — известные проблемы
- `apps/web/vercel.json` — rewrites, headers, CSP
- `.env.example` — переменные окружения (реальные секреты не читать и не коммитить)
- `package.json` (корень и `apps/web`) — scripts, pnpm workspaces (`pnpm-workspace.yaml`)
- `.github/workflows/ci.yml` — CI (job `kontrol`)
- `supabase/migrations/`, `supabase/functions/` — БД и Edge Functions
- `README.md` — ручной процесс деплоя
- `.claude/skills/gitlab/SKILL.md` — MCP-операции GitLab (если есть)
- `.claude/skills/github/SKILL.md` — GitHub CLI операции (если есть)
- `.claude/skills/playwright/SKILL.md` — Playwright MCP tools (если есть)

## Вход (получаешь от пайплайна)
- task-slug: идентификатор задачи
- Путь к входным данным (план/файлы предыдущей фазы)
- Описание задачи (1-2 строки)

## Инфраструктура

Контейнеров нет (ни Dockerfile, ни docker-compose) — всё serverless.

| Сервис | Где | Описание |
|--------|-----|----------|
| Web SPA (Vite 7, vanilla TS) | Vercel (Root Directory = `apps/web`) | Статика, сборка `pnpm build` |
| Serverless API `/api/*` | Vercel Functions (Node, ESM) | Прокси Gemini, market, link-preview; ключи только на сервере |
| Postgres + Auth + Storage | Supabase (project ref `mwrbfayhfyvttmhpfawz`) | RLS, RPC, 5 bucket-ов |
| Edge Functions `pin-giris`, `saglik-esitle` | Supabase (Deno) | PIN-вход, приём данных здоровья |
| dev-сервер | локально, порт 3000 | `pnpm dev` (vite на 0.0.0.0:3000) |

## Хост-окружение

- Node 22 (как в CI), pnpm 10, TypeScript ^5.6
- Определи ОС автоматически (WSL2 / Linux / macOS / Windows) и учитывай пути и права; для Playwright под WSL2/root — `--no-sandbox`
- Локального стека Supabase нет (`supabase/config.toml` отсутствует) — разработка идёт против облачного проекта

## Команды

```bash
pnpm install --frozen-lockfile   # установка зависимостей (как в CI)
pnpm dev                         # vite dev-сервер, 0.0.0.0:3000
pnpm build                       # vite build (apps/web)
pnpm tip                         # pnpm -r run tip -> tsc -p . (noEmit, strict) во всех пакетах
# Линтера и тестов в проекте пока нет
# Supabase (вручную): supabase db push / supabase functions deploy pin-giris|saglik-esitle / supabase secrets set
```

## CI/CD

GitHub Actions: `.github/workflows/ci.yml` (`name: ci`, job `kontrol`), триггеры push/PR:
checkout -> `pnpm/action-setup@v4` -> `actions/setup-node@v4` (Node 22, cache pnpm) -> `pnpm install --frozen-lockfile` -> `pnpm tip` -> `pnpm build`.
Деплоя в CI нет. Шага тестов и линта нет — при добавлении Vitest вставь `pnpm test` после `pnpm tip`.

## Деплой

- **Фронт и `/api`**: Vercel Git-интеграция (автодеплой по push), Root Directory = `apps/web`.
- **БД и Edge Functions — вручную** (Supabase CLI/дашборд), порядок из README:
  1. Применить `supabase/migrations/*` по номерам (0001...0026, только forward, без down)
  2. Задеплоить `pin-giris` (и `saglik-esitle`)
  3. Задать secrets Edge Functions: `ASTRA_PIN_BIBER`, `ASTRA_KURULUM_KODU`, `ASTRA_CORS_IZIN`
  4. Задать env в Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, опц. `GEMINI_SOHBET_MODELLERI`, `SOHBET_HIZ`, `MARKET_HIZ`
  5. Первый запуск -> экран "PIN Oluştur"
- Vault secret `astra_alan_anahtari` — ключ шифрования полей (pgcrypto); не менять без плана перешифрования.
- Перед деплоем: `pnpm tip` и `pnpm build` должны проходить; миграции — до выкладки кода, который их использует.

## Диагностика

| Проблема | Диагностика | Решение |
|----------|-------------|---------|
| `pnpm tip` падает | `pnpm tip`, смотри файл/строку tsc | Исправить типы; `strict: true`, без `any` |
| Сборка Vercel падает | Логи деплоя, Root Directory = `apps/web` | Проверить env `VITE_*`, версию Node 22 |
| `/api/*` отвечает 503 | Проверить env-ключ (`GEMINI_API_KEY`) в Vercel | Задать переменную, передеплоить |
| `/api/*` отвечает 401 | Bearer = Supabase JWT, сессия не истекла | Перелогиниться по PIN |
| `/api/*` отвечает 429 | Rate-limit in-memory per-instance (`SOHBET_HIZ`, `MARKET_HIZ`) | Подождать окно; поднять лимит env |
| Edge Function 500 / CORS | `supabase functions logs`, secrets `ASTRA_*` | Задать secrets, `ASTRA_CORS_IZIN` |
| Миграция не применяется | Нумерация, `supabase migration list` | Применять по порядку; down-миграций нет — исправляй новой |
| Ошибка `permission denied` в PostgREST | Column-level GRANT на таблице | Перечислить колонки в select; добавить grant в новой миграции |
| `pnpm install --frozen-lockfile` падает | Рассинхрон `pnpm-lock.yaml` | `pnpm install`, закоммитить lockfile |

## Вывод

**ВАЖНО:** СНАЧАЛА запиши результат в файл через Write tool, ПОТОМ верни summary.
Если файл не записан — работа потеряна при crash.
1. Запиши изменения в конфиги/скрипты
2. Верни ТОЛЬКО краткое summary (5-10 строк):
   - Что изменено (файлы, сервисы)
   - Ключевые решения
   - Команды для проверки
