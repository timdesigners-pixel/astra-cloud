---
name: "logging"
description: "Стандарты логирования"
user-invocable: false
---

# Skill: Logging — Стандарты логирования

## Паттерны
- Сейчас логирования практически нет (1 `console.warn` в `kapi/gate.ts`); пустые `catch {}` допустимы только для best-effort (JSON.parse, localStorage, погода/курсы)
- Ошибки data-слоя пробрасываются (`if (error) throw error;`), в UI показываются через `hataMetni`
- Аудит входов — таблица `public.denetim` (Edge Function `pin-giris`); не дублировать в логах
- Vercel API/Edge Functions: логируй метод, путь, статус, тип ошибки; НЕ логируй тела запросов, токены, PIN, ключи, расшифрованные поля
- Язык сообщений логов — турецкий, как весь код
- Новый код: `console.warn`/`console.error` только для неожиданных состояний, не для потока управления

## Антипаттерны
- Логировать PIN, JWT, `GEMINI_API_KEY`, содержимое шифрованных полей, персональные данные
- Новые пустые `catch {}` для критичных операций (запись в БД)
- `console.log` отладочный в коммитах
- Проглатывание ошибки без сообщения пользователю

## Примеры
```js
// Vercel API: структурированная ошибка без тела запроса
catch (e) {
  const durum = e.durum && e.durum < 600 ? e.durum : 500;
  if (durum >= 500) console.error('[sohbet]', durum, e.message);
  gonder(res, durum, { error: e.message });
}
```
