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

-- Если таблиц ещё нет — создайте их (безопасно, IF NOT EXISTS):
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warden_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, achievement_id)
);

-- RLS: публичное чтение, запись только через service_role (bypass RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_players" ON players;
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_pa" ON player_achievements;
CREATE POLICY "public_read_pa" ON player_achievements FOR SELECT USING (true);

-- Повторно выдать права после создания
GRANT ALL ON TABLE players TO service_role;
GRANT ALL ON TABLE player_achievements TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Проверка: после выполнения следующий запрос должен вернуть
-- массив с двумя строками (players, player_achievements):
-- SELECT tablename, has_table_privilege('service_role', schemaname||'.'||tablename, 'SELECT') AS can_select
-- FROM pg_tables WHERE schemaname='public' AND tablename IN ('players','player_achievements');
