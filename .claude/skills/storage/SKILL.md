---
name: "storage"
description: "Паттерны работы с хранилищами данных: Postgres (Supabase), RLS, миграции, Storage"
user-invocable: false
---

# Skill: Storage — astra-cloud

## Primary Database

- Тип: PostgreSQL (Supabase, облако)
- ORM/Driver: нет ORM — `@supabase/supabase-js` (PostgREST query builder + `.rpc()`), серверная логика — PL/pgSQL
- Конфиг: env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; `supabase/config.toml` отсутствует (локального стека нет)

## Миграции

- Формат: raw SQL, только forward (без down), комментарии на турецком
- Директория: `supabase/migrations/NNNN_<turkish_snake>.sql` (0001...0026), напр. `0003_kisiler_ibanlar.sql`
- Команды (вручную, Supabase CLI/дашборд):
  - Создать: `supabase migration new <ad>` (или файл с следующим номером вручную)
  - Применить: `supabase db push`
  - Откатить: нет — исправляющая миграция
  - Статус: `supabase migration list`

## Типы столбцов

| Назначение | Тип | Пример |
|------------|-----|--------|
| PK | `uuid` default `gen_random_uuid()` | `id` |
| Владелец | `uuid` default `auth.uid()` -> `auth.users` | `sahip_id` |
| Время | `timestamptz` | `olusturma`, `guncelleme`, `silindi_at` |
| Версия (optimistic lock) | `int not null default 1` | `surum` |
| Деньги | `numeric` | суммы borclar/odemeler |
| Дата без времени | `date` | сроки, vade |
| Гибкие поля | `jsonb not null default '{}'` | `ekstra` |
| Текст с лимитом | `text` + `check (length(...) <= N)` | `ad` |
| Перечисления | `text` + `check (x in (...))` | `tur`, `alt_tur` |
| Шифрованные | `text`/`bytea` через pgcrypto | `iban_sifreli`, `dosya_no_sifreli` |

## Индексы

- Частичные: `create index <ad>_sahip on public.<ad> (sahip_id) where silindi_at is null`
- Уникальность — частичные индексы `where silindi_at is null`
- Для IBAN — `iban_hash` (HMAC) для уникальности без раскрытия значения

## Стандартная таблица

```sql
create table public.<ad> (
  id uuid primary key default gen_random_uuid(),
  sahip_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  surum int not null default 1,
  silindi_at timestamptz,
  cihaz text,
  ekstra jsonb not null default '{}'::jsonb
);
create trigger <ad>_hazirla before insert or update on public.<ad>
  for each row execute function public.kayit_hazirla();
alter table public.<ad> enable row level security;
-- политики <ad>_oku / _ekle / _guncelle: sahip_id = (select auth.uid()); DELETE-политики нет
revoke all on public.<ad> from anon, authenticated;
grant select on public.<ad> to authenticated;
grant insert (...), update (..., silindi_at) -- column-level grants
```

## Шифрование и RPC

- `pgcrypto` в схеме `extensions`; ключ `private.alan_anahtari()` из Vault (`astra_alan_anahtari`); схема `private` закрыта для `anon/authenticated`
- Шифруемое (IBAN, пароли, номера дел, `uygulama_durumu`) — только через `security definer` RPC: `revoke all ... from public, anon; grant execute ... to authenticated`
- Функции: `set search_path = ''`, полные имена; ошибки `raise exception ... using errcode` (22023 / 23503 / 28000), согласованы с `hataMetni`

## Object Storage (Supabase Storage)

- Buckets: `zihin` (10 МБ), `belgeler` (25 МБ), `saglik` (25 МБ) — приватные; `apps` (50 МБ, JSON) и `dosyalar` (10 МБ, whitelist MIME) — публичные
- Политики `storage.objects` по `sahip_id`/префиксу пути; upload `upsert: false`; при ошибке записи метаданных — откат `remove([yol])`; выдача `createSignedUrl(yol, sureSn, {download})`
- Именование путей: префикс владельца/каталога фичи, как в `veri/dosyalar.ts`, `veri/tahlil.ts`, `ozellikler/zihin/depo.ts`

## Клиентское хранение

- Cache/Queue: нет. Сессия — только в памяти. `localStorage` — только UI-предпочтения, всегда в `try {} catch {}`. Кэш внешних API — в памяти 30 мин.

## Именование

| Элемент | Конвенция | Пример |
|---------|-----------|--------|
| Таблицы | snake_case, турецкий, мн. число | `kisiler`, `icra_dosyalari` |
| Столбцы | snake_case, турецкий | `silindi_at`, `alt_tur`, `sahip_id` |
| FK | `<ad>_id` | `sahip_id`, `borc_id` |
| Индексы | `<tablo>_<kolon>` | `kisiler_sahip` |
| Триггеры | `<tablo>_hazirla` | `kisiler_hazirla` |
| Политики | `<tablo>_oku/_ekle/_guncelle` | `kisiler_oku` |
| RPC | snake_case, турецкий | `iban_listele`, `odeme_isaretle` |
| Buckets | короткие турецкие | `belgeler` |

## Антипаттерны

- `select *` на таблицах с column grants; забытый фильтр `.is('silindi_at', null)`
- Жёсткое удаление там, где принято мягкое
- Новая таблица без RLS, триггера `kayit_hazirla`, `revoke`/column-level grants
- Функции без `set search_path = ''`
- Доступ к шифрованным колонкам напрямую (минуя RPC); ключ шифрования в коде
- Down-миграции и правка уже применённых миграций (создавай новую)
- Нарушение инвариантов: долг вне `borclar`, заём как доход
- Реальные персональные данные в seed/фикстурах/тестах
