---
name: "migration"
description: "SQL-миграция Supabase: проектирование, написание, ревью"
triggers: [миграция, migration, схема БД, alter table, новая таблица]
modes: [sequential]
capture: "partial"
user_prompts: true
error_routing:
  agent_error: stop
  timeout: skip
phases:
  - id: 1
    name: DESIGN
    agent: migration-manager
    inputs: [supabase/migrations/, skills/storage/SKILL.md, docs/KARAR-KAYDI.md]
    output: plans/{task-slug}-migration.md
    gate: review
  - id: 2
    name: WRITE
    agent: storage-architect
    inputs: [plans/{task-slug}-migration.md, skills/storage/SKILL.md]
    output: файлы миграции
    gate: silent
  - id: 3
    name: REVIEW
    agent: node-reviewer
    inputs: [git diff, skills/storage/SKILL.md]
    output: reviews/{task-slug}-migration.md
    gate: confirm
agents:
  migration-manager:
    on_block: {action: stop}
  storage-architect:
    on_block: {action: stop}
  node-reviewer:
    on_block: {action: stop}
---

# Pipeline: Migration

Миграции только forward, применяются вручную (`supabase db push` / дашборд) ДО выкладки кода, который их использует. Pipeline не применяет миграцию на облачный проект.

### [sequential]

Phase 1: DESIGN
Agent(.claude/agents/migration-manager.md, subagent_type: "general-purpose"):
  Вход: описание задачи, supabase/migrations/, .claude/skills/storage/SKILL.md, docs/KARAR-KAYDI.md
  Выход: .claude/output/plans/{task-slug}-migration.md
  Ограничение: read-only
  Верни: summary (следующий номер, затронутые таблицы/RPC, RLS/GRANT, риски, проверочные запросы)
Gate: review

Phase 2: WRITE
Agent(.claude/agents/storage-architect.md, subagent_type: "general-purpose"):
  Вход: .claude/output/plans/{task-slug}-migration.md, .claude/skills/storage/SKILL.md
  Выход: `supabase/migrations/NNNN_<turkish_snake>.sql`
  Ограничение: project-write (только каталог supabase/migrations/)
  Верни: summary (файл, объекты БД, порядок применения)

Phase 3: REVIEW
Agent(.claude/agents/node-reviewer.md, subagent_type: "general-purpose"):
  Вход: git diff, .claude/skills/storage/SKILL.md
  Выход: .claude/output/reviews/{task-slug}-migration.md
  Ограничение: read-only
  Верни: summary (verdict PASS|BLOCK; проверка RLS, grants, `search_path`, инвариантов KARAR-KAYDI)
Gate: confirm
