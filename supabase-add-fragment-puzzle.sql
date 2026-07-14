-- ============================================================
-- АШЕНОВ КОДЕКС — Добавление полей для fragment puzzle
-- Запустите в Supabase Dashboard → SQL Editor
-- БЕЗОПАСНО: только добавляет колонки, не удаляет данные
-- ============================================================

-- Fragment puzzle — отдельная головоломка для скрытого фрагмента в описании
-- (не зависит от основной puzzle_type/puzzle_data, которая используется для снятия печати)

ALTER TABLE npcs ADD COLUMN IF NOT EXISTS fragment_puzzle_type TEXT;
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS fragment_puzzle_data TEXT;
ALTER TABLE npcs ADD COLUMN IF NOT EXISTS fragment_puzzle_hint TEXT;

ALTER TABLE lore ADD COLUMN IF NOT EXISTS fragment_puzzle_type TEXT;
ALTER TABLE lore ADD COLUMN IF NOT EXISTS fragment_puzzle_data TEXT;
ALTER TABLE lore ADD COLUMN IF NOT EXISTS fragment_puzzle_hint TEXT;

ALTER TABLE rulers ADD COLUMN IF NOT EXISTS fragment_puzzle_type TEXT;
ALTER TABLE rulers ADD COLUMN IF NOT EXISTS fragment_puzzle_data TEXT;
ALTER TABLE rulers ADD COLUMN IF NOT EXISTS fragment_puzzle_hint TEXT;

-- Права для service_role (на случай если ещё не выданы)
GRANT ALL ON TABLE npcs TO service_role;
GRANT ALL ON TABLE lore TO service_role;
GRANT ALL ON TABLE rulers TO service_role;

-- Проверка:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'npcs' AND column_name LIKE 'fragment%';
