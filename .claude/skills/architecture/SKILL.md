---
name: "architecture"
description: "Архитектурные паттерны и структура проекта astra-cloud"
user-invocable: false
---

# Skill: Architecture — astra-cloud (ASTRA FİNANS OS)

Персональная "финансовая ОС" одного владельца (single-tenant, PIN-вход). Только облако: Vercel (статика + serverless API) + Supabase (Postgres, Auth, Storage, Edge Functions). Решения фиксируются в `docs/KARAR-KAYDI.md`. Старый репозиторий `astra-os` — read-only референс.

## Стек

- Язык: TypeScript ^5.6 (strict, ES2022, `moduleResolution: bundler`); Vercel API — JS (ESM); Edge Functions — Deno/TS
- Фреймворк: vanilla TypeScript + Vite 7 (без UI-фреймворка)
- БД: Postgres (Supabase), клиент `@supabase/supabase-js`, RLS
- Кэш: нет; очереди: нет
- Object storage: Supabase Storage (5 bucket-ов)
- Пакетный менеджер: pnpm 10 workspaces; Node 22 в CI
- Деплой: Vercel (Git-интеграция), CI: GitHub Actions
- Внешние: Gemini (через `/api/*`), marketfiyati.org.tr, open-meteo / er-api / gold-api (из браузера)

## Структура модулей

```
apps/web/                  @astra/web — SPA (Vite 7 + vanilla TS strict)
  index.html               разметка PIN-экрана (#gate) и каркаса
  src/main.ts              вход: CSS -> kapiyiBaslat() -> kabuguBaslat()
  src/kapi/                PIN-ворота (gate.ts), версия (surum.ts, surum-gecmisi.ts)
  src/kabuk/               оболочка: меню/хабы (sekmeler.ts, kabuk.ts), роутер (?tab=), тема, период, иконки
  src/ozellikler/<feature>/  страницы-фичи; sayfalar.ts — реестр страниц
  src/veri/                data-access: Supabase-клиент, CRUD, RPC, вызовы /api/*, ошибки
  src/ortak/               общие UI-утилиты (dom, bildirim, kutu, uyari, bicim, zaman, kacis)
  src/stiller/             глобальные CSS
  api/*.js                 Vercel Serverless Functions (Gemini-прокси, market, link-preview)
  public/apps/*            12 legacy-мини-приложений (iframe sandbox, исходники не менять)
packages/alan              (пусто) чистая бизнес-логика
packages/sema              (пусто) схемы и типы
packages/ortak-test        (пусто) синтетические данные и тест-хелперы
supabase/migrations        0001...0026 — нумерованные SQL-миграции
supabase/functions         Deno Edge Functions: pin-giris, saglik-esitle
tools/, docs/
```

## Цепочка зависимостей

```
main.ts
  +- kapi/gate.ts --fetch--> Edge Function pin-giris --> session --> veri/istemci.oturumKur()
  +- kabuk/kabuk.ts (меню, роутер, панель, уведомления, палитра команд)
        +- ozellikler/sayfalar.ts: SAYFALAR[tab](kok)
              +- ozellikler/<feature>/*.ts   (UI: el()/h(), state d, ciz(), yukle())
                    +- ozellikler/<feature>/*-hesap.ts  (чистые расчёты)
                    +- veri/<entity>.ts      (Supabase select/insert/update/rpc, fetch('/api/...'))
                          +- veri/istemci.ts (singleton SupabaseClient, session в памяти)
```

Направление: `ozellikler -> veri -> istemci`; `ozellikler -> ortak`; `kabuk -> ozellikler/sayfalar`. Известное нарушение: `veri/panel.ts` импортирует расчёты из `ozellikler/kayit/ozet-hesap.ts` — не копировать.

## DI Bindings

DI-контейнера нет. Синглтоны модульного уровня (`istemci`, `dinleyiciler`, `aktif`); связь — прямые импорты, `Set<Dinleyici>` и `document` CustomEvent (`astra:oturum`). Для тестируемости серверные функции принимают зависимости параметром (`getir`, `cozucu`).

## Routes / Endpoints

Фронт-роутинг: `?tab=<ключ>` + `history.pushState`; реестр `SAYFALAR: Record<string, (kok) => void>`; меню из `HUBLAR` (`kabuk/sekmeler.ts`); `sekmeCoz` поддерживает старые адреса.

| Метод | Путь | Handler | Middleware |
|-------|------|---------|-----------|
| POST | `/api/sohbet` | `apps/web/api/sohbet.js` (Gemini чат, роли) | oturumVar, hizAsildi (`SOHBET_HIZ`) |
| POST | `/api/tahlil` | `apps/web/api/tahlil.js` (разбор анализов Gemini) | oturumVar |
| GET/POST | `/api/tasarim` | `apps/web/api/tasarim.js` (Gemini, fallback моделей) | oturumVar |
| GET | `/api/market` | `apps/web/api/market.js` (`?islem=yakin|ara`) | oturumVar, hizAsildi (`MARKET_HIZ`) |
| GET | `/api/onizleme` | `apps/web/api/onizleme.js` (link preview, SSRF-защита) | oturumVar |
| POST | Edge `pin-giris` | `supabase/functions/pin-giris` (PIN -> сессия) | PIN HMAC(pepper), блокировки, аудит `denetim` |
| POST | Edge `saglik-esitle` | `supabase/functions/saglik-esitle` (webhook здоровья) | API-ключ `astra_sag_...` (хранится SHA-256) |

Порядок в Vercel handler: `Cache-Control: no-store` -> `oturumVar` (401) -> `hizAsildi` (429) -> метод (405) -> env-ключ (503) -> валидация (400). `_guvenlik.js` (префикс `_`) не публикуется как endpoint.

## Ключевые абстракции

- `veri/istemci.ts` — singleton SupabaseClient; токен только в памяти (`persistSession: false`); `istemciAl()` бросает `'oturum yok'`
- `veri/kayit.ts` — generic CRUD (`kayitlariGetir`, `kayitEkle`, `kayitGuncelle`) с явными колонками и `.is('silindi_at', null)`
- `veri/hata.ts` — `hataMetni`, `CakismaHatasi`, `OturumDoldu`
- `ortak/dom.ts` — `el()`, `h()`, `katla()`; `ortak/bicim.ts` — `tl()`, `gun()`, `gunFarki()`
- `*-hesap.ts` — чистые расчёты без DOM и сети
- Инварианты (KARAR-KAYDI): долг только в `borclar`; фактические движения — `hareketler`, плановые — `vadeler`, платежи — `odemeler`; заём не доход (`gelir_sayilir = false`); время — Europe/Istanbul

## Паттерны

- Страница = `xxxSayfasi(kok: HTMLElement)`; локальный state `d`; `ciz()` перерисовывает контейнер через `replaceChildren()`; `yukle()` async; состояния yukleniyor / hata (+ "Tekrar dene") / пусто / нет совпадений
- Optimistic lock: `.update(g).eq('id', id).eq('surum', surum)`; пустой ответ = `CakismaHatasi`
- Soft delete `silindi_at` + undo-toast "Geri al"
- Чувствительные данные только через `security definer` RPC
- Внешние бесключевые API — из браузера с кэшем 30 мин в памяти; ключевые — через `/api/*`
- iframe-приложения: sandbox без `allow-same-origin`, мост `postMessage` (`ozellikler/uygulamalar/kopru.ts`), данные через RPC `uygulama_durumu_*`

## Антипаттерны

- `innerHTML` с неэкранированными данными (использовать `textContent`/`h()` или `kacis()`)
- `select('*')` на таблицах с column-level grants
- Бизнес-логика внутри UI-функций вместо `*-hesap.ts`
- Секреты (Gemini, service role) на клиенте; `localStorage` для сессии
- Новые импорты `veri -> ozellikler` (нарушение слоёв)
- Правки `public/apps/*` (legacy)
- Добавление фреймворка, кэш-слоя, очереди без decision
- Английские идентификаторы и тексты — код на турецком
