---
name: "full-feature"
description: "Полный цикл фичи: код + API docs + QA docs"
triggers: [полный цикл, feature, от начала до конца, фулл]
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
  - id: 7
    name: API_DOCS
    needs: [6]
    condition: has_api_endpoints
    gate: silent
  - id: 8
    name: QA_DOCS
    needs: [7]
    condition: has_api_endpoints
    gate: silent
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
    phases: [4, 7]
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
  qa-engineer:
    phases: [8]
    condition: has_api_endpoints
    input: [contracts/{module}.md, source code]
    output: qa/{module}-checklist.md
---

### [team]

# Phase 1: ANALYSIS
Agent(name="analyst")
  → SendMessage(to="main", summary="done + spec path", message="done + spec path")
Gate: review

# Phase 2: ARCHITECTURE
Agent(name="{lang}-architect")
  → SendMessage(to="main", summary="done + plan path", message="done + plan path")
Gate: review

# Phase 3: STORAGE (если has_db)
# (если has_db)
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

# Phase 7: API_DOCS (если has_api_endpoints, reuse {lang}-developer)
# {lang}-developer переиспользуется из Phase 4 через SendMessage — контекст сохраняется
# Lead направляет developer на Phase 7:
  Lead → SendMessage(to="{lang}-developer", summary="Phase 7: API_DOCS", message="Phase 7: API_DOCS. Сгенерируй контракты.")
  {lang}-developer → SendMessage(to="main", summary="done + contracts path", message="done + contracts path")
Gate: silent

# Phase 8: QA_DOCS (если has_api_endpoints)
# Lead спавнит qa-engineer после Phase 7 gate:
Agent(name="qa-engineer")
  → SendMessage(to="main", summary="done + checklist path", message="done + checklist path")
Gate: silent
