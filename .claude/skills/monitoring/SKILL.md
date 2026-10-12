---
name: "monitoring"
description: "Паттерны мониторинга и метрик"
user-invocable: false
---

# Skill: Monitoring — Паттерны мониторинга и метрик

## Паттерны
- Сейчас мониторинга нет (ни Sentry, ни Vercel Analytics); наблюдаемость: Vercel deployment/runtime logs, Supabase logs (`supabase functions logs`, advisors)
- Аудит: `public.denetim` (входы, блокировки PIN); статус ключей здоровья — `saglik_anahtarlari.son_sonuc` / `kullanim_sayisi`
- Health-проверка: Edge Function/endpoint без чувствительных данных; ответ минимальный
- Метрики предлагать с учётом приватности (single-tenant, персональные финансовые данные): без PII в событиях
- Rate-limit `/api/*` in-memory per-instance (`SOHBET_HIZ`, `MARKET_HIZ`) — для точных метрик нужен внешний счётчик
- Любая новая зависимость (Sentry и т.п.) — через decision и `docs/KARAR-KAYDI.md`

## Антипаттерны
- Отправка финансовых данных или PII в сторонние сервисы мониторинга
- Алерты без порога и владельца
- Опора на in-memory счётчики как на глобальные метрики

## Примеры
| Что | Источник | Как смотреть |
|-----|----------|--------------|
| Ошибки API | Vercel runtime logs | дашборд Vercel / `vercel logs` |
| Edge Functions | Supabase logs | `supabase functions logs pin-giris` |
| Входы PIN | таблица `denetim` | SQL-запрос владельцем |
| Здоровье | `saglik_anahtarlari` | `son_sonuc`, `kullanim_sayisi` |
