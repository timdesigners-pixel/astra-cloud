---
name: "deploy"
description: "Деплой: проверки, миграции Supabase, Edge Functions, Vercel"
triggers: [деплой, выкатить, релиз, deploy, release, выложить]
modes: [sequential]
capture: "none"
user_prompts: true
error_routing:
  agent_error: stop
  timeout: skip
phases:
  - id: 1
    name: PREFLIGHT
    agent: devops
    inputs: [.github/workflows/ci.yml, package.json, supabase/migrations/, supabase/functions/]
    output: plans/{task-slug}-deploy-plan.md
    gate: review
  - id: 2
    name: RUNBOOK
    agent: devops
    inputs: [plans/{task-slug}-deploy-plan.md, README.md]
    output: plans/{task-slug}-runbook.md
    gate: confirm
agents:
  devops:
    on_block: {action: stop}
---

# Pipeline: Deploy

Деплой в проекте ручной (фронт и `/api` — Vercel Git-интеграция; БД и Edge Functions — Supabase CLI/дашборд). Pipeline готовит и проверяет план, но НЕ применяет миграции и НЕ деплоит на облако самостоятельно — выполняет человек по runbook.

### [sequential]

Phase 1: PREFLIGHT
Agent(.claude/agents/devops.md, subagent_type: "general-purpose"):
  Вход: .github/workflows/ci.yml, package.json, supabase/migrations/ (новые относительно последнего деплоя), supabase/functions/, apps/web/vercel.json, .env.example, git diff от последнего релиза
  Выход: .claude/output/plans/{task-slug}-deploy-plan.md
  Ограничение: read-only (запусти `pnpm tip` и `pnpm build`, ничего не публикуй)
  Верни: summary (результат tsc/build, список новых миграций и функций, нужные env/secrets, риски)
Gate: review

Phase 2: RUNBOOK
Agent(.claude/agents/devops.md, subagent_type: "general-purpose"):
  Вход: .claude/output/plans/{task-slug}-deploy-plan.md, README.md (раздел деплоя)
  Выход: .claude/output/plans/{task-slug}-runbook.md
  Ограничение: read-only
  Верни: summary (шаги по порядку: миграции -> Edge Functions -> secrets -> Vercel env -> проверка; команды для верификации и отката)
Gate: confirm
