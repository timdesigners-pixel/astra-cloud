---
name: "pipeline"
description: "Роутер — классифицирует задачу и запускает нужный pipeline"
user-invocable: true
argument-hint: "[описание задачи]"
---

> **CRITICAL: Имя директории `skills/pipeline/` и файл frontmatter КОПИРОВАТЬ AS-IS.
> НЕ переименовывать в routing/, router/, или другое.
> Имя директории = имя slash-команды `/pipeline`. Изменение = система НЕ РАБОТАЕТ.**

# Pipeline — Единый роутер v9

Ты — оркестратор. Единый вход для всех операций с кодом.
Два режима: **тупой диспетчер** (sequential) и **lead команды** (team).

---

## Фаза 0: Роутинг

### Шаг 0 — Resume detection

Проверь `.claude/output/state/` — есть ли файлы `*.json`.

Если найден ровно один state файл:
```
AskUserQuestion:
  question: "Найден незавершённый pipeline: {pipeline} ({task-slug}). Завершено {completed}/{total} фаз."
  options:
    - {label: "Продолжить", description: "Возобновить с фазы {next}"}
    - {label: "Заново", description: "Удалить state и начать с нуля"}
    - {label: "Отменить", description: "Ничего не делать"}
```
→ "Продолжить": выполни Resume Protocol (см. секцию ниже)
→ "Заново": удали state файл, продолжай роутинг как обычно
→ "Отменить": ОСТАНОВИСЬ

Если найдено несколько state файлов:
```
AskUserQuestion:
  question: "Найдено несколько незавершённых pipeline-ов:"
  options: {динамически: список pipeline-ов из state файлов + "Начать новый" + "Отменить"}
```

Если state файлов нет — продолжай роутинг.

**Cleanup старых state:** при каждом старте удали completed/failed state файлы (keep latest per pipeline).

### Шаг 1 — Контекст
1. Прочитай `.claude/memory/facts.md`
2. Проверь `.claude/memory/decisions/` — релевантные решения

### Шаг 1.5 — Парсинг флагов
Если `$ARGUMENTS` содержит `--no-analysis` или `--skip-analyst`:
- Установи `SKIP_ANALYSIS=true`
- Удали флаг из `$ARGUMENTS` перед классификацией

### Шаг 2 — Классификация
Проанализируй аргумент `$ARGUMENTS` и определи тип:

| Intent | Триггеры |
|--------|----------|
| **NEW-CODE** | новый, добавь, создай, фича, модуль, эндпоинт |
| **FIX-CODE** | баг, ошибка, fix, не работает, сломалось, regression |
| **REVIEW** | ревью, проверь, review, посмотри код |
| **TESTS** | тесты, покрытие, unit test, coverage |
| **API-DOCS** | документация, api docs, контракт |
| **QA-DOCS** | чеклист, QA, postman |
| **FULL-FEATURE** | полный цикл, feature, от начала до конца |
| **BRAINSTORM** | обсудим, идея, brainstorm, брейншторм, побрейнштормим, как лучше, варианты, подход, продумать, предложи |
| **FREE** | вопрос, обсуждение, объясни, помоги |
| **DEPLOY** | деплой, выкатить, релиз, deploy, release, выложить |
| **SEED-DATA** | сид, seed, тестовые данные, наполни данными, фикстуры |
| **GENERATE-TYPES** | сгенерируй типы, generate types, типы из схемы, обнови типы |
| **MIGRATION** | миграция, migration, схема БД, alter table, новая таблица |

Приоритет: FULL-FEATURE > явное имя > keyword > спросить.
Если FREE — ответь напрямую, без pipeline.

Если неоднозначно:
```
AskUserQuestion:
  question: "Не удалось определить тип задачи. Какой pipeline запустить?"
  options:
    - {label: "new-code", description: "Новый модуль, сервис, эндпоинт"}
    - {label: "fix-code", description: "Баг, ошибка, regression"}
    - {label: "review", description: "Ревью кода"}
    - {label: "tests", description: "Написание тестов"}
    - {label: "full-feature", description: "Полный цикл фичи"}
    - {label: "api-docs", description: "API-контракты"}
    - {label: "qa-docs", description: "QA-чеклисты, Postman"}
    - {label: "brainstorm", description: "Мозговой штурм, анализ вариантов"}
    - {label: "deploy", description: "Деплой: проверки, миграции, Vercel, Edge Functions"}
    - {label: "seed-data", description: "Синтетические тестовые данные"}
    - {label: "generate-types", description: "Типы TS из схемы Supabase"}
    - {label: "migration", description: "SQL-миграция Supabase"}
```

### Шаг 3 — Подтверждение

```
AskUserQuestion:
  question: "[PIPELINE: {TYPE}] {краткое описание задачи}\nПодтвердить?"
  options:
    - {label: "Да", description: "Запустить pipeline"}
    - {label: "Уточнить", description: "Скорректировать задачу или сменить pipeline"}
    - {label: "Отменить", description: "Не запускать"}
```

### Шаг 3.5 — Выбор режима

Прочитай `.claude/pipelines/{type}.md`. Если `modes` содержит `team`:

1. `ToolSearch(query: "select:SendMessage", max_results: 1)` — проверка доступности Agent Teams
2. SendMessage не найден → режим = sequential, не спрашивай
3. Найден:
```
AskUserQuestion:
  question: "Режим выполнения?"
  options:
    - {label: "Sequential", description: "Фазы по порядку, тупой диспетчер"}
    - {label: "Team", description: "Команда агентов, параллельная работа"}
```

Если `modes: [sequential]` — режим = sequential, не спрашивай.

### Шаг 3.6 — Контекст задачи

Для NEW-CODE / FULL-FEATURE — пропустить (аналитик разберётся).

Для FIX-CODE:
```
AskUserQuestion:
  question: "Тип проблемы?"
  options:
    - {label: "Runtime error", description: "Ошибка при выполнении"}
    - {label: "Logic bug", description: "Неверная бизнес-логика"}
    - {label: "Data issue", description: "Проблема с данными"}
    - {label: "Performance", description: "Медленная работа"}
```

Для TESTS:
```
AskUserQuestion:
  question: "Тип тестов?"
  options:
    - {label: "Unit", description: "Unit-тесты для классов/функций"}
    - {label: "Integration", description: "Интеграционные тесты"}
    - {label: "Coverage gap", description: "Покрыть непокрытые участки"}
```

Для REVIEW / API-DOCS / QA-DOCS / BRAINSTORM — без дополнительных вопросов.

### Шаг 4 — Диспатч

Прочитай `.claude/pipelines/{type}.md` frontmatter и выполни по протоколам ниже.

---

## Протокол: TaskList из phases[]

**ОБЯЗАТЕЛЬНО** перед началом выполнения фаз.

1. Прочитай `phases[]` из frontmatter pipeline
2. Для каждой фазы:
   ```
   TaskCreate(subject: "{phase.name} — {краткий заголовок}", description: "{что делает фаза: вход, выход}", activeForm: "Выполняется {phase.name}")
   ```
3. Установи зависимости из `needs[]`:
   ```
   TaskUpdate(task_id, addBlockedBy: [needs task IDs])
   ```
4. Conditional фазы (`condition:`) — создать задачу СРАЗУ. Если condition = false при выполнении:
   ```
   TaskUpdate(task_id, status: completed, subject: "{phase.name} (skipped)")
   ```

---

## Протокол: Variable Resolution

### {lang}
Источник: `.claude/memory/facts.md` → `languages: [php, typescript, ...]`
- Single-lang: `{lang}` = единственный язык
- Multi-lang: per-lang агенты параллельно (sequential: `||`, team: отдельные Agent())
- Если languages нет → AskUserQuestion: "Какой язык проекта?"
- **Если languages > 3:** AskUserQuestion: "Обработать все {N} языков параллельно или batch по 3?"

### {task-slug}
`slugify(описание задачи, max 40 chars)` — lowercase, дефисы вместо пробелов.

---

## Протокол: Condition Resolution

Conditions в `phases[].condition` и `agents{}.condition` — только identifiers, НЕ prose.

| Condition | Как проверить |
|-----------|--------------|
| `has_db` | `database/` directory exists OR facts.md `storage:` содержит db/postgres/mysql/sqlite |
| `has_storage` | facts.md `storage:` не пустой |
| `has_devops_agent` | `.claude/agents/devops.md` exists |
| `has_api_endpoints` | facts.md `api:` не пустой OR `contracts/` directory exists |

**Unknown condition** → AskUserQuestion: "Условие `{condition}` — выполнять фазу {phase.name}?"

Phase condition = запускать ли фазу. Agent condition = спавнить ли агента (team mode).

---

## Протокол: Sequential Mode

Роутер = **тупой диспетчер**. Не принимает решений, не интерпретирует.

Для каждой фазы по порядку `needs` DAG:

1. **TaskUpdate** task → `in_progress`
2. Проверить `condition:` (Condition Resolution). Если false → TaskUpdate → completed (skipped), next.
3. **Найти агентов** — `agents{}` где `phases` содержит текущую фазу. Если несколько агентов на одну фазу — запустить параллельно (`||` нотация).
4. Если `agent: lead` — выполнить фазу inline (без Agent()), перейти к шагу 7.
5. **Запустить Agent():**
   ```
   Agent(.claude/agents/{agent}.md):
     Вход: {agent.input}
     Выход: {agent.output}
     Ограничение: {из роли агента — read-only для analyst/reviewer, project-write для developer}
     Верни: summary + путь к артефакту
   ```
6. **Multi-lang параллельность:** `||` = несколько Agent() в одном сообщении (параллельные Agent tool calls).
7. **Gate** (Gate Protocol).
8. **On Block** — если reviewer вернул BLOCK (On Block Protocol).
9. **TaskUpdate** task → `completed`.
10. **State update** → обновить `.claude/output/state/{pipeline}-{task-slug}.json`.

---

## Протокол: Team Mode

Роутер = **lead команды**. Следуй 5 правилам lead'а (ниже).

Team имплицитный: создавать/удалять команду не нужно. `Agent(name=...)` делает агента адресуемым по имени через SendMessage. Lead для агентов — получатель `main`.

### Старт
1. Прочитай `### [team]` секцию pipeline body

### Выполнение
Для каждой фазы из `### [team]`:

1. **TaskUpdate** task → `in_progress`
2. Проверить `condition:`. Если false → skip.
3. **Спавнить агентов** для этой фазы:
   ```
   Agent(name="{agent}", prompt="""
   Прочитай .claude/agents/{agent}.md — выполняй workflow.
   ЗАДАНИЕ: {phase.name} для задачи {task-slug}.
   Вход: {agent.input}
   Результат запиши: {agent.output}
   TEAM MODE: не вызывай AskUserQuestion — он недоступен. Если нужен ввод пользователя — запиши данные в `.claude/output/interaction-{task-slug}.json` и SendMessage(to="main", summary="interaction required", message="interaction_required: путь к файлу"); жди ответ lead'а.
   SendMessage(to="{agent.notify}", summary="done", message="done + путь к результату").
   """)
   ```
   `notify: lead` в frontmatter → получатель `"main"`.
4. Агенты без `after:` → стартуют сразу
5. Агенты с `after:` → ждут SendMessage от after-агента. **Если after-агент не спавнен (condition=false) — убрать из after list.** Агент стартует когда все ЖИВЫЕ after-agents отправили done.
6. `notify: lead` → фаза завершена
7. **Gate** (Gate Protocol)
8. **On Block** — reviewer BLOCK → SendMessage(to="developer", summary="fix required", message="feedback") → developer fix → SendMessage(to="reviewer", summary="fixed", message="исправлено")
9. **TaskUpdate** task → `completed`

### Завершение
Агенты завершаются сами по окончании задачи — shutdown и удаление команды не нужны. Reuse агента в следующей фазе — `SendMessage(to="{agent}")` с новым заданием (контекст сохраняется).

---

## Протокол: Gate

### gate: review
1. Прочитай `{phase.artifact}`
2. Покажи содержимое пользователю
3. ```
   AskUserQuestion:
     question: "Ревью артефакта {artifact}."
     options:
       - {label: "Подтвердить", description: "Продолжить pipeline"}
       - {label: "Повторить", description: "Указать правки и перезапустить фазу"}
       - {label: "Отменить", description: "Остановить pipeline"}
   ```
4. "Повторить" → AskUserQuestion "Что изменить?" → перезапуск фазы с feedback
5. "Отменить" → stop pipeline

### gate: confirm
```
AskUserQuestion:
  question: "Продолжить pipeline?"
  options:
    - {label: "Продолжить", description: "Следующая фаза"}
    - {label: "Стоп", description: "Остановить pipeline"}
```

### gate: silent
Без остановки. Продолжить.

### Autonomous mode (user_prompts: false)
- review → auto-confirm
- confirm → auto-confirm
- Эскалация только при ошибках

---

## Протокол: On Block (Sequential)

Применяется когда reviewer возвращает verdict BLOCK.

1. Прочитай output artifact reviewer-а
2. Найди `## Verdict: PASS|BLOCK` (+ список замечаний)
3. Если **PASS** → продолжить
4. Если **BLOCK:**
   ```
   retries += 1
   if retries > on_block.max_retries:
     → Autonomous mode: accept with warnings, log в state.json, секция "Unresolved blocks" в финальный отчёт
     → Interactive mode: AskUserQuestion: "Принять с warnings / Стоп"
   else:
     Agent(on_block.target) с input: [original_input, reviewer_comments]
     Agent(reviewer) заново → goto 1
   ```

В Team mode: lead SendMessage(to="developer", summary="fix required", message="feedback") → developer fix → SendMessage(to="reviewer", summary="fixed", message="исправлено"). Тот же retry counter.

---

## Протокол: Team Fallback

1. **SendMessage не найден** (шаг 3.5) → режим sequential, без вопроса.
2. **Agent(name=...) spawn fail на первой фазе** → `state.mode = "sequential"`. AskUserQuestion: "Team mode недоступен. Продолжить в sequential?". Продолжить через Agent() по frontmatter phases[].
3. **Agent spawn fail mid-pipeline** → завершить текущую фазу через Agent() без name. Оставшиеся фазы — sequential.
4. **НЕ возвращаться в team mode** после fallback.
5. Уже завершённые team-фазы — валидны, не переделывать.

---

## Протокол: Resume

### Из state.json
1. Прочитай state.json → найди первую фазу status != "completed"

### Sequential mode resume
1. Запустить Agent() для текущей фазы
2. Агент читает артефакты предыдущих фаз (на диске)

### Team mode resume
1. Спавнить агентов для текущей фазы заново (старые агенты завершились сами)
2. Агенты перечитают артефакты предыдущих фаз с диска
3. **Продолжить В TEAM MODE**

Артефакты = стейт. Агенты stateless, файлы persistent.

---

## Протокол: Error Handling

1. Проверить `error_routing` из frontmatter pipeline
2. Если есть mapping для ошибки:

| Action | Поведение |
|--------|-----------|
| `retry_current` | Перезапуск текущей фазы |
| `stop` | AskUserQuestion с описанием ошибки |
| `skip` | Пропустить фазу, продолжить |
| `{max_retries: N, action: X}` | Retry N раз, потом action |

3. Если нет mapping → AskUserQuestion: "Повторить / Пропустить / Стоп"

### Canonical error types
`test_fail | review_block | agent_error | timeout`

---

## Протокол: State

### State file: `.claude/output/state/{pipeline}-{task-slug}.json`

```json
{
  "pipeline": "{name}",
  "task": "{task-slug}",
  "mode": "sequential|team",
  "started_at": "{ISO 8601}",
  "phases": {
    "1": {"name": "ANALYSIS", "status": "pending"},
    "2": {"name": "ARCHITECTURE", "status": "in_progress"},
    "3": {"name": "STORAGE", "status": "completed", "completed_at": "..."}
  }
}
```

### Lifecycle
- Создаётся роутером при старте pipeline (после TaskList)
- Обновляется после каждой фазы
- При завершении: `status: "done"`
- При ошибке: `status: "failed"` + `error`
- Cleanup: keep latest per pipeline при следующем запуске

---

## Протокол: Capture

Исполняется **роутером сам**, inline — без субагентов (никаких Agent()). После последней фазы, до финального отчёта.

Уровень берётся из `capture:` в frontmatter pipeline. Если `none` — пропусти.

**Общие правила:**
- Перед добавлением записи в любой файл — прочитай существующий, ищи аналогичную. НЕ ДУБЛИРУЙ — обновляй существующую.
- Если создал новый файл в `decisions/` — добавь строку в `.claude/memory/MEMORY.md` (если индекс существует).
- Все шаги обязательны для своего уровня. Если данных по шагу нет — пропусти этот шаг, не выдумывай.

### capture: full

Применяется к pipeline-ам с архитектурной фазой (new-code, full-feature).

1. **`.claude/memory/facts.md`** — обнови по секциям:
   - `## Stack` — ЗАМЕНИ целиком, **только** если стек изменился по итогам задачи (новая зависимость, новая БД, новый язык).
   - `## Key Paths` — МЕРЖ: добавь новые пути, удали несуществующие.
   - `## Active Decisions` — ЗАМЕНИ списком ссылок на актуальные файлы `decisions/*.md` (НЕ archive).
   - `## Known Issues` — максимум 10 записей, удали разрешённые.
   - `## Last Updated` — дата задачи + slug.
2. **`.claude/memory/decisions/{YYYY-MM-DD}-{task-slug}.md`** — создай, **если** в pipeline была фаза с `gate: review` (ARCHITECTURE/ANALYSIS) и решение архитектурно-значимо. Шаблон:
   ```
   # Decision: {title}
   **Date:** {YYYY-MM-DD}
   **Status:** active
   **Pipeline:** {pipeline}/{task-slug}

   ## Context
   ## Decision
   ## Alternatives
   ## Consequences
   ```
   НЕ создавай decision для тривиальной задачи (один сервис, прямолинейная имплементация).
3. **`.claude/memory/patterns.md`** — добавь запись в секции `Naming`/`Architecture`/`Error Handling`, **если** в задаче появился новый повторяющийся паттерн (минимум 2 применения в коде задачи или явное закрепление в decision).

### capture: partial

Применяется к pipeline-ам без архитектурной фазы (fix-code, brainstorm).

1. **`.claude/memory/facts.md`**:
   - `## Key Paths` — МЕРЖ.
   - `## Known Issues` — добавь запись о баге и фиксе (лимит 10, удали resolved).
   - `## Last Updated` — дата + slug.
2. **`.claude/memory/issues.md`** — добавь строку в таблицу: `Date | Issue | Frequency | Resolution`. Если такой Issue уже есть — увеличь `Frequency`, обнови `Resolution`, не дублируй строку. Лимит таблицы 30 строк (правила в `skills/memory/SKILL.md`).
3. **`.claude/memory/patterns.md`** — добавь запись в `Error Handling`/`Anti-patterns`, если выявлен антипаттерн.

### capture: review

Применяется к review pipeline.

1. **`.claude/memory/facts.md`** → `## Known Issues` — добавь только recurring (replied >=2 раза в reviewer-output), лимит 10.
2. **`.claude/memory/issues.md`** — добавь recurring issues из ревью.
3. **`.claude/memory/patterns.md`** — добавь антипаттерны, выявленные ревьюером.

### Если memory-каталога нет

Если `.claude/memory/` отсутствует — пропусти capture полностью, выведи в финальный отчёт строку `Capture: skipped (no memory/)`. Не создавай каталог сам — это решение bootstrap-конфигурации проекта.

---

## Протокол: Финализация

1. Все фазы completed → state.status = "done"
2. **Выполни Протокол: Capture** (если `capture` != `none`)
3. Финальный отчёт пользователю:
   - Что сделано (per-phase summary)
   - Созданные/изменённые файлы
   - Что зафиксировано в memory (список путей: facts/decisions/patterns/issues — что обновлено)
   - Если были unresolved blocks (autonomous mode) — вывести warnings
4. State file остаётся для reference (cleanup при следующем запуске)

---

## 5 правил lead'а (Team mode)

1. **МОЛЧИ** — только финальный отчёт, эскалации, ответы на прямые вопросы
2. **НЕ вмешивайся** — не собирай данные за агентов. Только ссылки и slug'и
3. **Делегация** — агенты автономны в рамках фазы. Lead координирует, не исполняет
4. **Строгие гейты** — NOT OK = retry или эскалация. Не пропускай BLOCK
5. **Подпинывание** — если агент молчит, SendMessage с напоминанием. Не отвечает → эскалация
