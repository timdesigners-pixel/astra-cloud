---
name: "notifications"
description: "Паттерны отправки уведомлений"
user-invocable: false
---

# Skill: Notifications — Паттерны отправки уведомлений

## Паттерны
- Центр уведомлений: `veri/bildirim.ts` (`bildirimUret` — чистая функция генерации из данных: платежи, сроки, лимиты) + UI `bildirim-merkezi.ts`
- Тосты: `bildir(metin, geriAl?, hata?)` из `ortak/bildirim`; undo-тост "Geri al" 8 с после мягкого удаления
- Ошибки пользователю — через `hataMetni(e)` (турецкие сообщения)
- Браузерные уведомления: отправленные помечаются в `localStorage` (чтобы не дублировать), доступ в `try {} catch {}`
- Внешней отправки (email/SMS/push-сервера) нет; Gmail API работает в браузере в модуле E-posta
- Время и сроки считаются в Europe/Istanbul (`ortak/zaman.ts`)

## Антипаттерны
- Генерация уведомлений внутри UI-кода вместо чистой `bildirimUret` (не тестируется)
- Показ технических ошибок (`error.message` Postgres) пользователю в сыром виде
- Повторная отправка одного и того же браузерного уведомления
- Секреты/токены API в тексте уведомлений

## Примеры
```ts
try {
  await kisiSil(k.id);
  bildir('Kişi silindi.', () => kisiGeriAl(k.id));
} catch (e) {
  bildir(hataMetni(e), undefined, true);
}
```
