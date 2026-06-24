-- ============================================================
-- АШЕНОВ КОДЕКС v6.0 — ПОЛНАЯ ПЕРЕУСТАНОВКА БД
-- Запустите в Supabase Dashboard → SQL Editor
-- ВНИМАНИЕ: УДАЛЯЕТ ВСЕ ДАННЫЕ И СОЗДАЁТ ЗАНОВО
-- ============================================================

-- ===== УДАЛЕНИЕ ВСЕХ ТАБЛИЦ =====
DROP TABLE IF EXISTS player_achievements CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS npcs CASCADE;
DROP TABLE IF EXISTS lore CASCADE;
DROP TABLE IF EXISTS rulers CASCADE;

-- ===== СОЗДАНИЕ ТАБЛИЦ =====

-- Игроки (Wardens)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warden_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Достижения игроков
CREATE TABLE player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(player_id, achievement_id)
);

-- НПС
CREATE TABLE npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'NPC',
  title TEXT,
  description TEXT,
  image_url TEXT,
  sigil TEXT DEFAULT 'i-skull',
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  puzzle_type TEXT,
  puzzle_data TEXT,
  puzzle_hint TEXT,
  shard_word TEXT,
  prophecy_bonus_text TEXT,
  prophecy_date DATE,
  map_x REAL,
  map_y REAL,
  custom_trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ЛОР
CREATE TABLE lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'LORE',
  title TEXT,
  description TEXT,
  image_url TEXT,
  sigil TEXT DEFAULT 'i-flame',
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  puzzle_type TEXT,
  puzzle_data TEXT,
  puzzle_hint TEXT,
  shard_word TEXT,
  prophecy_bonus_text TEXT,
  prophecy_date DATE,
  map_x REAL,
  map_y REAL,
  custom_trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ПРАВИТЕЛИ
CREATE TABLE rulers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'RULER',
  title TEXT,
  description TEXT,
  image_url TEXT,
  sigil TEXT DEFAULT 'i-crown',
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  puzzle_type TEXT,
  puzzle_data TEXT,
  puzzle_hint TEXT,
  shard_word TEXT,
  prophecy_bonus_text TEXT,
  prophecy_date DATE,
  map_x REAL,
  map_y REAL,
  custom_trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===== ROW LEVEL SECURITY =====

-- Players: публичное чтение (нужно для проверки имени при логине),
-- запись только через service_role (bypass RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_players" ON players;
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);

-- Player achievements: публичное чтение (нужно для отображения),
-- запись только через service_role
ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_pa" ON player_achievements;
CREATE POLICY "public_read_pa" ON player_achievements FOR SELECT USING (true);

-- Архивные таблицы: публичное чтение
ALTER TABLE npcs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_npcs" ON npcs;
CREATE POLICY "public_read_npcs" ON npcs FOR SELECT USING (true);

ALTER TABLE lore ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_lore" ON lore;
CREATE POLICY "public_read_lore" ON lore FOR SELECT USING (true);

ALTER TABLE rulers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_rulers" ON rulers;
CREATE POLICY "public_read_rulers" ON rulers FOR SELECT USING (true);

-- ВАЖНО: INSERT / UPDATE / DELETE требуют service_role key,
-- который используется ТОЛЬКО на сервере (API routes).
-- Анонимный ключ не может писать в таблицы — это нормально.

-- ===== СИД-ДАННЫЕ =====

-- НПС (открытые)
INSERT INTO npcs (name, category, title, description, sigil, is_locked) VALUES
('Каэлен Пепельный', 'НЕЖИТЬ', '// павший паладин, последний из Огненной Клятвы',
 'Некогда рыцарь Огненной Клятвы, Каэлен въехал в Пепельное Болото, чтобы похоронить мёртвого бога — и не вернулся человеком. Его доспех всё ещё тлеет; его голос — хор умирающих свечей.',
 'i-skull', FALSE),
('Моурвен Пустой', 'ДЬЯВОЛ', '// гонец Утопленного Хора',
 'Безликая тварь, что торгует секретами вдоль чернильных рек. Он носит голоса тех, кого поглотил, и не торгуется ничем, кроме загадок.',
 'i-eye', FALSE),
('Сестра Исольда', 'ГУМАНОИД', '// изгнанная жрица-пиявка',
 'Она вытягивает яд из ран поцелуем и угольком. Орден изгнал её за то, что она лечила тех, кого Болото уже забрало.',
 'i-flame', FALSE),
('Васска, Свернутое Слово', 'АБЕРРАЦИЯ', '// змей-бог, угасший',
 'Некогда бог клятв, ныне умирающее нечто, свернувшееся под разрушенным храмом Ваэла. Он говорит только контрактами.',
 'i-serpent', FALSE),
('Царь-Уголь', 'НЕЖИТЬ', '// последний монарх Пепельного Престола',
 'Он правил, когда бог ещё жил. Когда тот умер, он отказался. Корона приварена к черепу.',
 'i-crown', FALSE),
('Часовой', 'КОНСТРУКТ', '// страж Последних Часов',
 'Существо из латуни и кости, что ведёт часы, отсчитывающие время до окончательной смерти бога.',
 'i-hourglass', FALSE);

-- НПС с головоломками
INSERT INTO npcs (name, category, title, description, sigil, is_locked, puzzle_type, puzzle_data, puzzle_hint) VALUES
('[ДАННЫЕ ПОВРЕЖДЕНЫ]', 'НЕИЗВЕСТНО', '// обозначение невосстановимо',
 'Некто ████████ шёл по ██████████ до того, как ████████ пал. Не ████████ его имя.',
 'i-err', TRUE, 'keyword', '{"answer":"пепел"}',
 'То, что остаётся от клятвы, когда угасает последняя искра.'),
('[О__Л Р____Т]', 'НЕИЗВЕСТНО', '// фрагмент отвергнут печатью',
 'Запись отказалась быть зафиксированной.',
 'i-err', TRUE, 'tumbler', '{"symbols":["ᚠ","ᚢ","ᚦ","ᚨ","ᚱ","ᚲ"],"correct":["ᚨ","ᚱ","ᚦ"]}',
 'Три руны: бог, путь, терние.'),
('Велиал Безмолвный', 'ДЬЯВОЛ', '// архивариус забытых имён',
 'Демон-хранитель истинных имён.',
 'i-eye', TRUE, 'constellation',
 '{"nodes":[{"x":15,"y":25,"id":"eye"},{"x":45,"y":15,"id":"crown"},{"x":75,"y":35,"id":"flame"},{"x":35,"y":70,"id":"serpent"},{"x":65,"y":80,"id":"tail"}],"order":["eye","crown","flame"]}',
 'Соедини Око, Корону и Пламя.');

-- Фрагменты (осколки)
INSERT INTO npcs (name, category, title, description, sigil, is_locked, shard_word) VALUES
('Странник Пепельных Дорог', 'СТРАННИК', '// несёт первое слово',
 'Он бродит по краю Болога, повторяя одно слово.', 'i-eye', FALSE, 'ПЕПЕЛ'),
('Хранитель Угасающих Имен', 'АРХИВАРИУС', '// хранит второе слово',
 'В подвалах разрушенного храма он записывает имена.', 'i-hourglass', FALSE, 'ПОМНИТ'),
('Слепая Пророчица', 'ПРОВИДЦА', '// знает третье слово',
 'Она ослепла, глядя на мёртвого бога.', 'i-flame', FALSE, 'ИМЯ'),
('Пепельный Менестрель', 'БАРД', '// поёт четвёртое слово',
 'Он поёт балладу о падении бога.', 'i-skull', FALSE, 'БОГА'),
('Последний Свидетель', 'ПРИЗРАК', '// принёс пятое слово',
 'Он был там, когда бог умирал.', 'i-ritual', FALSE, 'ОСВОБОДИ');

-- ЛОР
INSERT INTO lore (name, category, title, description, sigil, is_locked) VALUES
('Пепельное Болото', 'ГЕОГРАФИЯ', '// Фрагмент 01',
 'Там, где упало тело мёртвого бога, земля превратилась в стекло.', 'i-flame', FALSE),
('Огненная Клятва', 'ОБЕТ', '// Фрагмент 02',
 'Клятва, произнесённая над тёплым угольком из уст умирающего святого.', 'i-skull', FALSE),
('Утопленный Хор', 'ПАКТ', '// Фрагмент 04',
 'Сделка, заключённая на дне чёрного озера.', 'i-eye', FALSE),
('Орден Стражей', 'ФРАКЦИЯ', '// Фрагмент 06',
 'Поклявшиеся каталогизировать, никогда не вмешиваться.', 'i-hourglass', FALSE);

INSERT INTO lore (name, category, title, description, sigil, is_locked, puzzle_type, puzzle_data, puzzle_hint) VALUES
('[ СЕДЬМАЯ ПЕЧАТЬ ]', 'ОПЕЧАТАНО', '// Фрагмент 03',
 'Это не дверь. Это ████████.', 'i-ritual', TRUE, 'alchemy',
 '{"ingredients":["🜂","🜄","🜁","🜃","☿"],"correct_recipe":["🜃","🜄","☿"]}',
 'Земля, Вода, Ртуть — в этом порядке.'),
('[ ДАННЫЕ ПОВРЕЖДЕНЫ ]', 'ПОВРЕЖДЕНО', '// Фрагмент 05',
 '0x4E53', 'i-err', TRUE, 'circuit', '{"solution":[0,1,2,5,8]}',
 'Поток маны от левого верхнего к правому нижнему.'),
('Разрушение', 'ЕРЕСЬ', '// Фрагмент 07',
 'Его не убили. Его не завершили.', 'i-god', TRUE, 'runes',
 '{"sequence":["🜂","🜃","🜁","🜄"],"options":["🜂","ᚦ","🜃","ᚱ"],"correct":"🜃"}',
 'Стихии по кругу. Какой не хватает?'),
('[ОКОНЧАТЕЛЬНОЕ ОТКРОВЕНИЕ]', 'МЕТА-ТАЙНА', '// последняя печать',
 'Соберите все осколки и произнесите фразу.', 'i-god', TRUE, 'meta',
 '{"answer":"ПЕПЕЛ ПОМНИТ ИМЯ БОГА ОСВОБОДИ"}',
 'Соберите пять слов из пяти записей-фрагментов.');

-- ПРАВИТЕЛИ
INSERT INTO rulers (name, category, title, description, sigil, is_locked) VALUES
('Царь-Уголь', 'НЕЖИТЬ', '// последний монарх', 'Корона приварена к черепу.', 'i-crown', FALSE),
('Васска, Свернутое Слово', 'АБЕРРАЦИЯ', '// змей-бог', 'Древнее существо в глубинах.', 'i-serpent', FALSE),
('Бледный Регент', 'ДЬЯВОЛ', '// распорядитель', 'Нечто из пергамента и иссохшего дыхания.', 'i-crown', FALSE),
('Нулевой Страж', 'НЕБЕСНЫЙ', '// первый смерть записавший', 'Стал первым, что уничтожила смерть бога.', 'i-eye', FALSE);

INSERT INTO rulers (name, category, title, description, sigil, is_locked, puzzle_type, puzzle_data, puzzle_hint) VALUES
('Имр-Сот, Незавершённый', 'МЁРТВЫЙ БОГ', '// похороненный бог',
 'Его не убили. Его не завершили.', 'i-god', TRUE, 'keyword',
 '{"answer":"тишина"}', 'Какую клятву мёртвые не могут нарушить?');

-- ===== ТЕСТОВЫЙ ИГРОК =====
-- Пароль: shadow (хеш SHA-256 от "shadow|ashen_codex_salt")
-- Мастер создаст игроков через админку, но этот для теста
-- Чтобы создать — открой админку → WARDENS → введи имя и пароль

-- ===== ПРОВЕРКА =====
SELECT '✅ ПОЛНАЯ ПЕРЕУСТАНОВКА ЗАВЕРШЕНА' AS status,
       (SELECT COUNT(*) FROM npcs) AS npcs,
       (SELECT COUNT(*) FROM lore) AS lore,
       (SELECT COUNT(*) FROM rulers) AS rulers;

-- ===== ПРАВА ДЛЯ SERVICE_ROLE =====
GRANT ALL ON players TO service_role;
GRANT ALL ON player_achievements TO service_role;
GRANT ALL ON npcs TO service_role;
GRANT ALL ON lore TO service_role;
GRANT ALL ON rulers TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
