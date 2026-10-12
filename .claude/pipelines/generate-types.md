---
name: "generate-types"
description: "Генерация и синхронизация TypeScript-типов из схемы Supabase"
triggers: [сгенерируй типы, generate types, типы из схемы, обнови типы]
modes: [sequential]
capture: "none"
user_prompts: false
error_routing:
  agent_error: stop
  timeout: skip
phases:
  - id: 1
    name: SCHEMA_DIFF
    agent: storage-architect
    inputs: [supabase/migrations/, apps/web/src/veri/, skills/storage/SKILL.md]
    output: plans/{task-slug}-types-diff.md
    gate: silent
  - id: 2
    name: GENERATE
    agent: node-developer
    inputs: [plans/{task-slug}-types-diff.md, skills/code-style/SKILL.md]
    output: файлы кода
    gate: silent
  - id: 3
    name: REVIEW
    agent: node-reviewer
    inputs: [git diff, skills/code-style/SKILL.md]
    output: reviews/{task-slug}-types.md
    gate: silent
agents:
  storage-architect:
    on_block: {action: stop}
  node-developer:
    on_block: {action: stop}
  node-reviewer:
    on_block: {action: stop}
---

# Pipeline: Generate Types

Типы данных в проекте зеркалят колонки БД 1:1 (snake_case, `type` alias). Pipeline находит расхождения между схемой миграций и TS-типами в `apps/web/src/veri/` и приводит типы в соответствие. Пакет `packages/sema` задуман для схем и типов.

### [sequential]

Phase 1: SCHEMA_DIFF
Agent(.claude/agents/storage-architect.md, subagent_type: "general-purpose"):
  Вход: supabase/migrations/, apps/web/src/veri/ (типы и константы `KOLON`), .claude/skills/storage/SKILL.md
  Выход: .claude/output/plans/{task-slug}-types-diff.md
  Ограничение: read-only
  Верни: summary (таблицы/RPC, где типы расходятся со схемой; список колонок; nullable-поля)

Phase 2: GENERATE
Agent(.claude/agents/node-developer.md, subagent_type: "general-purpose"):
  Вход: .claude/output/plans/{task-slug}-types-diff.md, .claude/skills/code-style/SKILL.md
  Выход: файлы кода (типы в `apps/web/src/veri/*.ts` или `packages/sema/src/`)
  Ограничение: project-write
  Верни: summary (изменённые типы; `pnpm tip` без ошибок)

Phase 3: REVIEW
Agent(.claude/agents/node-reviewer.md, subagent_type: "general-purpose"):
  Вход: git diff, .claude/skills/code-style/SKILL.md
  Выход: .claude/output/reviews/{task-slug}-types.md
  Ограничение: read-only
  Верни: summary (verdict PASS|BLOCK, замечания)
