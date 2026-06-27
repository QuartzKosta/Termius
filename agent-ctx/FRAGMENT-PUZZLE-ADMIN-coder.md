# FRAGMENT-PUZZLE-ADMIN — work record

**Agent**: coder
**Task ID**: FRAGMENT-PUZZLE-ADMIN
**File modified**: `src/app/admin/page.tsx`
**Date**: 2025-06-25

## Goal
Extend the ASHEN CODEX admin panel to manage a **second, independent puzzle system per record** — the *fragment puzzle* (`fragment_puzzle_type`, `fragment_puzzle_data`, `fragment_puzzle_hint`) — used to decrypt `[[HIDDEN:...]]` spans inside the record description. The main puzzle (`puzzle_*`) is preserved unchanged and used only for unlocking the record itself.

## Changes applied

### 1. `ArchiveRecord` interface (lines 37–45)
Added the three new optional fields right after the main puzzle fields, with a clarifying comment:
```ts
// Fragment puzzle (decrypts [[HIDDEN:...]] inside description; record must be unlocked first)
fragment_puzzle_type?: string | null;
fragment_puzzle_data?: string | null;
fragment_puzzle_hint?: string | null;
```

### 2. `UploadForm` component
- **State** — added `fragmentPuzzleType` (default `"none"`), `fragmentPuzzleHint`, `fragmentPuzzleData`.
- **Submit handler** — added a separate `fragmentPuzzleDataParsed: unknown = null` local; JSON-parses `fragmentPuzzleData` if non-empty (with its own try/catch returning the localized error `"fragment_puzzle_data: неверный JSON"`).
- **Request body** to `POST /api/admin/upload` — added three new keys after `puzzle_data`:
  - `fragment_puzzle_type: fragmentPuzzleType`
  - `fragment_puzzle_hint: fragmentPuzzleHint.trim() || null`
  - `fragment_puzzle_data: fragmentPuzzleDataParsed`
- **UI** — after the existing "ДАННЫЕ ГОЛОВОЛОМКИ (JSON)" textarea, inserted a dashed `#2a2017` separator, an amber `VT323` header `🔓 ГОЛОВОЛОМКА СКРЫТОГО ФРАГМЕНТА`, an explanatory `//`-prefixed note (wrapped in `{}` to satisfy `react/jsx-no-comment-textnodes`), and three new fields in the same order as the main puzzle: Type select / Hint input / Data textarea. The select reuses the existing `PUZZLE_TYPES` array.

### 3. `EditModal` component
- **State** — added three `useState` calls pre-filled from the loaded record:
  - `fragmentPuzzleType` ← `rec.fragment_puzzle_type || "none"`
  - `fragmentPuzzleHint` ← `rec.fragment_puzzle_hint || ""`
  - `fragmentPuzzleData` ← `stringifyMaybe(rec.fragment_puzzle_data)` (reuses the existing helper so stored JSON is pretty-printed for editing).
- **Submit handler** — same `fragmentPuzzleDataParsed` JSON-parse guard as UploadForm, and the request body to `POST /api/admin/edit` carries the three new keys.
- **UI** — identical visual block (separator + amber header + `//` note + Type/Hint/Data fields) inserted after the main puzzle data textarea and before "СЛОВО-ОСКОЛОК".

## Styling notes
- Used the same `styles.input`, `styles.select`, `styles.fieldLabel` as the main puzzle so the new section visually matches the rest of the form.
- The dashed separator uses an inline `borderTop: "1px dashed #2a2017"` because the codebase has no shared `separator` style — keeping the change local avoids touching the shared `styles` object.
- Amber accent color `#e8a13a` and `VT323` font for the section header make the fragment puzzle visually distinct from the main puzzle (which uses the green terminal palette).

## Validation
- `bun run lint` → 0 errors, 0 warnings (after fixing two `react/jsx-no-comment-textnodes` errors by wrapping the `// ...` note text in `{}`).
- Dev server log (`dev.log`) shows continued successful responses from `/api/admin/list`, `/api/admin/players`, `/api/admin/login` — no compile/runtime regressions introduced.

## Out of scope (deliberately not touched)
- Backend routes `/api/admin/upload` and `/api/admin/edit` — already accept the three new fields per the task description.
- `src/lib/supabase.ts` `ArchiveRecord` type — already has these fields.
- Public-facing record display and the actual `[[HIDDEN:...]]` decryption logic — that belongs to a separate fragment-puzzle-consumer task.
