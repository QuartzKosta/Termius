-- ============================================================
-- АШЕНОВ КОДЕКС — ФИКС ПРАВ ДЛЯ ТАБЛИЦ PLAYERS
-- БЕЗОПАСНО: не удаляет данные, только выдаёт права service_role
-- Запустите в Supabase Dashboard → SQL Editor
-- ============================================================
-- Симптом: POST /api/admin/players и /api/auth/login возвращают
--   { "error": "permission denied for table players" }
-- Причина: таблицы players / player_achievements созданы без
--   GRANT для роли service_role (под которой работает backend).
-- ============================================================

-- Права на таблицы (SELECT/INSERT/UPDATE/DELETE)
GRANT ALL ON TABLE players TO service_role;
GRANT ALL ON TABLE player_achievements TO service_role;

-- Права на последовательности (на случай если есть)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- (Опционально) те же права для anon/authenticated, если нужно
-- публичное чтение списка стражей (обычно НЕ нужно):
-- GRANT SELECT ON TABLE players TO anon;

-- Проверка: после выполнения следующий запрос должен вернуть
-- массив с двумя строками (players, player_achievements):
-- SELECT tablename, has_table_privilege('service_role', schemaname||'.'||tablename, 'SELECT') AS can_select
-- FROM pg_tables WHERE schemaname='public' AND tablename IN ('players','player_achievements');
