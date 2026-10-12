---
name: "seed-data"
description: "Синтетические тестовые данные для Supabase и тестов"
triggers: [сид, seed, тестовые данные, наполни данными, фикстуры]
modes: [sequential]
capture: "none"
user_prompts: false
error_routing:
  agent_error: stop
  timeout: skip
phases:
  - id: 1
    name: SCHEMA_ANALYSIS
    agent: storage-architect
    inputs: [supabase/migrations/, skills/storage/SKILL.md, docs/KARAR-KAYDI.md]
    output: plans/{task-slug}-seed-plan.md
    gate: silent
  - id: 2
    name: GENERATE
    agent: node-developer
    inputs: [plans/{task-slug}-seed-plan.md, skills/code-style/SKILL.md]
    output: файлы кода
    gate: silent
agents:
  storage-architect:
    on_block: {action: stop}
  node-developer:
    on_block: {action: stop}
---

# Pipeline: Seed Data

Только синтетические данные (в README проекта: "Gerçek veri yok"). Реальные имена, IBAN, PIN, ключи недопустимы. Готовые данные кладутся в `packages/ortak-test/src/` (фабрики) и/или `supabase/seed.sql`; на облачную БД скрипт не выполняется автоматически.

### [sequential]

Phase 1: SCHEMA_ANALYSIS
Agent(.claude/agents/storage-architect.md, subagent_type: "general-purpose"):
  Вход: supabase/migrations/, .claude/skills/storage/SKILL.md, docs/KARAR-KAYDI.md, описание задачи
  Выход: .claude/output/plans/{task-slug}-seed-plan.md
  Ограничение: read-only
  Верни: summary (таблицы и порядок вставки с учётом FK, инварианты, объёмы, что шифруется через RPC)

Phase 2: GENERATE
Agent(.claude/agents/node-developer.md, subagent_type: "general-purpose"):
  Вход: .claude/output/plans/{task-slug}-seed-plan.md, .claude/skills/code-style/SKILL.md
  Выход: файлы кода (`packages/ortak-test/src/*`, при необходимости `supabase/seed.sql`)
  Ограничение: project-write
  Верни: summary (созданные файлы, как запускать, проверка `pnpm tip`)
