# EVENTS-PANEL-REDESIGN — work record

**Agent**: admin-events
**Task ID**: EVENTS-PANEL-REDESIGN
**File modified**: `src/app/admin/page.tsx`
**Component**: `EventsPanel` (function ~line 1016) and shared `styles` object
**Date**: 2025-06-25

## Goal
The EventsPanel admin control block was confusing: the user did not understand
what "ЧАС ВЕДЬМЫ" / "ВЗГЛЯД БОГА" actually do, and the action buttons
("👁 ОТКРЫТЬ ОКО +50%" / "👁 ЗАКРЫТЬ ОКО") were cryptic. Redesign the panel so
every section is explained, every control is labelled in plain language, and
the gaze actions offer both +25% and +50% increments plus a reset.

## Changes applied

### 1. `godCommand` — new command names (lines ~1043–1065)
Replaced the four-command signature with five clearer ones:

```ts
function godCommand(cmd: "wh_on" | "wh_off" | "gaze_25" | "gaze_50" | "gaze_reset")
```

| Old command | Old payload            | New command | New payload                                     |
|-------------|------------------------|-------------|-------------------------------------------------|
| `eye_open`  | `{open_eye, amount:50}`| `gaze_25`   | `{action:"open_eye", amount:25}`                |
| `eye_open`  | `{open_eye, amount:50}`| `gaze_50`   | `{action:"open_eye", amount:50}`                |
| `eye_close` | `{close_eye}`          | `gaze_reset`| `{action:"close_eye"}`                          |
| `wh_on`     | manual flag `true`     | `wh_on`     | manual flag `true` (unchanged)                  |
| `wh_off`    | manual flag `false`    | `wh_off`    | manual flag `false` (unchanged)                 |

The localStorage keys themselves (`ashen_gaze_cmd`, `ashen_witching_manual`)
and the JSON action names (`open_eye` / `close_eye`) are **unchanged** — only
the admin-side command names and flash toasts were cleaned up. Toasts also no
longer scream "ОКО" at the user; they say "ВЗГЛЯД УСИЛЕН +25%" etc.

### 2. EventsPanel JSX — explanatory description boxes (lines ~1074–1157)
Replaced the old single-row control block with two clearly-titled sections,
each preceded by an `eventsDesc` box that explains (in dim terminal-comment
prose) what the section does:

- **🌙 ЧАС ВЕДЬМЫ — НАСТРОЙКА РАСПИСАНИЯ** — the periodic-event schedule.
  Description: *«В заданное время у игрока растёт Взгляд Бога и появляется
  индикатор в statusbar. Можно включить по расписанию или вручную кнопкой ниже.»*
- **👁 ВЗГЛЯД БОГА — БЫСТРОЕ УПРАВЛЕНИЕ** — the quick-action buttons.
  Description: *«Чем больше игрок читает и решает, тем сильнее бог его замечает.
  При высоких значениях архив деградирует (помехи, виньетка, дрожь).»*

### 3. Relabelled schedule controls (no behaviour change)
- Checkbox: `ВКЛЮЧИТЬ ЧАС ВЕДЬМЫ` → **`Включить по расписанию`**
- `НАЧАЛО (ЧЧ:ММ)` → **`Начало (ЧЧ:ММ)`** (now side-by-side with Конец in a
  2-column `fieldRow` grid, mirroring the MAP X / MAP Y pattern)
- `КОНЕЦ (ЧЧ:ММ)` → **`Конец (ЧЧ:ММ)`** (same row)
- `ЧАСОВОЙ ПОЯС (UTC, напр. 3 = Москва)` → **`Часовой пояс (UTC+, напр. 3 = Москва)`**
- `МНОЖИТЕЛЬ ВЗГЛЯДА (% добавки)` → **`Усиление взгляда (% за срабатывание)`**
- `ЗАГОЛОВОК` → **`Заголовок индикатора`**
- `СООБЩЕНИЕ` → **`Текст сообщения (показывается в popup)`**

### 4. Two-row quick-controls (replaces the single `godRow`)
**Row 1 — Час Ведьмы (manual):**
- 🌙 `Включить сейчас` → `godCommand("wh_on")` — manual override
- `Выключить` → `godCommand("wh_off")`

**Row 2 — Взгляд Бога (instant):**
- `Усилить взгляд +25%` → `godCommand("gaze_25")`
- `Усилить взгляд +50%` → `godCommand("gaze_50")`
- `Сбросить взгляд` → `godCommand("gaze_reset")`

The 👁 emoji was removed from the gaze buttons (kept on the section title for
visual identity). Each row is followed by an `eventsHintLine` italic note
explaining what the row does, e.g.
`// мгновенно повышает или сбрасывает значение gaze (записывается в ashen_gaze_cmd)`.

### 5. Layout breathing room (styles object, ~lines 1228–1233)
- `eventsBody` — gap `4px` → `8px`; padding tightened to `14px 16px 20px`.
- `eventsSectionTitle` — marginTop `12px` → `16px`; marginBottom `6px` → `8px`.
- **New styles** added:
  - `eventsDesc` — dim `#5d685c`, 11px, 1.55 line-height, faint green left
    border (`#2c8a17`) on a near-black background — visually frames the
    explanatory text without competing with the controls.
  - `eventsDivider` — dashed `#2a2017` separator between the schedule and
    quick-controls sections (matches the fragment-puzzle convention).
  - `eventsHintLine` — small italic dim text immediately under each button row.
  - `quickRow` — `grid` with `repeat(auto-fit, minmax(120px, 1fr))` so the
    2-button and 3-button rows both lay out cleanly on narrow mobile widths.
- The unused `godRow` style key was left in place (harmless, no lint impact) to
  keep the diff minimal.

## Backward compatibility
- The localStorage wire format is **unchanged**: `ashen_gaze_cmd` still receives
  `{action:"open_eye", amount}` or `{action:"close_eye"}`, and
  `ashen_witching_manual` still receives `"true"`/`"false"`. The public
  `dnd-console.html` polls these keys exactly as before — no console-side change
  is required.
- `ashen_events_config_v2` (`WitchingConfig`) shape is unchanged.

## Validation
- `bun run lint` → **0 errors, 0 warnings**.
- `dev.log` shows continued `GET / 200` and admin API 200s; no compile/runtime
  regressions.

## Out of scope (deliberately not touched)
- `public/dnd-console.html` — the consumer side already handles
  `open_eye`/`close_eye`/manual witching; no changes needed there.
- The `wh_on`/`wh_off` payload behaviour — left identical to avoid breaking the
  console's manual-override polling loop.
- The unused `godRow` style key — left in place to minimize the diff; safe to
  remove in a future cleanup pass.
