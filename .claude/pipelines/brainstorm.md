---
name: "brainstorm"
description: "Мозговой штурм: анализ идеи с нескольких ракурсов"
triggers: [обсудим, идея, brainstorm, брейншторм, побрейнштормим, как лучше, варианты, подход, продумать, предложи]
modes: [sequential, team]
capture: partial
user_prompts: true
phases:
  - id: 1
    name: FRAME
    needs: []
    gate: review
    artifact: plans/{task-slug}-frame.md
  - id: 2
    name: PERSPECTIVES
    needs: [1]
    gate: review
    artifact: plans/{task-slug}-options.md
  - id: 3
    name: DECISION
    needs: [2]
    gate: confirm
    agent: lead
agents:
  analyst:
    phases: [1, 2]
    input: [description, memory/facts.md, memory/decisions/]
    output: plans/{task-slug}-frame.md
  "{lang}-architect":
    phases: [2]
    after: [analyst, storage-architect, devops]
    input: [plans/{task-slug}-frame.md]
    output: plans/{task-slug}-options.md
    notify: lead
  storage-architect:
    phases: [2]
    condition: has_storage
    input: [plans/{task-slug}-frame.md]
    notify: "{lang}-architect"
  devops:
    phases: [2]
    condition: has_devops_agent
    input: [plans/{task-slug}-frame.md]
    notify: "{lang}-architect"
---

### [team]

# Phase 1: FRAME
Agent(name="analyst")
  → SendMessage(to="main", summary="done + frame path", message="done + frame path")
Gate: review
# analyst переиспользуется в Phase 2 через SendMessage — контекст сохраняется

# Phase 2: PERSPECTIVES (parallel)
SendMessage(to="analyst", summary="phase 2 perspectives", message="Phase 2: PERSPECTIVES — дай perspective по frame, результат отправь {lang}-architect")  # reuse from Phase 1
# (если .claude/agents/storage-architect.md существует И has_storage)
Agent(name="storage-architect")
# (если .claude/agents/devops.md существует)
Agent(name="devops")
Agent(name="{lang}-architect")
  # after chain: architect ждёт ТОЛЬКО спавненных агентов.
  # Если storage-architect/devops не спавнены (condition=false) — пропускаются в after list.
  analyst → SendMessage(to="{lang}-architect", summary="perspective", message="perspective")
  storage-architect (если спавнен) → SendMessage(to="{lang}-architect", summary="perspective", message="perspective")
  devops (если спавнен) → SendMessage(to="{lang}-architect", summary="perspective", message="perspective")
  {lang}-architect: consolidate все полученные perspectives → SendMessage(to="main", summary="options path", message="options path")
Gate: review

# Phase 3: DECISION (lead inline)
# Lead консолидирует результаты, формирует финальное решение
Gate: confirm
