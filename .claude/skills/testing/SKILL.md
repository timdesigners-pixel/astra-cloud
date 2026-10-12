---
name: "testing"
description: "Паттерны тестирования, покрытие, фреймворки (Vitest, Playwright)"
user-invocable: false
---

# Skill: Testing — node/Vitest

## Node

> **Состояние:** тестовой инфраструктуры пока нет (`test_frameworks`/`test_cmds` пусты, `frontend_test: none`). CI (`.github/workflows/ci.yml`) запускает только `pnpm tip` (tsc) и `pnpm build`. Пакет `packages/ortak-test` зарезервирован под общие тест-хелперы (seed-данные, фиксированное время, golden), сейчас — заглушка.

### Фреймворк (рекомендуемый)
- Test runner: **Vitest** (нативен для Vite, ESM/TS без доп. настройки)
- Mock library: `vi.fn()`, `vi.mock()`, `vi.spyOn()`
- Assertion: `expect` (Vitest)
- Coverage: `@vitest/coverage-v8` (только после согласования зависимости)
- DOM-окружение (если нужно): `happy-dom` через `// @vitest-environment happy-dom` (после согласования)

Подключение при первом тесте: `vitest` в devDependencies пакета, скрипт `"test": "vitest run"`, в корне `"test": "pnpm -r run test"`; добавить шаг `pnpm test` в CI.

### Команды
- Запуск всех: `pnpm test` (после подключения) или `pnpm --filter @astra/web exec vitest run`
- Один файл: `pnpm --filter @astra/web exec vitest run src/ozellikler/kayit/ozet-hesap.test.ts`
- С coverage: `pnpm --filter @astra/web exec vitest run --coverage`
- Watch: `pnpm --filter @astra/web exec vitest`
- Type-check (обязателен всегда): `pnpm tip`

### Именование

| Элемент | Конвенция | Пример |
|---------|-----------|--------|
| Файлы | `<modul>.test.ts` рядом с модулем | `ozet-hesap.test.ts`, `hata.test.ts` |
| describe | имя функции/модуля | `describe('hataMetni', …)` |
| it | поведение, можно на турецком | `it('23505 için "Bu kayıt zaten var." döner')` |

### Шаблон теста

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hataMetni, CakismaHatasi } from './hata';

describe('hataMetni', () => {
  it('çakışma hatasını Türkçe metne çevirir', () => {
    expect(hataMetni(new CakismaHatasi())).toContain('başka bir yerde değişmiş');
  });
  it('bilinmeyen hata için genel metin döner', () => {
    expect(hataMetni({ code: 'XXXXX' })).toBe('İşlem yapılamadı.');
  });
});

/* Veri katmanı: istemci taklit edilir, gerçek Supabase yok. */
vi.mock('./istemci', () => ({ istemciAl: vi.fn() }));
```

### Приоритеты покрытия
1. Чистая логика без моков: `*-hesap.ts`, `ozet-hesap.ts`, `veri/panel.ts`, `veri/plan-coz.ts`, `veri/tahlil-ayikla.ts`, `ortak/bicim.ts` (`tl`, `gun`, `gunFarki`), `ortak/dom.ts#katla`, `ortak/kacis.ts`, `veri/hata.ts#hataMetni`, будущий `packages/alan`
2. Data-слой `veri/*.ts`: мок `./istemci` с цепочкой query builder; проверять явный список колонок, `.is('silindi_at', null)`, `.eq('surum', …)`, `CakismaHatasi` при пустом ответе, проброс `error`
3. Vercel API (`apps/web/api/*.js`): handler с фейковыми `req`/`res` — порядок guard-ов (401/429/405/503/400)
4. UI-страницы — минимально (smoke через happy-dom) или E2E

### Правила моков
- Никакой реальной сети и реального Supabase; `fetch` — `vi.spyOn(globalThis, 'fetch')`
- Время — `vi.useFakeTimers()` + `vi.setSystemTime(...)` или передача времени параметром (часовой пояс Europe/Istanbul!)
- Заглушки типизировать через `as unknown as T`, без `any`
- Общие фабрики/seed — в `packages/ortak-test/src/`, не дублировать по тестам
- Сбрасывать моки в `beforeEach(() => vi.clearAllMocks())`

### Граничные случаи (специфика проекта)
- Турецкий регистр: `İ/ı/I/i` в поиске и сортировке (`katla`, `localeCompare('tr')`)
- Даты `YYYY-MM-DD` без TZ-сдвига, границы месяца/года, полночь по Стамбулу
- Деньги: отрицательные суммы (убыток), 0, большие значения, формат `tl()`
- `null`-поля, пустые списки, мягко удалённые записи

### Структура директорий
```
apps/web/src/
  ortak/bicim.ts
  ortak/bicim.test.ts
  veri/hata.ts
  veri/hata.test.ts
  ozellikler/kayit/ozet-hesap.ts
  ozellikler/kayit/ozet-hesap.test.ts
packages/ortak-test/src/index.ts   # seed, sabit saat, golden yardımcıları
```

### E2E Testing (frontend: vanilla TS + Vite)
- Фреймворк: Playwright (через Playwright MCP / `@playwright/test` после согласования)
- Команда запуска: `pnpm dev` (порт 3000) + сценарии Playwright
- Паттерны:
  - Page Objects для оболочки (меню `HUBLAR`, навигация `?tab=`)
  - Стабильные селекторы по `id` (`kisi-ara`) или `data-testid`
  - Скриншоты ключевых состояний (yukleniyor / hata / bos)
  - Smoke: PIN-экран открывается, после входа рендерится Genel Bakış
- Реальный PIN и данные — только тестовые; никаких секретов в тестах

### Антипаттерны
- Тесты, ходящие в реальный Supabase / внешние API
- Зависимость от текущей даты/часового пояса машины
- Снапшоты всего DOM вместо проверок поведения
- Дублирование фабрик вместо `packages/ortak-test`
- `any` в тестах; отключение `strict`
