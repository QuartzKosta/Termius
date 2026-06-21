-- ============================================================
-- ASHEN CODEX — Library of Alexandria schema
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ---------- npcs table ----------
CREATE TABLE IF NOT EXISTS npcs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'NPC',
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  sigil       TEXT DEFAULT 'i-skull',
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- lore table ----------
CREATE TABLE IF NOT EXISTS lore (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'LORE',
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  sigil       TEXT DEFAULT 'i-flame',
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- rulers table ----------
CREATE TABLE IF NOT EXISTS rulers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'RULER',
  title       TEXT,
  description TEXT,
  image_url   TEXT,
  sigil       TEXT DEFAULT 'i-crown',
  is_locked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Row Level Security ----------
ALTER TABLE npcs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lore   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rulers ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (idempotent)
DROP POLICY IF EXISTS "public_read_npcs"   ON npcs;
DROP POLICY IF EXISTS "public_read_lore"   ON lore;
DROP POLICY IF EXISTS "public_read_rulers" ON rulers;

-- Public can read all records (anon key works)
CREATE POLICY "public_read_npcs"   ON npcs   FOR SELECT USING (true);
CREATE POLICY "public_read_lore"   ON lore   FOR SELECT USING (true);
CREATE POLICY "public_read_rulers" ON rulers FOR SELECT USING (true);

-- Note: INSERT / UPDATE / DELETE are only possible with the service_role key
-- (which bypasses RLS entirely). No extra policies needed for admin writes.

-- ============================================================
-- SEED DATA — initial lore from the ASHEN CODEX archives
-- ============================================================

-- ---- NPCs ----
INSERT INTO npcs (name, category, title, description, sigil, is_locked) VALUES
('Kaelen Ashbringer', 'UNDEAD', '// the Fallen Paladin, Last of the Ember Vow',
 'Once a knight of the Ember Vow, Kaelen rode into the Ashen Mire to bury a dead god — and never returned as a man. His armor still smolders; his voice is a choir of dying candles. He guards the Seventh Seal and bargains in memories, not gold.',
 'i-skull', FALSE),
('Mourven the Hollow', 'FIEND', '// courier of the Drowned Choir',
 'A faceless thing that trades in secrets along the ink-rivers. It wears the voices of those it has swallowed and refuses to bargain in anything but riddles. Mirewen owes it three answers and has only given two.',
 'i-eye', FALSE),
('Sister Ysolde', 'HUMANOID', '// exiled leech-priest, Domain of Ash',
 'She pulls poison from wounds with a kiss and a coal. The Order cast her out for healing those the Mire had already claimed. She will tend the party — but every life she saves, the Mire remembers.',
 'i-flame', FALSE),
('Vasska, the Coiled Word', 'ABERRATION', '// serpent-god, diminished',
 'Once a god of oaths, now a dying thing coiled beneath the ruined temple of Vael. It speaks only in contracts. Those who answer its riddle are bound; those who refuse are digested slowly, over years, in dreams.',
 'i-serpent', FALSE),
('The Cinder-King', 'UNDEAD', '// last monarch of the Ashen Throne',
 'He ruled when the god still lived. When it died, he refused to. Now he sits a throne of fused glass, crown welded to skull, issuing decrees to a court of ash. He remembers the party''s names from a war they have not yet fought.',
 'i-crown', FALSE),
('The Hour-Keeper', 'CONSTRUCT', '// warden of the Last Clock',
 'A being of brass and bone that tends the clock which counts down to the god''s final death. It will not fight unless the clock is touched. It answers three questions per visitor, and lies on the third.',
 'i-hourglass', FALSE),
('[DATA CORRUPTED]', 'UNKNOWN', '// designation unrecoverable',
 NULL,
 'i-err', TRUE),
('[S__L R____D]', 'UNKNOWN', '// fragment refused by seal',
 NULL,
 'i-err', TRUE);

-- ---- LORE ----
INSERT INTO lore (name, category, title, description, sigil, is_locked) VALUES
('The Ashen Mire', 'GEOGRAPHY', '// Fragment 01 / 07',
 'Where the dead god''s body fell, the soil turned to glass and the rivers to ink. Travelers who linger too long begin to hum a song they cannot name — and then to forget their own.',
 'i-flame', FALSE),
('The Ember Vow', 'OATH', '// Fragment 02 / 07',
 'An oath sworn upon a still-warm coal taken from a dying saint''s mouth. To break it is to become a candle that burns others. Kaelen Ashbringer is its most famous — and last — keeper.',
 'i-skull', FALSE),
('[ THE SEVENTH SEAL ]', 'SEALED', '// Fragment 03 / 07',
 'It is not a door. It is a [CENSORED]. Those who open it do not pass through — they [CENSORED]. The Warden is forbidden to render its true shape.',
 'i-ritual', TRUE),
('The Drowned Choir', 'PACT', '// Fragment 04 / 07',
 'A pact-bargain struck at the bottom of a black lake. The patron sings in the voices of those it has swallowed. Mirewen hears three of them clearly. The fourth is learning her voice.',
 'i-eye', FALSE),
('[ DATA CORRUPTED ]', 'CORRUPTED', '// Fragment 05 / 07',
 'The [CENSORED] that walks without [CENSORED] cannot be [CENSORED]. To read further is to invite it. 0x4E53',
 'i-err', TRUE),
('The Warden Order', 'FACTION', '// Fragment 06 / 07',
 'Sworn to catalogue, never to intervene. We record the dying of the world in neat rows so that whatever comes after will know exactly how it ended. This console is one of seven. We are the last wardens still warm.',
 'i-hourglass', FALSE),
('The Unmaking', 'HERESY', '// Fragment 07 / 07',
 'It was not killed. It was unfinished. The gods of the old pact could not destroy what was already half-real, so they buried it in the Mire and called the burial a death. They were wrong. It dreams downward, and the dream is the corruption in your seal.',
 'i-god', FALSE);

-- ---- RULERS ----
INSERT INTO rulers (name, category, title, description, sigil, is_locked) VALUES
('The Cinder-King', 'UNDEAD RULER', '// last monarch of the Ashen Throne',
 'He ruled when the god still lived. When it died, he refused to. Now he sits a throne of fused glass, crown welded to skull, issuing decrees to a court of ash. He remembers the party''s names from a war they have not yet fought.',
 'i-crown', FALSE),
('Vasska, the Coiled Word', 'ABERRATION', '// serpent-god, diminished',
 'Once a god of oaths, now a dying thing coiled beneath the ruined temple of Vael. It speaks only in contracts. Those who answer its riddle are bound; those who refuse are digested slowly, over years, in dreams.',
 'i-serpent', FALSE),
('The Sallow Regent', 'FIEND', '// steward of the First Decay',
 'A noble of the court that buried the dead god, now a thing of parchment and dried breath. It refused to be recorded because to be recorded is to be remembered, and to be remembered is to be answerable.',
 'i-crown', FALSE),
('Ymr-Soth, the Unmade', 'DEAD GOD', '// the buried god',
 'It was not killed. It was unfinished. The gods of the old pact could not destroy what was already half-real, so they buried it in the Mire and called the burial a death. They were wrong. It dreams downward.',
 'i-god', TRUE),
('The Zeroth Warden', 'CELESTIAL', '// the one who recorded the first death',
 'Before the god died, there was a Warden assigned to record its death. They completed the record early — the god had not yet finished dying — and so became the first thing the god''s death unmade. They persist only as a footnote in their own journal, which is this console.',
 'i-eye', FALSE);
