---
name: "caching"
description: "Паттерны кеширования данных"
user-invocable: false
---

# Skill: Caching — Паттерны кеширования данных

## Паттерны
- Серверного кэша (Redis и т.п.) в проекте нет — не вводить без decision
- Кэш внешних бесключевых API (погода, курсы, золото) — в памяти модуля, TTL 30 мин; ключ = URL/параметры
- Сессия Supabase — только в памяти (`persistSession: false`)
- `localStorage` — только UI-предпочтения (тема, меню, режим редактора), всегда `try {} catch {}`
- Данные страницы живут в замыкании (`d`); инвалидация = повторный `yukle()` после записи
- Подписанные URL Storage (`createSignedUrl`) кэшировать не дольше срока их жизни
- Vercel API: заголовок `Cache-Control: no-store` для всех ответов с пользовательскими данными

## Антипаттерны
- Кэшировать ответы RPC с шифрованными/чувствительными данными (пароли, IBAN) в localStorage
- Кэш без TTL и без инвалидации после записи
- Общий кэш между пользователями в serverless (in-memory живёт per-instance)
- Хранить токены/сессию в localStorage

## Примеры
```ts
const SURE_MS = 30 * 60 * 1000;
const onbellek = new Map<string, { t: number; v: unknown }>();

/* Dış API yanıtı 30 dk bellekte tutulur; sunucu tarafı yok. */
export async function onbellekliGetir<T>(anahtar: string, getir: () => Promise<T>): Promise<T> {
  const k = onbellek.get(anahtar);
  if (k && Date.now() - k.t < SURE_MS) return k.v as T;
  const v = await getir();
  onbellek.set(anahtar, { t: Date.now(), v });
  return v;
}
```
