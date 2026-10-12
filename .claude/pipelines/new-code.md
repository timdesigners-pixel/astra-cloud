---
name: "new-code"
description: "Полный цикл создания нового кода"
triggers: [новый, добавь, создай, фича, модуль, эндпоинт]
modes: [sequential, team]
capture: full
user_prompts: true
error_routing:
  test_fail: {max_retries: 2, action: stop}
  review_block: retry_current
phases:
  - id: 1
    name: ANALYSIS
    needs: []
    gate: review
    artifact: plans/{task-slug}-spec.md
  - id: 2
    name: ARCHITECTURE
    needs: [1]
    gate: review
    artifact: plans/{task-slug}.md
  - id: 3
    name: STORAGE
    needs: [2]
    condition: has_db
    gate: silent
  - id: 4
    name: CODE
    needs: [2]
    gate: silent
  - id: 5
    name: TESTS
    needs: [4]
    gate: silent
  - id: 6
    name: REVIEW
    needs: [5]
    gate: confirm
    artifact: reviews/{task-slug}-{lang}.md
agents:
  analyst:
    phases: [1]
    input: [description, memory/facts.md, memory/decisions/, database/schema.sql]
    output: plans/{task-slug}-spec.md
  "{lang}-architect":
    phases: [2]
    input: [plans/{task-slug}-spec.md, skills/architecture/SKILL.md]
    output: plans/{task-slug}.md
  storage-architect:
    phases: [3]
    condition: has_db
    input: [plans/{task-slug}.md, skills/storage/SKILL.md, database/schema.sql]
    output: migrations
  "{lang}-developer":
    phases: [4]
    input: [plans/{task-slug}.md, skills/code-style/SKILL.md]
    output: plans/{task-slug}-impl-{lang}.md
    notify: "{lang}-test-developer"
  "{lang}-test-developer":
    phases: [5]
    after: "{lang}-developer"
    input: [plans/{task-slug}-impl-{lang}.md, skills/testing/SKILL.md]
    output: plans/{task-slug}-tests-{lang}.md
    notify: "{lang}-reviewer"
  "{lang}-reviewer":
    phases: [6]
    after: "{lang}-test-developer"
    input: [git diff, skills/code-style/SKILL.md]
    output: reviews/{task-slug}-{lang}.md
    notify: lead
    on_block:
      target: "{lang}-developer"
      max_retries: 2
---

### [team]

# Phase 1: ANALYSIS
Agent(name="analyst")
  → SendMessage(to="main", summary="done + path to spec", message="done + path to spec")
Gate: review

# Phase 2: ARCHITECTURE
Agent(name="{lang}-architect")
  → SendMessage(to="main", summary="done + path to plan", message="done + path to plan")
Gate: review

# Phase 3: STORAGE (если has_db)
# (если .claude/agents/storage-architect.md существует И has_db)
Agent(name="storage-architect")
  → SendMessage(to="main", summary="done", message="done")
Gate: silent

# Phase 4-6: CODE → TESTS → REVIEW (per-lang)
Agent(name="{lang}-developer")
Agent(name="{lang}-test-developer")
Agent(name="{lang}-reviewer")
  {lang}-developer → SendMessage(to="{lang}-test-developer", summary="done + impl path", message="done + impl path")
  {lang}-test-developer → SendMessage(to="{lang}-reviewer", summary="done + tests path", message="done + tests path")
  {lang}-reviewer: BLOCK → SendMessage(to="{lang}-developer", summary="fix + comments", message="fix + comments")
                   PASS → SendMessage(to="main", summary="verdict + review path", message="verdict + review path")
Gate: confirm
