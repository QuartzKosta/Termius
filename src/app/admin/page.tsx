"use client";

import { useState, useEffect, useCallback } from "react";

/* ============================================================
   ASHEN CODEX — Расширенная Админ-Панель  (/admin)
   Этапы 11 (РАСШИРЕННАЯ АДМИНКА) + 12 (EVENTS PANEL).
   Dark-fantasy CRT terminal aesthetic. Password-gated.
   ------------------------------------------------------------
   API contract (existing routes):
   - GET  /api/admin/login              → checks session
   - POST /api/admin/login {password}   → sets cookie
   - DELETE /api/admin/login            → clears cookie
   - GET  /api/admin/list?type=all      → {data:{npcs,lore,rulers}}
   - POST /api/admin/upload {type,...}  → create (basic fields saved;
                                          extended fields sent for forward-compat)
   - POST /api/admin/toggle {type,id}   → flips is_locked server-side
   - POST /api/admin/edit   {type,id,...} → update record
   - POST /api/admin/delete {type,id}     → delete record
   - GET  /api/admin/players            → {data:[{id,warden_name,created_at,achievements:[]}]}
   - POST /api/admin/players            → create / reset_password / reset_achievements / delete
   ============================================================ */

type RecordType = "npcs" | "lore" | "rulers";
type TabKey = RecordType | "wardens" | "states";

interface ArchiveRecord {
  id: string;
  name: string;
  category: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  sigil: string | null;
  is_locked: boolean;
  created_at: string | null;
  // Extended fields (present when DB has them; null otherwise)
  puzzle_type?: string | null;
  puzzle_data?: string | null;
  puzzle_hint?: string | null;
  // Fragment puzzle (decrypts [[HIDDEN:...]] inside description; record must be unlocked first)
  fragment_puzzle_type?: string | null;
  fragment_puzzle_data?: string | null;
  fragment_puzzle_hint?: string | null;
  shard_word?: string | null;
  prophecy_bonus_text?: string | null;
  map_x?: number | null;
  map_y?: number | null;
  custom_trigger?: string | null;
}
type AllData = { npcs: ArchiveRecord[]; lore: ArchiveRecord[]; rulers: ArchiveRecord[] };

const TABS: { key: TabKey; label: string }[] = [
  { key: "npcs", label: "NPC" },
  { key: "lore", label: "LORE" },
  { key: "rulers", label: "RULERS" },
  { key: "states", label: "ГОСУДАРСТВА" },
  { key: "wardens", label: "WARDENS" },
];

const SIGILS = ["i-skull", "i-eye", "i-serpent", "i-crown", "i-flame", "i-hourglass", "i-ritual", "i-god"];
const PUZZLE_TYPES = ["none", "keyword", "tumbler", "constellation", "alchemy", "circuit", "runes", "sliding", "g2048", "memory", "maze", "fragment", "meta"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => setAuthed(r.ok))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      setAuthed(true);
      setPw("");
    } else {
      const j = await res.json().catch(() => ({}));
      setLoginErr(j.error || "ДОСТУП ЗАПРЕЩЁН");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  if (checking) {
    return (
      <div style={styles.shell}>
        <div style={styles.boot}>ПРОВЕРКА СИГНАТА СТРАЖА…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={styles.shell}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <div style={styles.loginGlyph}>⚠</div>
          <h1 style={styles.loginTitle}>ДОСТУП СТРАЖА</h1>
          <p style={styles.loginSub}>{"// введите сигил, чтобы открыть архив"}</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="ШИФР"
            autoFocus
            style={styles.input}
          />
          {loginErr && <div style={styles.err}>{loginErr}</div>}
          <button type="submit" style={styles.btn}>ВОЙТИ</button>
        </form>
      </div>
    );
  }

  return <AdminPanel onLogout={handleLogout} />;
}

/* ============================================================
   ADMIN PANEL — main dashboard
   ============================================================ */
function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AllData>({ npcs: [], lore: [], rulers: [] });
  const [wardenCount, setWardenCount] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("npcs");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<{ rec: ArchiveRecord; type: RecordType } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/list?type=all");
      if (!res.ok) {
        setErr("Не удалось загрузить — сессия могла истечь.");
        return;
      }
      const j = await res.json();
      setData(j.data || { npcs: [], lore: [], rulers: [] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWardenCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/players");
      if (!res.ok) { setWardenCount(null); return; }
      const j = await res.json();
      const arr = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      setWardenCount(arr.length);
    } catch {
      setWardenCount(null);
    }
  }, []);

  useEffect(() => {
    load();
    loadWardenCount();
  }, [load, loadWardenCount]);

  async function toggleLock(type: RecordType, id: string, currentLocked: boolean) {
    // Optimistic flip
    setData((d) => ({
      ...d,
      [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: !currentLocked } : r)),
    }));
    try {
      // Backend flips is_locked server-side; we send {type, id} only.
      const res = await fetch("/api/admin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "переключение не удалось");
        // Revert
        setData((d) => ({
          ...d,
          [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: currentLocked } : r)),
        }));
      } else {
        flash(currentLocked ? "ОТПЕЧАТАНО" : "ОПЕЧАТАНО");
      }
    } catch {
      flash("сетевая ошибка");
      setData((d) => ({
        ...d,
        [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: currentLocked } : r)),
      }));
    }
  }

  async function deleteRecord(type: RecordType, id: string) {
    if (!window.confirm("Удалить эту запись навсегда?")) return;
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "УДАЛЕНИЕ НЕ УДАЛОСЬ");
        return;
      }
      flash("ЗАПИСЬ УДАЛЕНА");
      load();
    } catch {
      flash("сетевая ошибка");
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  const isWardens = tab === "wardens";
  const isStates = tab === "states";
  const records = isWardens || isStates ? [] : data[tab as RecordType];
  const lockedCount = records.filter((r) => r.is_locked).length;

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.headerDot} />
          АШЕНОВ КОДЕКС <span style={{ color: "#4af626" }}>{"// СТРАЖ"}</span>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>ВЫХОД</button>
      </header>

      <EventsPanel flash={flash} />

      <nav style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setShowUpload(false);
            }}
            style={{
              ...styles.tab,
              ...(tab === t.key ? styles.tabActive : {}),
            }}
          >
            {t.label}
            <span style={styles.tabCount}>
              {t.key === "wardens"
                ? (wardenCount === null ? "—" : wardenCount)
                : t.key === "states"
                ? "◆"
                : data[t.key as RecordType].length}
            </span>
          </button>
        ))}
      </nav>

      {isWardens ? (
        <WardensPanel flash={flash} onChanged={loadWardenCount} />
      ) : isStates ? (
        <StatesPanel flash={flash} />
      ) : (
        <>
          <div style={styles.subHeader}>
            <span style={{ color: "#5d685c" }}>
              {records.length}{" записей // "}{lockedCount}{" опечатано"}
            </span>
            <button onClick={() => setShowUpload((s) => !s)} style={styles.uploadToggle}>
              {showUpload ? "× ЗАКРЫТЬ" : "+ НОВАЯ ЗАПИСЬ"}
            </button>
          </div>

          {showUpload && (
            <UploadForm
              type={tab as RecordType}
              onDone={() => {
                setShowUpload(false);
                load();
              }}
              flash={flash}
            />
          )}

          {err && <div style={{ ...styles.err, margin: "12px 16px", maxWidth: "none" }}>{err}</div>}

          <div style={styles.listWrap}>
            {loading ? (
              <div style={styles.empty}>ЗАГРУЗКА АРХИВА…</div>
            ) : records.length === 0 ? (
              <div style={styles.empty}>
                {"// нет записей в "}{tab}{"."}
                <br />
                {"// нажмите \"+ НОВАЯ ЗАПИСЬ\"."}
              </div>
            ) : (
              records.map((r) => (
                <RecordCard
                  key={r.id}
                  rec={r}
                  onToggle={() => toggleLock(tab as RecordType, r.id, r.is_locked)}
                  onEdit={() => setEditing({ rec: r, type: tab as RecordType })}
                  onDelete={() => deleteRecord(tab as RecordType, r.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      <button onClick={load} style={styles.refreshBtn}>↻ ОБНОВИТЬ АРХИВ</button>

      {editing && (
        <EditModal
          rec={editing.rec}
          type={editing.type}
          onClose={() => setEditing(null)}
          onSaved={load}
          flash={flash}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

/* ============================================================
   STATES PANEL — diplomatic matrix + alliance web
   ============================================================ */
interface StateRow {
  id: string;
  name: string;
  sigil: string | null;
  color: string | null;
  description: string | null;
  category: string | null;
  isLocked: boolean;
}

interface StateRowAdmin extends StateRow {
  createdAt: string;
  updatedAt: string;
}

interface RelationRow {
  id: string;
  stateAId: string;
  stateBId: string;
  stateA: { id: string; name: string; sigil: string | null; color: string | null };
  stateB: { id: string; name: string; sigil: string | null; color: string | null };
  relationshipType: string;
  description: string | null;
  treatyDate: string | null;
}

const RELATIONSHIP_TYPES: { value: string; label: string; color: string }[] = [
  { value: "alliance", label: "🤝 СОЮЗ", color: "#4af626" },
  { value: "war", label: "⚔️ ВОЙНА", color: "#ff2424" },
  { value: "pact", label: "📜 ПАКТ", color: "#3fd6c8" },
  { value: "rivalry", label: "💀 ВРАЖДА", color: "#e8a13a" },
  { value: "neutral", label: "⚖️ НЕЙТРАЛ", color: "#888888" },
  { value: "vassal", label: "🛡️ ВАССАЛ", color: "#a78bfa" },
  { value: "trade", label: "💰 ТОРГОВЛЯ", color: "#fbbf24" },
];

const STATE_CATEGORIES = [
  "ИМПЕРИЯ",
  "КОРОЛЕВСТВО",
  "РЕСПУБЛИКА",
  "ОРДА",
  "КОЛОВОД",
  "БРАТСТВО",
  "КНЯЖЕСТВО",
  "ТЕОКРАТИЯ",
];

function relMeta(type: string) {
  return (
    RELATIONSHIP_TYPES.find((r) => r.value === type) || {
      value: type,
      label: type.toUpperCase(),
      color: "#888888",
    }
  );
}

function StatesPanel({ flash }: { flash: (m: string) => void }) {
  const [states, setStates] = useState<StateRowAdmin[]>([]);
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ===== State form state =====
  const [sEditingId, setSEditingId] = useState<string | null>(null);
  const [sName, setSName] = useState("");
  const [sSigil, setSSigil] = useState("🔥");
  const [sColor, setSColor] = useState("#4af626");
  const [sCategory, setSCategory] = useState("ИМПЕРИЯ");
  const [sDescription, setSDescription] = useState("");
  const [sLocked, setSLocked] = useState(false);
  const [sSubmitting, setSSubmitting] = useState(false);
  const [sErr, setSErr] = useState("");
  const [importing, setImporting] = useState(false);

  // ===== Relation form state =====
  const [rEditingId, setREditingId] = useState<string | null>(null);
  const [rAId, setRAId] = useState("");
  const [rBId, setRBId] = useState("");
  const [rType, setRType] = useState("alliance");
  const [rDesc, setRDesc] = useState("");
  const [rDate, setRDate] = useState("");
  const [rSubmitting, setRSubmitting] = useState(false);
  const [rErr, setRErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [sRes, rRes] = await Promise.all([
        fetch("/api/admin/states"),
        fetch("/api/admin/states/relations"),
      ]);
      if (!sRes.ok || !rRes.ok) {
        setErr("Не удалось загрузить государства — сессия могла истечь.");
        return;
      }
      const sJ = await sRes.json();
      const rJ = await rRes.json();
      setStates(Array.isArray(sJ?.data) ? sJ.data : []);
      setRelations(Array.isArray(rJ?.data) ? rJ.data : []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetStateForm() {
    setSEditingId(null);
    setSName("");
    setSSigil("🔥");
    setSColor("#4af626");
    setSCategory("ИМПЕРИЯ");
    setSDescription("");
    setSLocked(false);
    setSErr("");
  }

  function editState(s: StateRowAdmin) {
    setSEditingId(s.id);
    setSName(s.name);
    setSSigil(s.sigil || "🔥");
    setSColor(s.color || "#4af626");
    setSCategory(s.category || "ИМПЕРИЯ");
    setSDescription(s.description || "");
    setSLocked(s.isLocked);
    setSErr("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitState(e: React.FormEvent) {
    e.preventDefault();
    if (!sName.trim()) {
      setSErr("Имя государства обязательно.");
      return;
    }
    setSSubmitting(true);
    setSErr("");
    try {
      const res = await fetch("/api/admin/states", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sEditingId || undefined,
          name: sName.trim(),
          sigil: sSigil.trim() || null,
          color: sColor.trim() || null,
          category: sCategory.trim() || null,
          description: sDescription.trim() || null,
          isLocked: sLocked,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setSErr(j.error || "сохранение не удалось");
        return;
      }
      flash(sEditingId ? "ГОСУДАРСТВО ОБНОВЛЕНО" : "ГОСУДАРСТВО СОЗДАНО");
      resetStateForm();
      load();
    } catch (e: unknown) {
      setSErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setSSubmitting(false);
    }
  }

  async function deleteState(s: StateRowAdmin) {
    if (!window.confirm(`Удалить государство «${s.name}»? Все его отношения будут удалены.`)) return;
    try {
      const res = await fetch("/api/admin/states/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "УДАЛЕНИЕ НЕ УДАЛОСЬ");
        return;
      }
      flash("ГОСУДАРСТВО УДАЛЕНО");
      if (sEditingId === s.id) resetStateForm();
      load();
    } catch {
      flash("сетевая ошибка");
    }
  }

  /** Import states from the lore table (category="Государство").
   *  Pulls lore records via Supabase, upserts into State table by name.
   *  Existing states keep their color/sigil if already customized. */
  async function importFromLore() {
    if (!window.confirm(
      "Импортировать государства из базы лора?\n\n" +
      "• Записи лора с категорией «Государство» будут добавлены в таблицу State.\n" +
      "• Существующие государства (по имени) — обновят описание.\n" +
      "• Цвет и сигил будут подобраны по титулу (Империя/Королевство/Княжество/Теократия...).\n" +
      "• Отношения НЕ затрагиваются."
    )) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/states/import-lore", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        flash(j.error || "ИМПОРТ НЕ УДАЛСЯ");
        return;
      }
      flash(`ИМПОРТ: +${j.created} создано, ${j.updated} обновлено`);
      load();
    } catch {
      flash("сетевая ошибка");
    } finally {
      setImporting(false);
    }
  }

  function resetRelationForm() {
    setREditingId(null);
    setRAId("");
    setRBId("");
    setRType("alliance");
    setRDesc("");
    setRDate("");
    setRErr("");
  }

  function editRelation(r: RelationRow) {
    setREditingId(r.id);
    setRAId(r.stateAId);
    setRBId(r.stateBId);
    setRType(r.relationshipType);
    setRDesc(r.description || "");
    setRDate(r.treatyDate || "");
    setRErr("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitRelation(e: React.FormEvent) {
    e.preventDefault();
    if (!rAId || !rBId) {
      setRErr("Выберите оба государства.");
      return;
    }
    if (rAId === rBId) {
      setRErr("Государство не может относиться к самому себе.");
      return;
    }
    setRSubmitting(true);
    setRErr("");
    try {
      const res = await fetch("/api/admin/states/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rEditingId || undefined,
          stateAId: rAId,
          stateBId: rBId,
          relationshipType: rType,
          description: rDesc.trim() || null,
          treatyDate: rDate.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setRErr(j.error || "сохранение не удалось");
        return;
      }
      flash(rEditingId ? "ОТНОШЕНИЕ ОБНОВЛЕНО" : "ОТНОШЕНИЕ СОЗДАНО");
      resetRelationForm();
      load();
    } catch (e: unknown) {
      setRErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setRSubmitting(false);
    }
  }

  async function deleteRelation(r: RelationRow) {
    if (!window.confirm(`Удалить отношение «${r.stateA.name} ↔ ${r.stateB.name}»?`)) return;
    try {
      const res = await fetch("/api/admin/states/relations/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "УДАЛЕНИЕ НЕ УДАЛОСЬ");
        return;
      }
      flash("ОТНОШЕНИЕ УДАЛЕНО");
      if (rEditingId === r.id) resetRelationForm();
      load();
    } catch {
      flash("сетевая ошибка");
    }
  }

  return (
    <>
      {err && <div style={{ ...styles.err, margin: "12px 16px", maxWidth: "none" }}>{err}</div>}

      {/* ============ SECTION 1: STATES CRUD ============ */}
      <div style={styles.subHeader}>
        <span style={{ color: "#5d685c" }}>
          {"ГОСУДАРСТВ: "}{states.length}{" // ОПЕЧАТАНО: "}{states.filter((s) => s.isLocked).length}
        </span>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button
            onClick={importFromLore}
            disabled={importing}
            style={{
              ...styles.uploadToggle,
              ...(importing ? styles.btnDisabled : {}),
              borderColor: "#3fd6c8",
              color: "#3fd6c8",
            }}
            title="Импортировать государства из базы лора (категория «Государство») в таблицу State"
          >
            {importing ? "ИМПОРТ…" : "↺ ИМПОРТ ИЗ ЛОРА"}
          </button>
          {sEditingId && (
            <button onClick={resetStateForm} style={styles.uploadToggle}>× ОТМЕНА</button>
          )}
        </div>
      </div>

      <form onSubmit={submitState} style={styles.uploadForm}>
        <div style={styles.uploadTitle}>
          {sEditingId ? "✎ РЕДАКТИРОВАНИЕ ГОСУДАРСТВА" : "+ НОВОЕ ГОСУДАРСТВО"}
        </div>

        <label style={styles.fieldLabel}>НАЗВАНИЕ *</label>
        <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="напр. Ашеновый Трон" style={styles.input} />

        <div style={styles.fieldRow}>
          <div>
            <label style={styles.fieldLabel}>КАТЕГОРИЯ</label>
            <select value={sCategory} onChange={(e) => setSCategory(e.target.value)} style={styles.select}>
              {STATE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              {sCategory && !STATE_CATEGORIES.includes(sCategory) && (
                <option value={sCategory}>{sCategory}</option>
              )}
            </select>
          </div>
          <div>
            <label style={styles.fieldLabel}>СИГИЛ (emoji/текст)</label>
            <input value={sSigil} onChange={(e) => setSSigil(e.target.value)} placeholder="🔥" maxLength={20} style={styles.input} />
          </div>
        </div>

        <label style={styles.fieldLabel}>ЦВЕТ УЗЛА ГРАФА</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={sColor}
            onChange={(e) => setSColor(e.target.value)}
            style={{
              width: 56,
              height: 44,
              padding: 0,
              background: "#0a0d0a",
              border: "1px solid #2c8a17",
              borderRadius: 2,
              cursor: "pointer",
            }}
          />
          <input value={sColor} onChange={(e) => setSColor(e.target.value)} placeholder="#4af626" style={{ ...styles.input, flex: 1 }} />
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: sColor || "#4af626",
              border: "1px solid #1a201a",
              boxShadow: `0 0 8px ${sColor || "#4af626"}`,
              display: "inline-block",
            }}
          />
        </div>

        <label style={styles.fieldLabel}>ОПИСАНИЕ / ЛОР</label>
        <textarea value={sDescription} onChange={(e) => setSDescription(e.target.value)} placeholder="Описание государства, его история и культура…" rows={4} style={{ ...styles.input, resize: "vertical" }} />

        <label style={styles.checkRow}>
          <input type="checkbox" checked={sLocked} onChange={(e) => setSLocked(e.target.checked)} style={styles.checkbox} />
          <span>{"🔒 ОПЕЧАТАТЬ (скрыть от публичной консоли)"}</span>
        </label>

        {sErr && <div style={styles.err}>{sErr}</div>}

        <button type="submit" disabled={sSubmitting} style={{ ...styles.btn, ...(sSubmitting ? styles.btnDisabled : {}) }}>
          {sSubmitting ? "СОХРАНЕНИЕ…" : sEditingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "СОЗДАТЬ ГОСУДАРСТВО"}
        </button>
      </form>

      <div style={styles.listWrap}>
        {loading ? (
          <div style={styles.empty}>ЗАГРУЗКА ГОСУДАРСТВ…</div>
        ) : states.length === 0 ? (
          <div style={styles.empty}>{"// нет государств. Создайте первое выше."}</div>
        ) : (
          states.map((s) => (
            <div key={s.id} style={{ ...styles.card, ...(s.isLocked ? styles.cardLocked : {}) }}>
              <div style={styles.cardHead}>
                <span style={styles.cardId}>#{s.id.slice(0, 8).toUpperCase()}</span>
                <span style={{ ...styles.cardStatus, ...(s.isLocked ? styles.statusLocked : styles.statusOpen) }}>
                  {s.isLocked ? "🔒 ОПЕЧАТАНО" : "🔓 ОТКРЫТО"}
                </span>
              </div>
              <div style={{ ...styles.cardName, display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: `${s.color || "#4af626"}22`,
                    border: `1px solid ${s.color || "#4af626"}`,
                    color: s.color || "#4af626",
                    fontSize: 16,
                    boxShadow: `0 0 8px ${(s.color || "#4af626")}55`,
                    flexShrink: 0,
                  }}
                >
                  {s.sigil || "◈"}
                </span>
                {s.name}
              </div>
              <div style={styles.cardCat}>{s.category || "БЕЗ КАТЕГОРИИ"}</div>
              {s.description && (
                <div style={styles.cardDesc}>
                  {s.description.length > 140 ? s.description.slice(0, 140) + "…" : s.description}
                </div>
              )}
              <div style={styles.cardActions}>
                <button onClick={() => editState(s)} style={{ ...styles.iconBtn, ...styles.iconEdit, flex: 1, width: "auto" }} title="Редактировать">✎ РЕДАКТИРОВАТЬ</button>
                <button onClick={() => deleteState(s)} style={{ ...styles.iconBtn, ...styles.iconDel, flex: 1, width: "auto" }} title="Удалить">✕ УДАЛИТЬ</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ============ SECTION 2: RELATIONS CRUD ============ */}
      <div style={{ ...styles.subHeader, borderTop: "1px solid #2a2017", marginTop: 8 }}>
        <span style={{ color: "#5d685c" }}>
          {"ОТНОШЕНИЙ: "}{relations.length}
        </span>
        {rEditingId && (
          <button onClick={resetRelationForm} style={styles.uploadToggle}>× ОТМЕНА</button>
        )}
      </div>

      <form onSubmit={submitRelation} style={styles.uploadForm}>
        <div style={styles.uploadTitle}>
          {rEditingId ? "✎ РЕДАКТИРОВАНИЕ ОТНОШЕНИЯ" : "+ НОВОЕ ОТНОШЕНИЕ"}
        </div>

        <div style={styles.fieldRow}>
          <div>
            <label style={styles.fieldLabel}>ГОСУДАРСТВО A *</label>
            <select value={rAId} onChange={(e) => setRAId(e.target.value)} style={styles.select}>
              <option value="">— выбрать —</option>
              {states.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label style={styles.fieldLabel}>ГОСУДАРСТВО B *</label>
            <select value={rBId} onChange={(e) => setRBId(e.target.value)} style={styles.select}>
              <option value="">— выбрать —</option>
              {states.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
        </div>

        <label style={styles.fieldLabel}>ТИП ОТНОШЕНИЯ</label>
        <select value={rType} onChange={(e) => setRType(e.target.value)} style={styles.select}>
          {RELATIONSHIP_TYPES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        <label style={styles.fieldLabel}>ОПИСАНИЕ ДОГОВОРА</label>
        <textarea value={rDesc} onChange={(e) => setRDesc(e.target.value)} placeholder="Условия союза, причины войны, статьи пакта…" rows={3} style={{ ...styles.input, resize: "vertical" }} />

        <label style={styles.fieldLabel}>ДАТА ДОГОВОРА (свободный текст)</label>
        <input value={rDate} onChange={(e) => setRDate(e.target.value)} placeholder="напр. 1247 г. Третьей Эпохи" style={styles.input} />

        {rErr && <div style={styles.err}>{rErr}</div>}

        <button type="submit" disabled={rSubmitting} style={{ ...styles.btn, ...(rSubmitting ? styles.btnDisabled : {}) }}>
          {rSubmitting ? "СОХРАНЕНИЕ…" : rEditingId ? "СОХРАНИТЬ ИЗМЕНЕНИЯ" : "СОЗДАТЬ ОТНОШЕНИЕ"}
        </button>
      </form>

      <div style={styles.listWrap}>
        {loading ? (
          <div style={styles.empty}>ЗАГРУЗКА ОТНОШЕНИЙ…</div>
        ) : relations.length === 0 ? (
          <div style={styles.empty}>{"// нет отношений. Создайте первое выше."}</div>
        ) : (
          relations.map((r) => {
            const m = relMeta(r.relationshipType);
            return (
              <div key={r.id} style={{ ...styles.card, borderColor: `${m.color}44` }}>
                <div style={styles.cardHead}>
                  <span style={styles.cardId}>#{r.id.slice(0, 8).toUpperCase()}</span>
                  <span style={{ ...styles.cardStatus, borderColor: m.color, color: m.color }}>
                    {m.label}
                  </span>
                </div>
                <div style={{ ...styles.cardName, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: r.stateA.color || "#4af626" }}>{r.stateA.sigil || "◈"}</span>
                    <span>{r.stateA.name}</span>
                  <span style={{ color: "#5d685c", margin: "0 4px" }}>↔</span>
                  <span style={{ color: r.stateB.color || "#4af626" }}>{r.stateB.sigil || "◈"}</span>
                    <span>{r.stateB.name}</span>
                </div>
                {r.description && (
                  <div style={styles.cardDesc}>
                    {r.description.length > 160 ? r.description.slice(0, 160) + "…" : r.description}
                  </div>
                )}
                {r.treatyDate && (
                  <div style={{ ...styles.cardCat, color: "#e8a13a" }}>📜 {r.treatyDate}</div>
                )}
                <div style={styles.cardActions}>
                  <button onClick={() => editRelation(r)} style={{ ...styles.iconBtn, ...styles.iconEdit, flex: 1, width: "auto" }} title="Редактировать">✎ РЕДАКТИРОВАТЬ</button>
                  <button onClick={() => deleteRelation(r)} style={{ ...styles.iconBtn, ...styles.iconDel, flex: 1, width: "auto" }} title="Удалить">✕ УДАЛИТЬ</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button onClick={load} style={styles.refreshBtn}>↻ ОБНОВИТЬ МАТРИЦУ</button>
    </>
  );
}

/* ============================================================
   RECORD CARD — single record row with action buttons
   ============================================================ */
function RecordCard({
  rec,
  onToggle,
  onEdit,
  onDelete,
}: {
  rec: ArchiveRecord;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const idShort = rec.id?.slice(0, 8).toUpperCase() || "—";
  return (
    <div style={{
      ...styles.card,
      ...(rec.is_locked ? styles.cardLocked : {}),
    }}>
      <div style={styles.cardHead}>
        <span style={styles.cardId}>#{idShort}</span>
        <span style={{
          ...styles.cardStatus,
          ...(rec.is_locked ? styles.statusLocked : styles.statusOpen),
        }}>
          {rec.is_locked ? "🔒 ОПЕЧАТАНО" : "🔓 ОТКРЫТО"}
        </span>
      </div>
      <div style={styles.cardName}>{rec.is_locked ? "[ДАННЫЕ ПОВРЕЖДЕНЫ]" : (rec.name || "[без имени]")}</div>
      {rec.title && !rec.is_locked && <div style={styles.cardTitle}>{rec.title}</div>}
      <div style={styles.cardCat}>{rec.category || "БЕЗ КАТЕГОРИИ"}</div>
      {rec.description && !rec.is_locked && (
        <div style={styles.cardDesc}>
          {rec.description.length > 120 ? rec.description.slice(0, 120) + "…" : rec.description}
        </div>
      )}
      <div style={styles.cardActions}>
        <button
          onClick={onToggle}
          style={{
            ...styles.toggleBtn,
            ...(rec.is_locked ? styles.toggleUnlock : styles.toggleLock),
            flex: 1,
            marginTop: 0,
          }}
        >
          {rec.is_locked ? "🔓 СНЯТЬ ПЕЧАТЬ" : "🔒 ОПЕЧАТАТЬ"}
        </button>
        <button onClick={onEdit} style={{ ...styles.iconBtn, ...styles.iconEdit }} title="Редактировать">✎</button>
        <button onClick={onDelete} style={{ ...styles.iconBtn, ...styles.iconDel }} title="Удалить">✕</button>
      </div>
    </div>
  );
}

/* ============================================================
   UPLOAD FORM — create new record with full field set
   ============================================================ */
function UploadForm({
  type,
  onDone,
  flash,
}: {
  type: RecordType;
  onDone: () => void;
  flash: (m: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(type === "rulers" ? "RULER" : type === "lore" ? "LORE" : "NPC");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sigil, setSigil] = useState("i-skull");
  const [puzzleType, setPuzzleType] = useState("none");
  const [puzzleHint, setPuzzleHint] = useState("");
  const [puzzleData, setPuzzleData] = useState("");
  const [fragmentPuzzleType, setFragmentPuzzleType] = useState("none");
  const [fragmentPuzzleHint, setFragmentPuzzleHint] = useState("");
  const [fragmentPuzzleData, setFragmentPuzzleData] = useState("");
  const [shardWord, setShardWord] = useState("");
  const [prophecyBonusText, setProphecyBonusText] = useState("");
  const [mapX, setMapX] = useState("0");
  const [mapY, setMapY] = useState("0");
  const [customTrigger, setCustomTrigger] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Имя обязательно."); return; }
    let puzzleDataParsed: unknown = null;
    let fragmentPuzzleDataParsed: unknown = null;
    let customTriggerParsed: unknown = null;
    try {
      if (puzzleData.trim()) puzzleDataParsed = JSON.parse(puzzleData);
    } catch {
      setErr("puzzle_data: неверный JSON"); return;
    }
    try {
      if (fragmentPuzzleData.trim()) fragmentPuzzleDataParsed = JSON.parse(fragmentPuzzleData);
    } catch {
      setErr("fragment_puzzle_data: неверный JSON"); return;
    }
    try {
      if (customTrigger.trim()) customTriggerParsed = JSON.parse(customTrigger);
    } catch {
      setErr("custom_trigger: неверный JSON"); return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: name.trim(),
          category: category.trim() || "UNCATEGORIZED",
          title: title.trim() || null,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          sigil,
          // Extended fields — sent for forward-compat; backend persists what the schema supports.
          puzzle_type: puzzleType,
          puzzle_hint: puzzleHint.trim() || null,
          puzzle_data: puzzleDataParsed,
          fragment_puzzle_type: fragmentPuzzleType,
          fragment_puzzle_hint: fragmentPuzzleHint.trim() || null,
          fragment_puzzle_data: fragmentPuzzleDataParsed,
          shard_word: shardWord.trim() || null,
          prophecy_bonus_text: prophecyBonusText.trim() || null,
          map_x: Number(mapX) || 0,
          map_y: Number(mapY) || 0,
          custom_trigger: customTriggerParsed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "загрузка не удалась");
        return;
      }
      flash("ЗАГРУЖЕНО В АРХИВ");
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={styles.uploadForm}>
      <div style={styles.uploadTitle}>+ НОВАЯ ЗАПИСЬ · {type.toUpperCase()}</div>

      <label style={styles.fieldLabel}>ИМЯ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Kaelen Ashbringer" style={styles.input} />

      <label style={styles.fieldLabel}>КАТЕГОРИЯ</label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="напр. UNDEAD, FIEND, LORE…" style={styles.input} />

      <label style={styles.fieldLabel}>ТИТУЛ / ЭПИТЕТ</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. // the Fallen Paladin" style={styles.input} />

      <label style={styles.fieldLabel}>ОПИСАНИЕ / ЛОР</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Текст лора…" rows={4} style={{ ...styles.input, resize: "vertical" }} />

      <label style={styles.fieldLabel}>URL ИЗОБРАЖЕНИЯ (опц.)</label>
      <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.png" style={styles.input} type="url" />

      <label style={styles.fieldLabel}>СИГИЛ</label>
      <select value={sigil} onChange={(e) => setSigil(e.target.value)} style={styles.select}>
        {SIGILS.map((s) => (<option key={s} value={s}>{s}</option>))}
      </select>

      <label style={styles.fieldLabel}>ТИП ГОЛОВОЛОМКИ</label>
      <select value={puzzleType} onChange={(e) => setPuzzleType(e.target.value)} style={styles.select}>
        {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
      </select>

      <label style={styles.fieldLabel}>ПОДСКАЗКА ГОЛОВОЛОМКИ</label>
      <input value={puzzleHint} onChange={(e) => setPuzzleHint(e.target.value)} placeholder="напр. // произнеси истинное имя" style={styles.input} />

      <label style={styles.fieldLabel}>ДАННЫЕ ГОЛОВОЛОМКИ (JSON)</label>
      <textarea value={puzzleData} onChange={(e) => setPuzzleData(e.target.value)} placeholder={'{\n  "answer": "shadow",\n  "tries": 3\n}'} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

      <div style={{ marginTop: 16, marginBottom: 8, borderTop: "1px dashed #2a2017" }} />
      <div style={{ fontSize: 13, color: "#e8a13a", fontFamily: "'VT323', monospace", letterSpacing: 2, marginBottom: 8 }}>
        🔓 ГОЛОВОЛОМКА СКРЫТОГО ФРАГМЕНТА
      </div>
      <div style={{ fontSize: 11, color: "#5a5a5a", marginBottom: 10, fontFamily: "'Share Tech Mono', monospace" }}>
        {"// используется для расшифровки [[HIDDEN:...]] в описании (запись должна быть открыта)"}
      </div>

      <label style={styles.fieldLabel}>ТИП ГОЛОВОЛОМКИ ФРАГМЕНТА</label>
      <select value={fragmentPuzzleType} onChange={(e) => setFragmentPuzzleType(e.target.value)} style={styles.select}>
        {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
      </select>

      <label style={styles.fieldLabel}>ПОДСКАЗКА ФРАГМЕНТА</label>
      <input value={fragmentPuzzleHint} onChange={(e) => setFragmentPuzzleHint(e.target.value)} placeholder="напр. // имя забыто пеплом" style={styles.input} />

      <label style={styles.fieldLabel}>ДАННЫЕ ГОЛОВОЛОМКИ ФРАГМЕНТА (JSON)</label>
      <textarea value={fragmentPuzzleData} onChange={(e) => setFragmentPuzzleData(e.target.value)} placeholder={'{\n  "answer": "ash",\n  "tries": 2\n}'} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

      <label style={styles.fieldLabel}>СЛОВО-ОСКОЛОК</label>
      <input value={shardWord} onChange={(e) => setShardWord(e.target.value)} placeholder="напр. ПЕПЕЛ" style={styles.input} />

      <label style={styles.fieldLabel}>БОНУСНОЕ ПРОРОЧЕСТВО</label>
      <textarea value={prophecyBonusText} onChange={(e) => setProphecyBonusText(e.target.value)} placeholder="// дополнительная строка пророчества…" rows={3} style={{ ...styles.input, resize: "vertical" }} />

      <div style={styles.fieldRow}>
        <div>
          <label style={styles.fieldLabel}>MAP X</label>
          <input value={mapX} onChange={(e) => setMapX(e.target.value)} placeholder="0" type="number" style={styles.input} />
        </div>
        <div>
          <label style={styles.fieldLabel}>MAP Y</label>
          <input value={mapY} onChange={(e) => setMapY(e.target.value)} placeholder="0" type="number" style={styles.input} />
        </div>
      </div>

      <label style={styles.fieldLabel}>КАСТОМНЫЙ ТРИГГЕР (JSON)</label>
      <textarea value={customTrigger} onChange={(e) => setCustomTrigger(e.target.value)} placeholder={'{\n  "on_unlock": "spawn_boss"\n}'} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

      {err && <div style={styles.err}>{err}</div>}

      <button type="submit" disabled={submitting} style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}>
        {submitting ? "ЗАГРУЗКА…" : "ЗАГРУЗИТЬ В АРХИВ"}
      </button>
    </form>
  );
}

/* ============================================================
   EDIT MODAL — edit existing record (pre-filled from list)
   ============================================================ */
function EditModal({
  rec,
  type,
  onClose,
  onSaved,
  flash,
}: {
  rec: ArchiveRecord;
  type: RecordType;
  onClose: () => void;
  onSaved: () => void;
  flash: (m: string) => void;
}) {
  // Pre-fill from the list record (the list route uses select("*") so extended
  // fields like puzzle_type, shard_word are present when the DB has them).
  const [name, setName] = useState(rec.name || "");
  const [category, setCategory] = useState(rec.category || "");
  const [title, setTitle] = useState(rec.title || "");
  const [description, setDescription] = useState(rec.description || "");
  const [imageUrl, setImageUrl] = useState(rec.image_url || "");
  const [sigil, setSigil] = useState(rec.sigil || "i-skull");
  const [puzzleType, setPuzzleType] = useState(rec.puzzle_type || "none");
  const [puzzleHint, setPuzzleHint] = useState(rec.puzzle_hint || "");
  const [puzzleData, setPuzzleData] = useState(() => stringifyMaybe(rec.puzzle_data));
  const [fragmentPuzzleType, setFragmentPuzzleType] = useState(rec.fragment_puzzle_type || "none");
  const [fragmentPuzzleHint, setFragmentPuzzleHint] = useState(rec.fragment_puzzle_hint || "");
  const [fragmentPuzzleData, setFragmentPuzzleData] = useState(() => stringifyMaybe(rec.fragment_puzzle_data));
  const [shardWord, setShardWord] = useState(rec.shard_word || "");
  const [prophecyBonusText, setProphecyBonusText] = useState(rec.prophecy_bonus_text || "");
  const [mapX, setMapX] = useState(rec.map_x != null ? String(rec.map_x) : "0");
  const [mapY, setMapY] = useState(rec.map_y != null ? String(rec.map_y) : "0");
  const [customTrigger, setCustomTrigger] = useState(() => stringifyMaybe(rec.custom_trigger));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  // ESC closes the modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Имя обязательно."); return; }
    let puzzleDataParsed: unknown = null;
    let fragmentPuzzleDataParsed: unknown = null;
    let customTriggerParsed: unknown = null;
    try {
      if (puzzleData.trim()) puzzleDataParsed = JSON.parse(puzzleData);
    } catch {
      setErr("puzzle_data: неверный JSON"); return;
    }
    try {
      if (fragmentPuzzleData.trim()) fragmentPuzzleDataParsed = JSON.parse(fragmentPuzzleData);
    } catch {
      setErr("fragment_puzzle_data: неверный JSON"); return;
    }
    try {
      if (customTrigger.trim()) customTriggerParsed = JSON.parse(customTrigger);
    } catch {
      setErr("custom_trigger: неверный JSON"); return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          id: rec.id,
          name: name.trim(),
          category: category.trim() || "UNCATEGORIZED",
          title: title.trim() || null,
          description: description.trim() || null,
          image_url: imageUrl.trim() || null,
          sigil,
          puzzle_type: puzzleType,
          puzzle_hint: puzzleHint.trim() || null,
          puzzle_data: puzzleDataParsed,
          fragment_puzzle_type: fragmentPuzzleType,
          fragment_puzzle_hint: fragmentPuzzleHint.trim() || null,
          fragment_puzzle_data: fragmentPuzzleDataParsed,
          shard_word: shardWord.trim() || null,
          prophecy_bonus_text: prophecyBonusText.trim() || null,
          map_x: Number(mapX) || 0,
          map_y: Number(mapY) || 0,
          custom_trigger: customTriggerParsed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "сохранение не удалось");
        return;
      }
      flash("ЗАПИСЬ ОБНОВЛЕНА");
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <span style={styles.modalTitle}>✎ РЕДАКТИРОВАНИЕ · {type}</span>
          <button onClick={onClose} style={styles.modalClose}>×</button>
        </div>
        <form onSubmit={submit} style={styles.modalForm}>
          <label style={styles.fieldLabel}>ИМЯ *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>КАТЕГОРИЯ</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>ТИТУЛ / ЭПИТЕТ</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>ОПИСАНИЕ / ЛОР</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical" }} />

          <label style={styles.fieldLabel}>URL ИЗОБРАЖЕНИЯ</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} type="url" style={styles.input} />

          <label style={styles.fieldLabel}>СИГИЛ</label>
          <select value={sigil} onChange={(e) => setSigil(e.target.value)} style={styles.select}>
            {SIGILS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>

          <label style={styles.fieldLabel}>ТИП ГОЛОВОЛОМКИ</label>
          <select value={puzzleType} onChange={(e) => setPuzzleType(e.target.value)} style={styles.select}>
            {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>

          <label style={styles.fieldLabel}>ПОДСКАЗКА ГОЛОВОЛОМКИ</label>
          <input value={puzzleHint} onChange={(e) => setPuzzleHint(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>ДАННЫЕ ГОЛОВОЛОМКИ (JSON)</label>
          <textarea value={puzzleData} onChange={(e) => setPuzzleData(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

          <div style={{ marginTop: 16, marginBottom: 8, borderTop: "1px dashed #2a2017" }} />
          <div style={{ fontSize: 13, color: "#e8a13a", fontFamily: "'VT323', monospace", letterSpacing: 2, marginBottom: 8 }}>
            🔓 ГОЛОВОЛОМКА СКРЫТОГО ФРАГМЕНТА
          </div>
          <div style={{ fontSize: 11, color: "#5a5a5a", marginBottom: 10, fontFamily: "'Share Tech Mono', monospace" }}>
            {"// используется для расшифровки [[HIDDEN:...]] в описании (запись должна быть открыта)"}
          </div>

          <label style={styles.fieldLabel}>ТИП ГОЛОВОЛОМКИ ФРАГМЕНТА</label>
          <select value={fragmentPuzzleType} onChange={(e) => setFragmentPuzzleType(e.target.value)} style={styles.select}>
            {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>

          <label style={styles.fieldLabel}>ПОДСКАЗКА ФРАГМЕНТА</label>
          <input value={fragmentPuzzleHint} onChange={(e) => setFragmentPuzzleHint(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>ДАННЫЕ ГОЛОВОЛОМКИ ФРАГМЕНТА (JSON)</label>
          <textarea value={fragmentPuzzleData} onChange={(e) => setFragmentPuzzleData(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

          <label style={styles.fieldLabel}>СЛОВО-ОСКОЛОК</label>
          <input value={shardWord} onChange={(e) => setShardWord(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>БОНУСНОЕ ПРОРОЧЕСТВО</label>
          <textarea value={prophecyBonusText} onChange={(e) => setProphecyBonusText(e.target.value)} rows={3} style={{ ...styles.input, resize: "vertical" }} />

          <div style={styles.fieldRow}>
            <div>
              <label style={styles.fieldLabel}>MAP X</label>
              <input value={mapX} onChange={(e) => setMapX(e.target.value)} type="number" style={styles.input} />
            </div>
            <div>
              <label style={styles.fieldLabel}>MAP Y</label>
              <input value={mapY} onChange={(e) => setMapY(e.target.value)} type="number" style={styles.input} />
            </div>
          </div>

          <label style={styles.fieldLabel}>КАСТОМНЫЙ ТРИГГЕР (JSON)</label>
          <textarea value={customTrigger} onChange={(e) => setCustomTrigger(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

          {err && <div style={styles.err}>{err}</div>}

          <div style={styles.modalActions}>
            <button type="button" onClick={onClose} style={{ ...styles.btn, ...styles.btnSecondary, maxWidth: "none" }}>ОТМЕНА</button>
            <button type="submit" disabled={submitting} style={{ ...styles.btn, maxWidth: "none", ...(submitting ? styles.btnDisabled : {}) }}>
              {submitting ? "СОХРАНЕНИЕ…" : "СОХРАНИТЬ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function stringifyMaybe(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/* ============================================================
   WARDENS PANEL — manage player accounts
   ============================================================ */
interface WardenPlayer {
  id: string;
  warden_name: string;
  created_at: string | null;
  achievements: string[];
}

function WardensPanel({ flash, onChanged }: { flash: (m: string) => void; onChanged: () => void }) {
  const [players, setPlayers] = useState<WardenPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [cipher, setCipher] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/players");
      if (!res.ok) {
        setErr("Не удалось загрузить стражей.");
        setPlayers([]);
        return;
      }
      const j = await res.json();
      const arr: WardenPlayer[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
      setPlayers(arr);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !cipher.trim()) {
      setErr("Имя и шифр обязательны.");
      return;
    }
    setSubmitting(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warden_name: name.trim(), password: cipher.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "Создание не удалось");
        return;
      }
      flash("СТРАЖ СОЗДАН");
      setName("");
      setCipher("");
      load();
      onChanged();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(p: WardenPlayer) {
    const np = window.prompt(`Новый шифр для ${p.warden_name}:`);
    if (!np) return;
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", id: p.id, new_password: np }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "СБРОС НЕ УДАЛСЯ");
        return;
      }
      flash("ПАРОЛЬ СБРОШЕН");
    } catch {
      flash("сетевая ошибка");
    }
  }

  async function resetAchievements(p: WardenPlayer) {
    if (!window.confirm(`Сбросить достижения стража ${p.warden_name}?`)) return;
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_achievements", id: p.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "СБРОС НЕ УДАЛСЯ");
        return;
      }
      flash("ДОСТИЖЕНИЯ СБРОШЕНЫ");
      load();
      onChanged();
    } catch { flash("сетевая ошибка"); }
  }

  async function resetFragments(p: WardenPlayer) {
    if (!window.confirm(`Запечатать все фрагменты стража ${p.warden_name}? Решённые скрытые фрагменты снова станут цензурированными.`)) return;
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_fragments", id: p.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "ЗАПЕЧАТЫВАНИЕ НЕ УДАЛОСЬ");
        return;
      }
      flash("ФРАГМЕНТЫ ЗАПЕЧАТАНЫ");
      load();
      onChanged();
    } catch { flash("сетевая ошибка"); }
  }

  async function remove(p: WardenPlayer) {
    if (!window.confirm(`Удалить стража ${p.warden_name}?`)) return;
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: p.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "УДАЛЕНИЕ НЕ УДАЛОСЬ");
        return;
      }
      flash("СТРАЖ УДАЛЁН");
      load();
      onChanged();
    } catch {
      flash("сетевая ошибка");
    }
  }

  return (
    <div style={styles.listWrap}>
      <form onSubmit={create} style={styles.uploadForm}>
        <div style={styles.uploadTitle}>+ НОВЫЙ СТРАЖ</div>
        <label style={styles.fieldLabel}>ИМЯ СТРАЖА *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="имя стража" style={styles.input} />
        <label style={styles.fieldLabel}>ШИФР *</label>
        <input value={cipher} onChange={(e) => setCipher(e.target.value)} placeholder="пароль" type="password" style={styles.input} />
        {err && <div style={styles.err}>{err}</div>}
        <button type="submit" disabled={submitting} style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}>
          {submitting ? "СОЗДАНИЕ…" : "СОЗДАТЬ СТРАЖА"}
        </button>
      </form>

      {loading ? (
        <div style={styles.empty}>ЗАГРУЗКА СТРАЖЕЙ…</div>
      ) : players.length === 0 ? (
        <div style={styles.empty}>{"// стражей пока нет."}</div>
      ) : (
        players.map((p) => (
          <div key={p.id} style={{ ...styles.card, ...styles.cardWarden }}>
            <div style={styles.cardHead}>
              <span style={styles.cardName}>{p.warden_name}</span>
              <span style={{ ...styles.cardStatus, ...styles.statusOpen }}>
                {(p.achievements?.length ?? 0)} дост.
              </span>
            </div>
            <div style={styles.cardId}>
              {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => resetPassword(p)} style={{ ...styles.miniBtn, ...styles.miniAmber }}>СБРОС ПАРОЛЯ</button>
              <button onClick={() => resetAchievements(p)} style={{ ...styles.miniBtn, ...styles.miniGreen }}>СБРОС ДОСТ.</button>
              <button onClick={() => resetFragments(p)} style={{ ...styles.miniBtn, ...styles.miniAmber }}>🔒 ЗАПЕЧАТАТЬ ФРАГМЕНТЫ</button>
              <button onClick={() => remove(p)} style={{ ...styles.miniBtn, ...styles.miniRed }}>УДАЛИТЬ</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ============================================================
   EVENTS PANEL (Этап 12) — Witching Hour + God's Gaze controls.
   Writes to localStorage only (the frontend console polls these keys):
     - ashen_events_config_v2   {witching_hour:{enabled,startHour,startMinute,
                                  endHour,endMinute,timezone(NUMBER),boost(NUMBER),
                                  title,msg}}
     - ashen_witching_manual    "true" | "false"
     - ashen_gaze_cmd           {action:"open_eye",amount} | {action:"close_eye"}
   ============================================================ */
interface WitchingConfig {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: number; // UTC offset in hours (e.g. 3 for Moscow). Frontend does tz*3600000.
  boost: number;    // gaze % added when witching triggers. Frontend does addGaze(cfg.boost||5).
  title: string;
  msg: string;
}

const DEFAULT_WITCHING: WitchingConfig = {
  enabled: false,
  startHour: 3,
  startMinute: 0,
  endHour: 4,
  endMinute: 0,
  timezone: 3, // UTC+3 (Moscow) — matches frontend DEFAULT_EVT
  boost: 15,
  title: "ЧАС ВЕДЬМЫ",
  msg: "бог смотрит пристальнее",
};

const EVENTS_KEY = "ashen_events_config_v2";

function EventsPanel({ flash }: { flash: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<WitchingConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_WITCHING;
    try {
      const raw = window.localStorage.getItem(EVENTS_KEY);
      if (!raw) return DEFAULT_WITCHING;
      const parsed = JSON.parse(raw) as { witching?: Partial<WitchingConfig> } | Partial<WitchingConfig>;
      const witching = ("witching" in parsed && parsed.witching ? parsed.witching : parsed) as Partial<WitchingConfig>;
      return { ...DEFAULT_WITCHING, ...witching };
    } catch {
      return DEFAULT_WITCHING;
    }
  });

  function update(patch: Partial<WitchingConfig>) {
    setCfg((prev) => {
      const next: WitchingConfig = { ...prev, ...patch };
      try {
        localStorage.setItem(EVENTS_KEY, JSON.stringify({ witching: next }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function godCommand(cmd: "wh_on" | "wh_off" | "gaze_25" | "gaze_50" | "gaze_reset") {
    try {
      if (cmd === "wh_on") {
        localStorage.setItem("ashen_witching_manual", "true");
        flash("🌙 ЧАС ВЕДЬМЫ ВКЛЮЧЁН (ручной режим)");
      } else if (cmd === "wh_off") {
        // Frontend checks === "false" and then removes the key.
        localStorage.setItem("ashen_witching_manual", "false");
        flash("ЧАС ВЕДЬМЫ ВЫКЛЮЧЕН");
      } else if (cmd === "gaze_25") {
        localStorage.setItem("ashen_gaze_cmd", JSON.stringify({ action: "open_eye", amount: 25 }));
        flash("ВЗГЛЯД УСИЛЕН +25%");
      } else if (cmd === "gaze_50") {
        localStorage.setItem("ashen_gaze_cmd", JSON.stringify({ action: "open_eye", amount: 50 }));
        flash("ВЗГЛЯД УСИЛЕН +50%");
      } else if (cmd === "gaze_reset") {
        localStorage.setItem("ashen_gaze_cmd", JSON.stringify({ action: "close_eye" }));
        flash("ВЗГЛЯД СБРОШЕН ДО 0%");
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={styles.eventsWrap}>
      <button onClick={() => setOpen((o) => !o)} style={styles.eventsToggle}>
        {open ? "▼" : "▶"} ⚙ ПАНЕЛЬ СОБЫТИЙ
      </button>
      {open && (
        <div style={styles.eventsBody}>
          {/* ===== ЧАС ВЕДЬМЫ — Schedule configuration ===== */}
          <div style={styles.eventsSectionTitle}>🌙 ЧАС ВЕДЬМЫ — НАСТРОЙКА РАСПИСАНИЯ</div>
          <div style={styles.eventsDesc}>
            {"// Час Ведьмы — периодическое событие. В заданное время у игрока"}
            <br />
            {"// растёт Взгляд Бога и появляется индикатор в statusbar."}
            <br />
            {"// Можно включить по расписанию или вручную кнопкой ниже."}
          </div>

          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              style={styles.checkbox}
            />
            <span>Включить по расписанию</span>
          </label>

          <div style={styles.fieldRow}>
            <div>
              <label style={styles.fieldLabel}>Начало (ЧЧ:ММ)</label>
              <div style={styles.timeRow}>
                <input type="number" min={0} max={23} value={cfg.startHour} onChange={(e) => update({ startHour: clampNum(e.target.value, 0, 23) })} style={{ ...styles.input, maxWidth: "80px" }} />
                <span style={{ color: "#5d685c" }}>:</span>
                <input type="number" min={0} max={59} value={cfg.startMinute} onChange={(e) => update({ startMinute: clampNum(e.target.value, 0, 59) })} style={{ ...styles.input, maxWidth: "80px" }} />
              </div>
            </div>
            <div>
              <label style={styles.fieldLabel}>Конец (ЧЧ:ММ)</label>
              <div style={styles.timeRow}>
                <input type="number" min={0} max={23} value={cfg.endHour} onChange={(e) => update({ endHour: clampNum(e.target.value, 0, 23) })} style={{ ...styles.input, maxWidth: "80px" }} />
                <span style={{ color: "#5d685c" }}>:</span>
                <input type="number" min={0} max={59} value={cfg.endMinute} onChange={(e) => update({ endMinute: clampNum(e.target.value, 0, 59) })} style={{ ...styles.input, maxWidth: "80px" }} />
              </div>
            </div>
          </div>

          <label style={styles.fieldLabel}>Часовой пояс (UTC+, напр. 3 = Москва)</label>
          <input type="number" step="1" value={cfg.timezone} onChange={(e) => update({ timezone: Number(e.target.value) || 0 })} style={styles.input} />

          <label style={styles.fieldLabel}>Усиление взгляда (% за срабатывание)</label>
          <input type="number" step="1" value={cfg.boost} onChange={(e) => update({ boost: Number(e.target.value) || 0 })} style={styles.input} />

          <label style={styles.fieldLabel}>Заголовок индикатора</label>
          <input value={cfg.title} onChange={(e) => update({ title: e.target.value })} placeholder="ЧАС ВЕДЬМЫ" style={styles.input} />

          <label style={styles.fieldLabel}>Текст сообщения (показывается в popup)</label>
          <textarea value={cfg.msg} onChange={(e) => update({ msg: e.target.value })} rows={3} style={{ ...styles.input, resize: "vertical" }} />

          {/* ===== Divider between schedule and quick controls ===== */}
          <div style={styles.eventsDivider} />

          {/* ===== ВЗГЛЯД БОГА — Quick controls ===== */}
          <div style={styles.eventsSectionTitle}>👁 ВЗГЛЯД БОГА — БЫСТРОЕ УПРАВЛЕНИЕ</div>
          <div style={styles.eventsDesc}>
            {"// Взгляд Бога — метра 0-100%. Чем больше игрок читает и решает,"}
            <br />
            {"// тем сильнее бог его замечает. При высоких значениях архив"}
            <br />
            {"// деградирует (помехи, виньетка, дрожь). Админ может мгновенно"}
            <br />
            {"// изменить значение кнопками ниже."}
          </div>

          <label style={styles.fieldLabel}>Час Ведьмы — ручной режим</label>
          <div style={styles.quickRow}>
            <button onClick={() => godCommand("wh_on")} style={{ ...styles.miniBtn, ...styles.miniAmber }}>🌙 Включить сейчас</button>
            <button onClick={() => godCommand("wh_off")} style={{ ...styles.miniBtn, ...styles.miniGreen }}>Выключить</button>
          </div>
          <div style={styles.eventsHintLine}>{"// мгновенно включает или отключает Час Ведьмы (manual override)"}</div>

          <label style={styles.fieldLabel}>Взгляд Бога — мгновенное изменение</label>
          <div style={styles.quickRow}>
            <button onClick={() => godCommand("gaze_25")} style={{ ...styles.miniBtn, ...styles.miniAmber }}>Усилить взгляд +25%</button>
            <button onClick={() => godCommand("gaze_50")} style={{ ...styles.miniBtn, ...styles.miniAmber }}>Усилить взгляд +50%</button>
            <button onClick={() => godCommand("gaze_reset")} style={{ ...styles.miniBtn, ...styles.miniGreen }}>Сбросить взгляд</button>
          </div>
          <div style={styles.eventsHintLine}>{"// мгновенно повышает или сбрасывает значение gaze (записывается в ashen_gaze_cmd)"}</div>

          <div style={styles.hint}>
            {"// команды пишутся в localStorage и подхватываются консолью (опрос 1с / 30с)"}
          </div>
        </div>
      )}
    </div>
  );
}

function clampNum(v: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

/* ============================================================
   STYLES — CRT terminal aesthetic
   ============================================================ */
const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: "100vh", background: "#050505", color: "#b6c2b2", fontFamily: "'Share Tech Mono', 'Courier New', monospace", padding: "0 0 80px 0", maxWidth: "640px", margin: "0 auto", position: "relative" },
  boot: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#4af626", fontSize: "16px", letterSpacing: "2px" },
  loginBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "60px 24px", minHeight: "100vh", justifyContent: "center" },
  loginGlyph: { fontSize: "48px", color: "#e8a13a", textShadow: "0 0 20px rgba(232,161,58,.6)" },
  loginTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "28px", letterSpacing: "3px", color: "#4af626", textShadow: "0 0 12px rgba(74,246,38,.6)", margin: 0 },
  loginSub: { fontSize: "13px", color: "#5d685c", letterSpacing: "1px", margin: "0 0 12px 0" },
  input: { width: "100%", maxWidth: "360px", background: "#0a0d0a", border: "1px solid #2c8a17", color: "#4af626", fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", padding: "12px 14px", letterSpacing: "1px", borderRadius: "2px", outline: "none", boxSizing: "border-box" },
  btn: { width: "100%", maxWidth: "360px", background: "linear-gradient(180deg,rgba(74,246,38,.15),rgba(74,246,38,.04))", border: "1px solid #4af626", color: "#4af626", fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", letterSpacing: "2px", padding: "12px", cursor: "pointer", borderRadius: "2px", textShadow: "0 0 8px rgba(74,246,38,.5)", transition: "all .15s" },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  btnSecondary: { background: "none", borderColor: "#5d685c", color: "#8a9588", textShadow: "none" },
  err: { color: "#ff2424", fontSize: "13px", padding: "8px 12px", border: "1px solid #a01212", background: "rgba(255,36,36,.08)", letterSpacing: "1px", maxWidth: "360px", width: "100%", boxSizing: "border-box" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1a201a", background: "linear-gradient(180deg,#0a0d0a,#050505)", position: "sticky", top: 0, zIndex: 10 },
  headerTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "16px", letterSpacing: "2px", color: "#8a9588", display: "flex", alignItems: "center", gap: "8px" },
  headerDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#4af626", boxShadow: "0 0 8px #4af626", display: "inline-block" },
  logoutBtn: { background: "none", border: "1px solid #a01212", color: "#ff2424", fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", padding: "5px 12px", cursor: "pointer", letterSpacing: "1px", borderRadius: "2px" },
  tabs: { display: "flex", gap: "0", padding: "0 16px", borderBottom: "1px solid #1a201a" },
  tab: { flex: 1, background: "none", border: "none", borderBottom: "2px solid transparent", color: "#5d685c", fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", letterSpacing: "1px", padding: "12px 4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all .15s" },
  tabActive: { color: "#4af626", borderBottomColor: "#4af626", textShadow: "0 0 8px rgba(74,246,38,.5)" },
  tabCount: { fontSize: "11px", color: "#5d685c", background: "#0a0d0a", border: "1px solid #1a201a", padding: "1px 6px", borderRadius: "2px" },
  subHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", fontSize: "12px", letterSpacing: "1px", borderBottom: "1px solid #1a201a" },
  uploadToggle: { background: "none", border: "1px solid #e8a13a", color: "#e8a13a", fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", padding: "5px 12px", cursor: "pointer", letterSpacing: "1px", borderRadius: "2px" },
  uploadForm: { padding: "16px", borderBottom: "1px solid #1a201a", background: "rgba(10,13,10,.5)", display: "flex", flexDirection: "column", gap: "4px" },
  uploadTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "16px", color: "#e8a13a", letterSpacing: "2px", marginBottom: "12px", textShadow: "0 0 8px rgba(232,161,58,.4)" },
  fieldLabel: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", marginTop: "8px", marginBottom: "2px", textTransform: "uppercase" },
  select: { width: "100%", background: "#0a0d0a", border: "1px solid #2c8a17", color: "#4af626", fontFamily: "'Share Tech Mono', monospace", fontSize: "16px", padding: "10px 14px", borderRadius: "2px", outline: "none", boxSizing: "border-box" },
  listWrap: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" },
  empty: { padding: "40px 16px", textAlign: "center", color: "#5d685c", fontSize: "14px", lineHeight: "1.6", border: "1px dashed #1a201a" },
  card: { border: "1px solid #1a201a", background: "linear-gradient(180deg,rgba(12,14,12,.9),rgba(6,8,6,.9))", padding: "12px 14px", borderRadius: "2px", position: "relative" },
  cardLocked: { borderColor: "#3a1414", background: "linear-gradient(180deg,rgba(20,8,8,.9),rgba(10,4,4,.9))" },
  cardWarden: { borderColor: "#3a2c14", background: "linear-gradient(180deg,rgba(20,16,8,.9),rgba(14,10,4,.9))" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  cardId: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", fontFamily: "'VT323', monospace" },
  cardStatus: { fontSize: "11px", padding: "2px 8px", border: "1px solid", letterSpacing: "1px", fontFamily: "'VT323', monospace" },
  statusOpen: { borderColor: "#2c8a17", color: "#4af626" },
  statusLocked: { borderColor: "#a01212", color: "#ff2424" },
  cardName: { fontFamily: "'MedievalSharp', serif", fontSize: "17px", color: "#b6c2b2", letterSpacing: "1px", lineHeight: "1.2" },
  cardTitle: { fontSize: "12px", color: "#2c8a17", letterSpacing: "1px", marginTop: "2px", fontFamily: "'VT323', monospace" },
  cardCat: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", marginTop: "4px" },
  cardDesc: { fontSize: "13px", color: "#8a9588", lineHeight: "1.5", marginTop: "6px" },
  cardActions: { display: "flex", gap: "6px", marginTop: "10px", alignItems: "stretch" },
  toggleBtn: { width: "100%", marginTop: "10px", padding: "8px", fontSize: "12px", letterSpacing: "1px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s" },
  toggleUnlock: { background: "linear-gradient(180deg,rgba(74,246,38,.12),rgba(74,246,38,.03))", borderColor: "#4af626", color: "#4af626", textShadow: "0 0 6px rgba(74,246,38,.4)" },
  toggleLock: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424", textShadow: "0 0 6px rgba(255,36,36,.4)" },
  refreshBtn: { display: "block", margin: "20px auto", background: "none", border: "1px solid #2c8a17", color: "#4af626", fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", padding: "8px 20px", cursor: "pointer", letterSpacing: "2px", borderRadius: "2px" },
  toast: { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "#0a0d0a", border: "1px solid #4af626", color: "#4af626", padding: "10px 24px", fontSize: "14px", letterSpacing: "2px", fontFamily: "'Share Tech Mono', monospace", borderRadius: "2px", boxShadow: "0 0 20px rgba(74,246,38,.3)", zIndex: 100 },
  iconBtn: { width: "38px", minWidth: "38px", padding: "8px 0", fontSize: "15px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center" },
  iconEdit: { background: "linear-gradient(180deg,rgba(232,161,58,.12),rgba(232,161,58,.03))", borderColor: "#e8a13a", color: "#e8a13a" },
  iconDel: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424" },
  miniBtn: { flex: 1, padding: "7px 4px", fontSize: "11px", letterSpacing: "1px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s" },
  miniGreen: { background: "linear-gradient(180deg,rgba(74,246,38,.1),rgba(74,246,38,.02))", borderColor: "#4af626", color: "#4af626" },
  miniAmber: { background: "linear-gradient(180deg,rgba(232,161,58,.1),rgba(232,161,58,.02))", borderColor: "#e8a13a", color: "#e8a13a" },
  miniRed: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424" },
  eventsWrap: { borderBottom: "1px solid #1a201a", background: "rgba(10,13,10,.4)" },
  eventsToggle: { width: "100%", background: "none", border: "none", color: "#e8a13a", fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", letterSpacing: "2px", padding: "10px 16px", cursor: "pointer", textAlign: "left", textShadow: "0 0 8px rgba(232,161,58,.4)" },
  eventsBody: { padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: "8px" },
  eventsSectionTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "14px", color: "#e8a13a", letterSpacing: "2px", marginTop: "16px", marginBottom: "8px", paddingBottom: "4px", borderBottom: "1px solid #1a201a" },
  eventsDesc: { fontSize: "11px", color: "#5d685c", letterSpacing: "0.5px", lineHeight: 1.55, background: "rgba(10,13,10,.6)", border: "1px solid #141a14", borderLeft: "2px solid #2c8a17", padding: "8px 10px", marginBottom: "4px", whiteSpace: "pre-wrap" },
  eventsDivider: { borderTop: "1px dashed #2a2017", marginTop: "12px", marginBottom: "4px" },
  eventsHintLine: { fontSize: "11px", color: "#5d685c", letterSpacing: "0.5px", fontStyle: "italic", marginTop: "4px", lineHeight: 1.5 },
  quickRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px", marginTop: "4px" },
  checkRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#b6c2b2", letterSpacing: "1px", cursor: "pointer", padding: "4px 0" },
  checkbox: { width: "16px", height: "16px", accentColor: "#4af626", cursor: "pointer" },
  fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  timeRow: { display: "flex", gap: "6px", alignItems: "center" },
  godRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" },
  hint: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", marginTop: "10px", fontStyle: "italic", lineHeight: 1.5 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 12px", overflowY: "auto" },
  modalContent: { background: "#050505", border: "1px solid #4af626", borderRadius: "2px", maxWidth: "560px", width: "100%", margin: "auto", boxShadow: "0 0 40px rgba(74,246,38,.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1a201a", position: "sticky", top: 0, background: "#050505", zIndex: 1 },
  modalTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "16px", color: "#4af626", letterSpacing: "2px", textShadow: "0 0 8px rgba(74,246,38,.5)" },
  modalClose: { background: "none", border: "1px solid #a01212", color: "#ff2424", width: "32px", height: "32px", cursor: "pointer", borderRadius: "2px", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" },
  modalForm: { padding: "16px", display: "flex", flexDirection: "column", gap: "4px" },
  modalActions: { display: "flex", gap: "8px", marginTop: "12px" },
};
