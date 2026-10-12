---
name: "code-style"
description: "Стиль кода, именование, форматирование (TypeScript, vanilla + Vite, турецкий язык кода)"
user-invocable: false
---

# Skill: Code Style — node/vanilla-ts-vite

Форматирование: 2 пробела, одинарные кавычки, точки с запятой, длинные строки допустимы (до ~160-200 символов). Однострочные комментарии `/* ... */` на турецком над функцией — объясняют "почему". Линтера и форматтера нет; обязательная проверка — `pnpm tip` (tsc strict).

## Node

> Стек: TypeScript (strict, ES2022, `moduleResolution: bundler`) + Vite 7, без UI-фреймворка; Supabase (`@supabase/supabase-js`); Vercel API на JS (ESM); Deno Edge Functions. Пакетный менеджер — pnpm workspaces. Расширения: `.ts` (src, Edge Functions), `.js` (`apps/web/api`), `.sql` (миграции).

**Главное правило:** весь код, идентификаторы, комментарии, UI-тексты и сообщения коммитов — на **турецком**. Идентификаторы — без диакритики (`kisileriGetir`, `hataMetni`, `CakismaHatasi`); UI-тексты — с диакритикой.

### Именование

| Элемент | Конвенция | Пример |
|---------|-----------|--------|
| Функции / переменные | camelCase, турецкий, глагол в конце | `kisileriGetir`, `oturumKur`, `menuCiz`, `yonlendiriciBaslat` |
| CRUD в `veri/` | суффиксы `…Getir` / `…Ekle` / `…Guncelle` / `…Sil` / `…GeriAl` / `…Kaydet` (RPC upsert) / `…Listele` (RPC list) | `kisiEkle`, `kisiGeriAl`, `ibanListele` |
| Страницы | `xxxSayfasi(kok: HTMLElement)`; фабрики `davaSayfasi('ceza')`; группы `Record<string, fn>` UPPER_SNAKE | `kisilerSayfasi`, `FINANS_SAYFALARI` |
| Типы | PascalCase, `type` alias (не `interface`); string-union вместо `enum` | `type Kisi = {...}`, `type KisiGirdisi = Omit<Kisi, 'id' \| 'surum'>`, `'kisi' \| 'kurum' \| 'firma'` |
| Подписи union | `Record<Union, string>` UPPER_SNAKE | `TUR_AD`, `ALT_TUR_AD` |
| Классы | только ошибки, `extends Error` | `CakismaHatasi`, `OturumDoldu` |
| Константы | UPPER_SNAKE | `KOLON`, `AZAMI_MESAJ`, `SURE_MS`, `HUBLAR` |
| Файлы | kebab-case турецкий; CSS рядом с фичей | `ozet-hesap.ts`, `bildirim-merkezi.ts`, `dosyalar.css` |
| Поля БД / DTO | snake_case турецкий, 1:1 с колонками | `silindi_at`, `alt_tur`, `sahip_id`, `surum` |
| DOM id / CSS-классы | короткие kebab | `kisi-ara`, `btn primary sm`, `bos`, `hata`, `card` |
| Custom events | префикс `astra:` | `astra:oturum` |
| Локальные короткие имена | допустимы по конвенции | `d` (durum), `k` (kayit), `e`, `g` (girdi), `el`, `h` |

### Типизация
- `strict: true`; без `any` (для внешних данных — `unknown` + сужение или `as T` на границе data-слоя)
- Inline type-imports: `import { istemciAl, type SupabaseClient } from '…'`
- Non-null `!` допустим только при заведомо корректной деструктуризации (`split`), не для обхода проверок

### Структура и импорты
- ESM; в `src/` относительные пути без расширения (`'../../veri/kisiler'`), алиасов нет
- `apps/web/api/*.js` — с явным `.js`; Deno — `npm:@supabase/supabase-js@2` и локальные `.ts`
- CSS импортируется из TS (Vite)
- Слои: `kabuk/` (оболочка, меню, роутер) · `kapi/` (PIN, версия) · `ortak/` (DOM, формат, уведомления, диалоги) · `veri/` (Supabase) · `ozellikler/<feature>/` (страницы) · `*-hesap.ts` (чистая логика)

```ts
import { istemciAl } from './istemci';
import { CakismaHatasi } from './hata';

export type Kisi = { id: string; surum: number; ad: string; silindi_at?: string | null };
export type KisiGirdisi = Omit<Kisi, 'id' | 'surum'>;

const KOLON = 'id,surum,ad';

export async function kisileriGetir(): Promise<Kisi[]> {
  const { data, error } = await istemciAl().from('kisiler').select(KOLON).is('silindi_at', null).order('ad');
  if (error) throw error;
  return (data ?? []) as Kisi[];
}

/* İyimser kilit: yalnız görülen sürüm hâlâ güncelse yazılır. */
export async function kisiGuncelle(id: string, surum: number, g: Partial<KisiGirdisi>): Promise<Kisi> {
  const { data, error } = await istemciAl().from('kisiler').update(g).eq('id', id).eq('surum', surum).select(KOLON);
  if (error) throw error;
  if (!data || data.length === 0) throw new CakismaHatasi();
  return data[0] as Kisi;
}
```

### Обработка ошибок
- Data-слой: `if (error) throw error;`; пустой update при optimistic lock → `throw new CakismaHatasi()`
- UI: `try { … } catch (e) { d.hata = hataMetni(e); }` или `bildir(hataMetni(e), undefined, true)`; `hataMetni` (`veri/hata.ts`) маппит коды `23505/23503/22023/23514/42501/PGRST301` и сетевые ошибки в турецкие тексты
- SQL RPC: `raise exception '…' using errcode = '22023' | '23503' | '28000'` — синхронно с `hataMetni`
- Vercel API: `Object.assign(new Error(msg), { durum })`, ответ `{ error }`; порядок: `no-store` → `oturumVar` 401 → `hizAsildi` 429 → метод 405 → env 503 → валидация 400
- Edge Functions: `yanit(status, { hata: '…' })`
- Пустой `catch {}` — только для best-effort (JSON.parse, localStorage, внешние API погоды/курсов)
- `console.*` не используется; логирования нет

### UI-паттерны (vanilla DOM)
- Страница: state `d: Durum`, `ciz()` перерисовывает через `replaceChildren()`, `yukle()` async; состояния yukleniyor / hata + "Tekrar dene" / bos / нет совпадений
- DOM через `el(tag, sinif, metin)` и `h(tag, {sinif, id, tikla}, ...cocuklar)` из `ortak/dom.ts` (`textContent`)
- `innerHTML` — только статичные SVG/шаблоны; данные — через `kacis()` (`ortak/kacis.ts`)
- Поиск `katla()`, сортировка `localeCompare(b, 'tr')`; деньги `tl()`, даты `gun()` / `gunFarki()` (`ortak/bicim.ts`), часовой пояс Europe/Istanbul (`ortak/zaman.ts`)
- Формы: `<dialog class="kutu">` + `<form method="dialog" noValidate>`, helper `alan(etiket, girdi, ipucu)`; подтверждение `onayla()`; undo — `bildir('…', () => geriAl())`
- Роутинг: `?tab=<ключ>`, реестр `SAYFALAR` (`ozellikler/sayfalar.ts`), меню `HUBLAR` (`kabuk/sekmeler.ts`), старые адреса — `sekmeCoz`
- Pub/sub: `Set<Dinleyici>` и `document` CustomEvent

### Форматирование
- 2 пробела, одинарные кавычки, точки с запятой
- Длинные строки (до ~160–200) и несколько операторов в строке допустимы
- Комментарии — однострочные `/* … */` на турецком над функцией, объясняют "почему"

### Антипаттерны
- Английские/смешанные идентификаторы и UI-тексты
- `select('*')` (column-level grants запрещают), чтение без `.is('silindi_at', null)`, жёсткое удаление
- Update без `.eq('surum', surum)`
- Прямой вызов Supabase из `ozellikler/` минуя `veri/`
- `innerHTML` с пользовательскими данными без `kacis()`
- `interface` / `enum` вместо `type` / string-union
- Хранение токенов/секретов в `localStorage` (сессия только в памяти, `persistSession: false`)
- Новые runtime-зависимости или UI-фреймворки без согласования
- Изменение legacy `apps/web/public/apps/*` (кроме моста `_ortak/kopru.js`)
- Дублирование хелперов из `ortak/` и `veri/kayit.ts`

### Версия и коммиты
- Изменения сопровождаются bump `kapi/surum.ts` (`SURUM`) и записью в `kapi/surum-gecmisi.ts`
- Коммиты на турецком: "Açıklama (v15.8.0)"
- Значимые решения — в `docs/KARAR-KAYDI.md`
