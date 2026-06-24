"use client";

import { useState, useEffect, useCallback } from "react";

/* ============================================================
   ASHEN CODEX — Mobile Admin Panel  (/admin)
   Dark-fantasy themed, mobile-first. Password-gated.
   ============================================================ */

type RecordType = "npcs" | "lore" | "rulers";
type TabKey = RecordType | "wardens";
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
}
type AllData = { npcs: ArchiveRecord[]; lore: ArchiveRecord[]; rulers: ArchiveRecord[] };

const TABS: { key: TabKey; label: string }[] = [
  { key: "npcs", label: "NPC" },
  { key: "lore", label: "LORE" },
  { key: "rulers", label: "RULERS" },
  { key: "wardens", label: "WARDENS" },
];

const SIGILS = ["i-skull", "i-eye", "i-serpent", "i-crown", "i-flame", "i-hourglass", "i-ritual", "i-god"];

const PUZZLE_TYPES = ["none", "keyword", "tumbler", "constellation", "alchemy", "circuit", "runes", "fragment", "meta"];

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
      setLoginErr(j.error || "ACCESS DENIED");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  if (checking) {
    return (
      <div style={styles.shell}>
        <div style={styles.boot}>CHECKING WARDEN CREDENTIALS…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div style={styles.shell}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <div style={styles.loginGlyph}>⚠</div>
          <h1 style={styles.loginTitle}>WARDEN ACCESS</h1>
          <p style={styles.loginSub}>{"// enter sigil to unlock the archive"}</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="PASSWORD"
            autoFocus
            style={styles.input}
          />
          {loginErr && <div style={styles.err}>{loginErr}</div>}
          <button type="submit" style={styles.btn}>ENTER</button>
        </form>
      </div>
    );
  }

  return <AdminPanel onLogout={handleLogout} />;
}

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AllData>({ npcs: [], lore: [], rulers: [] });
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
        setErr("Failed to load — session may have expired.");
        return;
      }
      const j = await res.json();
      setData(j.data || { npcs: [], lore: [], rulers: [] });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleLock(type: RecordType, id: string, currentLocked: boolean) {
    setData((d) => ({
      ...d,
      [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: !currentLocked } : r)),
    }));
    try {
      const res = await fetch("/api/admin/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "toggle failed");
        setData((d) => ({
          ...d,
          [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: currentLocked } : r)),
        }));
      } else {
        flash(currentLocked ? "UNLOCKED" : "LOCKED");
      }
    } catch {
      flash("network error");
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
      flash("network error");
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  const isWardens = tab === "wardens";
  const records = isWardens ? [] : data[tab];
  const lockedCount = records.filter((r) => r.is_locked).length;

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.headerDot} />
          ASHEN CODEX <span style={{ color: "#4af626" }}>{"// WARDEN"}</span>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>LOGOUT</button>
      </header>

      <EventsPanel />

      <nav style={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              ...styles.tab,
              ...(tab === t.key ? styles.tabActive : {}),
            }}
          >
            {t.label}
            <span style={styles.tabCount}>{t.key === "wardens" ? "—" : data[t.key].length}</span>
          </button>
        ))}
      </nav>

      {isWardens ? (
        <WardensPanel flash={flash} />
      ) : (
        <>
          <div style={styles.subHeader}>
            <span style={{ color: "#5d685c" }}>
              {records.length}{" records // "}{lockedCount}{" locked"}
            </span>
            <button onClick={() => setShowUpload((s) => !s)} style={styles.uploadToggle}>
              {showUpload ? "× CLOSE" : "+ NEW RECORD"}
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
              <div style={styles.empty}>LOADING ARCHIVE…</div>
            ) : records.length === 0 ? (
              <div style={styles.empty}>
                {"// no records in "}{tab}{"."}
                <br />
                {"// tap \"+ NEW RECORD\" to add."}
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

      <button onClick={load} style={styles.refreshBtn}>↻ REFRESH ARCHIVE</button>

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
          {rec.is_locked ? "🔒 LOCKED" : "🔓 OPEN"}
        </span>
      </div>
      <div style={styles.cardName}>{rec.is_locked ? "[DATA CORRUPTED]" : (rec.name || "[unnamed]")}</div>
      {rec.title && !rec.is_locked && <div style={styles.cardTitle}>{rec.title}</div>}
      <div style={styles.cardCat}>{rec.category || "UNCATEGORIZED"}</div>
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
          {rec.is_locked ? "🔓 UNLOCK" : "🔒 LOCK"}
        </button>
        <button onClick={onEdit} style={{ ...styles.iconBtn, ...styles.iconEdit }} title="Редактировать">✎</button>
        <button onClick={onDelete} style={{ ...styles.iconBtn, ...styles.iconDel }} title="Удалить">✕</button>
      </div>
    </div>
  );
}

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
  const [shardWord, setShardWord] = useState("");
  const [prophecyBonusText, setProphecyBonusText] = useState("");
  const [mapX, setMapX] = useState("0");
  const [mapY, setMapY] = useState("0");
  const [customTrigger, setCustomTrigger] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required."); return; }
    let puzzleDataParsed: unknown = null;
    let customTriggerParsed: unknown = null;
    try {
      if (puzzleData.trim()) puzzleDataParsed = JSON.parse(puzzleData);
    } catch {
      setErr("puzzle_data: invalid JSON"); return;
    }
    try {
      if (customTrigger.trim()) customTriggerParsed = JSON.parse(customTrigger);
    } catch {
      setErr("custom_trigger: invalid JSON"); return;
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
          puzzle_type: puzzleType,
          puzzle_hint: puzzleHint.trim() || null,
          puzzle_data: puzzleDataParsed,
          shard_word: shardWord.trim() || null,
          prophecy_bonus_text: prophecyBonusText.trim() || null,
          map_x: Number(mapX) || 0,
          map_y: Number(mapY) || 0,
          custom_trigger: customTriggerParsed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "upload failed");
        return;
      }
      flash("UPLOADED TO ARCHIVE");
      onDone();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={styles.uploadForm}>
      <div style={styles.uploadTitle}>+ NEW {type.toUpperCase().slice(0, -1)} RECORD</div>

      <label style={styles.fieldLabel}>NAME *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kaelen Ashbringer" style={styles.input} />

      <label style={styles.fieldLabel}>CATEGORY</label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. UNDEAD, FIEND, LORE…" style={styles.input} />

      <label style={styles.fieldLabel}>TITLE / EPITHET</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. // the Fallen Paladin" style={styles.input} />

      <label style={styles.fieldLabel}>DESCRIPTION / LORE</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The lore text…" rows={4} style={{ ...styles.input, resize: "vertical" }} />

      <label style={styles.fieldLabel}>IMAGE URL (optional)</label>
      <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.png" style={styles.input} type="url" />

      <label style={styles.fieldLabel}>SIGIL</label>
      <select value={sigil} onChange={(e) => setSigil(e.target.value)} style={styles.select}>
        {SIGILS.map((s) => (<option key={s} value={s}>{s}</option>))}
      </select>

      <label style={styles.fieldLabel}>PUZZLE TYPE</label>
      <select value={puzzleType} onChange={(e) => setPuzzleType(e.target.value)} style={styles.select}>
        {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
      </select>

      <label style={styles.fieldLabel}>PUZZLE HINT</label>
      <input value={puzzleHint} onChange={(e) => setPuzzleHint(e.target.value)} placeholder="e.g. // speak the true name" style={styles.input} />

      <label style={styles.fieldLabel}>PUZZLE DATA (JSON)</label>
      <textarea value={puzzleData} onChange={(e) => setPuzzleData(e.target.value)} placeholder={'{\n  "answer": "shadow",\n  "tries": 3\n}'} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

      <label style={styles.fieldLabel}>SHARD WORD</label>
      <input value={shardWord} onChange={(e) => setShardWord(e.target.value)} placeholder="e.g. AEL" style={styles.input} />

      <label style={styles.fieldLabel}>PROPHECY BONUS TEXT</label>
      <textarea value={prophecyBonusText} onChange={(e) => setProphecyBonusText(e.target.value)} placeholder="// bonus prophecy line…" rows={3} style={{ ...styles.input, resize: "vertical" }} />

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

      <label style={styles.fieldLabel}>CUSTOM TRIGGER (JSON)</label>
      <textarea value={customTrigger} onChange={(e) => setCustomTrigger(e.target.value)} placeholder={'{\n  "on_unlock": "spawn_boss"\n}'} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

      {err && <div style={styles.err}>{err}</div>}

      <button type="submit" disabled={submitting} style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}>
        {submitting ? "UPLOADING…" : "UPLOAD TO ARCHIVE"}
      </button>
    </form>
  );
}

/* ============================================================
   WARDENS PANEL — manage player accounts
   ============================================================ */
interface WardenPlayer {
  id: string;
  name: string;
  created_at: string | null;
  achievements_count: number;
}

function WardensPanel({ flash }: { flash: (m: string) => void }) {
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
        return;
      }
      const j = await res.json();
      setPlayers(Array.isArray(j?.players) ? j.players : Array.isArray(j) ? j : []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "network error");
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
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(p: WardenPlayer) {
    const np = window.prompt(`Новый шифр для ${p.name}:`);
    if (!np) return;
    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", id: p.id, password: np }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        flash(j.error || "СБРОС НЕ УДАЛСЯ");
        return;
      }
      flash("ПАРОЛЬ СБРОШЕН");
    } catch {
      flash("network error");
    }
  }

  async function resetAchievements(p: WardenPlayer) {
    if (!window.confirm(`Сбросить достижения стража ${p.name}?`)) return;
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
      flash("ДОСТ. СБРОШЕНЫ");
      load();
    } catch {
      flash("network error");
    }
  }

  async function remove(p: WardenPlayer) {
    if (!window.confirm(`Удалить стража ${p.name}?`)) return;
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
    } catch {
      flash("network error");
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
          <div key={p.id} style={styles.card}>
            <div style={styles.cardHead}>
              <span style={styles.cardName}>{p.name}</span>
              <span style={{ ...styles.cardStatus, ...styles.statusOpen }}>{p.achievements_count ?? 0} дост.</span>
            </div>
            <div style={styles.cardId}>
              {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => resetPassword(p)} style={{ ...styles.miniBtn, ...styles.miniAmber }}>СБРОС ПАРОЛЯ</button>
              <button onClick={() => resetAchievements(p)} style={{ ...styles.miniBtn, ...styles.miniGreen }}>СБРОС ДОСТ.</button>
              <button onClick={() => remove(p)} style={{ ...styles.miniBtn, ...styles.miniRed }}>УДАЛИТЬ</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ============================================================
   EVENTS PANEL — Witching Hour + God View controls
   ============================================================ */
interface WitchingConfig {
  enabled: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  timezone: string;
  boost: number;
  title: string;
  msg: string;
}

const DEFAULT_WITCHING: WitchingConfig = {
  enabled: false,
  startHour: 0,
  startMinute: 0,
  endHour: 4,
  endMinute: 0,
  timezone: "UTC",
  boost: 2,
  title: "ЧАС ВЕДЬМЫ",
  msg: "Тьма сгущается…",
};

const EVENTS_KEY = "ashen_events_config_v2";

function EventsPanel() {
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

  function godCommand(cmd: "wh_on" | "wh_off" | "eye_open" | "eye_close") {
    try {
      if (cmd === "wh_on") localStorage.setItem("ashen_witching_manual", "true");
      else if (cmd === "wh_off") localStorage.removeItem("ashen_witching_manual");
      else if (cmd === "eye_open") localStorage.setItem("ashen_gaze_cmd", JSON.stringify({ action: "open_eye", amount: 50 }));
      else if (cmd === "eye_close") localStorage.setItem("ashen_gaze_cmd", JSON.stringify({ action: "close_eye" }));
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
          <div style={styles.eventsSectionTitle}>🌙 ЧАС ВЕДЬМЫ</div>

          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => update({ enabled: e.target.checked })}
              style={styles.checkbox}
            />
            <span>ВКЛЮЧИТЬ ЧАС ВЕДЬМЫ</span>
          </label>

          <label style={styles.fieldLabel}>ЧАС НАЧАЛА (ЧЧ:ММ)</label>
          <div style={styles.timeRow}>
            <input type="number" min={0} max={23} value={cfg.startHour} onChange={(e) => update({ startHour: Number(e.target.value) || 0 })} style={{ ...styles.input, maxWidth: "80px" }} />
            <span style={{ color: "#5d685c" }}>:</span>
            <input type="number" min={0} max={59} value={cfg.startMinute} onChange={(e) => update({ startMinute: Number(e.target.value) || 0 })} style={{ ...styles.input, maxWidth: "80px" }} />
          </div>

          <label style={styles.fieldLabel}>ЧАС КОНЦА (ЧЧ:ММ)</label>
          <div style={styles.timeRow}>
            <input type="number" min={0} max={23} value={cfg.endHour} onChange={(e) => update({ endHour: Number(e.target.value) || 0 })} style={{ ...styles.input, maxWidth: "80px" }} />
            <span style={{ color: "#5d685c" }}>:</span>
            <input type="number" min={0} max={59} value={cfg.endMinute} onChange={(e) => update({ endMinute: Number(e.target.value) || 0 })} style={{ ...styles.input, maxWidth: "80px" }} />
          </div>

          <label style={styles.fieldLabel}>ЧАСОВОЙ ПОЯС</label>
          <input value={cfg.timezone} onChange={(e) => update({ timezone: e.target.value })} placeholder="UTC / Europe/Moscow" style={styles.input} />

          <label style={styles.fieldLabel}>МНОЖИТЕЛЬ</label>
          <input type="number" step="0.1" value={cfg.boost} onChange={(e) => update({ boost: Number(e.target.value) || 1 })} style={styles.input} />

          <label style={styles.fieldLabel}>ЗАГОЛОВОК</label>
          <input value={cfg.title} onChange={(e) => update({ title: e.target.value })} placeholder="Час Ведьмы" style={styles.input} />

          <label style={styles.fieldLabel}>СООБЩЕНИЕ</label>
          <textarea value={cfg.msg} onChange={(e) => update({ msg: e.target.value })} rows={3} style={{ ...styles.input, resize: "vertical" }} />

          <div style={styles.eventsSectionTitle}>👁 УПРАВЛЕНИЕ ВЗГЛЯДОМ БОГА</div>
          <div style={styles.godRow}>
            <button onClick={() => godCommand("wh_on")} style={{ ...styles.miniBtn, ...styles.miniAmber }}>🌙 ВКЛ. ЧАС ВЕДЬМЫ</button>
            <button onClick={() => godCommand("wh_off")} style={{ ...styles.miniBtn, ...styles.miniGreen }}>ВЫКЛ. ЧАС</button>
            <button onClick={() => godCommand("eye_open")} style={{ ...styles.miniBtn, ...styles.miniAmber }}>👁 ОТКРЫТЬ ОКО +50%</button>
            <button onClick={() => godCommand("eye_close")} style={{ ...styles.miniBtn, ...styles.miniGreen }}>👁 ЗАКРЫТЬ ОКО</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   EDIT MODAL — edit existing record
   ============================================================ */
interface FullRecord {
  name?: string;
  category?: string;
  title?: string | null;
  description?: string | null;
  image_url?: string | null;
  sigil?: string | null;
  puzzle_type?: string;
  puzzle_hint?: string | null;
  puzzle_data?: unknown;
  shard_word?: string | null;
  prophecy_bonus_text?: string | null;
  map_x?: number;
  map_y?: number;
  custom_trigger?: unknown;
}

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
  const [name, setName] = useState(rec.name);
  const [category, setCategory] = useState(rec.category);
  const [title, setTitle] = useState(rec.title || "");
  const [description, setDescription] = useState(rec.description || "");
  const [imageUrl, setImageUrl] = useState(rec.image_url || "");
  const [sigil, setSigil] = useState(rec.sigil || "i-skull");
  const [puzzleType, setPuzzleType] = useState("none");
  const [puzzleHint, setPuzzleHint] = useState("");
  const [puzzleData, setPuzzleData] = useState("");
  const [shardWord, setShardWord] = useState("");
  const [prophecyBonusText, setProphecyBonusText] = useState("");
  const [mapX, setMapX] = useState("0");
  const [mapY, setMapY] = useState("0");
  const [customTrigger, setCustomTrigger] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/get?type=${type}&id=${rec.id}`);
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled || !j) return;
        const r = (j.record ?? j.data ?? j) as FullRecord;
        if (cancelled || !r || typeof r !== "object") return;
        if (typeof r.name === "string") setName(r.name);
        if (typeof r.category === "string") setCategory(r.category);
        if (typeof r.title === "string") setTitle(r.title);
        if (typeof r.description === "string") setDescription(r.description);
        if (typeof r.image_url === "string") setImageUrl(r.image_url);
        if (typeof r.sigil === "string") setSigil(r.sigil);
        if (typeof r.puzzle_type === "string") setPuzzleType(r.puzzle_type);
        if (typeof r.puzzle_hint === "string") setPuzzleHint(r.puzzle_hint);
        if (r.puzzle_data) setPuzzleData(typeof r.puzzle_data === "string" ? r.puzzle_data : JSON.stringify(r.puzzle_data, null, 2));
        if (typeof r.shard_word === "string") setShardWord(r.shard_word);
        if (typeof r.prophecy_bonus_text === "string") setProphecyBonusText(r.prophecy_bonus_text);
        if (typeof r.map_x === "number") setMapX(String(r.map_x));
        if (typeof r.map_y === "number") setMapY(String(r.map_y));
        if (r.custom_trigger) setCustomTrigger(typeof r.custom_trigger === "string" ? r.custom_trigger : JSON.stringify(r.custom_trigger, null, 2));
      } catch {
        /* ignore — fall back to list data */
      }
    })();
    return () => { cancelled = true; };
  }, [rec, type]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Name is required."); return; }
    let puzzleDataParsed: unknown = null;
    let customTriggerParsed: unknown = null;
    try {
      if (puzzleData.trim()) puzzleDataParsed = JSON.parse(puzzleData);
    } catch {
      setErr("puzzle_data: invalid JSON"); return;
    }
    try {
      if (customTrigger.trim()) customTriggerParsed = JSON.parse(customTrigger);
    } catch {
      setErr("custom_trigger: invalid JSON"); return;
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
          shard_word: shardWord.trim() || null,
          prophecy_bonus_text: prophecyBonusText.trim() || null,
          map_x: Number(mapX) || 0,
          map_y: Number(mapY) || 0,
          custom_trigger: customTriggerParsed,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "edit failed");
        return;
      }
      flash("ЗАПИСЬ ОБНОВЛЕНА");
      onSaved();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "network error");
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
          <label style={styles.fieldLabel}>NAME *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>CATEGORY</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>TITLE / EPITHET</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>DESCRIPTION / LORE</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical" }} />

          <label style={styles.fieldLabel}>IMAGE URL</label>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} type="url" style={styles.input} />

          <label style={styles.fieldLabel}>SIGIL</label>
          <select value={sigil} onChange={(e) => setSigil(e.target.value)} style={styles.select}>
            {SIGILS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>

          <label style={styles.fieldLabel}>PUZZLE TYPE</label>
          <select value={puzzleType} onChange={(e) => setPuzzleType(e.target.value)} style={styles.select}>
            {PUZZLE_TYPES.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>

          <label style={styles.fieldLabel}>PUZZLE HINT</label>
          <input value={puzzleHint} onChange={(e) => setPuzzleHint(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>PUZZLE DATA (JSON)</label>
          <textarea value={puzzleData} onChange={(e) => setPuzzleData(e.target.value)} rows={4} style={{ ...styles.input, resize: "vertical", fontFamily: "'Share Tech Mono', monospace" }} />

          <label style={styles.fieldLabel}>SHARD WORD</label>
          <input value={shardWord} onChange={(e) => setShardWord(e.target.value)} style={styles.input} />

          <label style={styles.fieldLabel}>PROPHECY BONUS TEXT</label>
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

          <label style={styles.fieldLabel}>CUSTOM TRIGGER (JSON)</label>
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
  err: { color: "#ff2424", fontSize: "13px", padding: "8px 12px", border: "1px solid #a01212", background: "rgba(255,36,36,.08)", letterSpacing: "1px", maxWidth: "360px", width: "100%", boxSizing: "border-box" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1a201a", background: "linear-gradient(180deg,#0a0d0a,#050505)", position: "sticky", top: 0, zIndex: 10 },
  headerTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "16px", letterSpacing: "2px", color: "#8a9588", display: "flex", alignItems: "center", gap: "8px" },
  headerDot: { width: "8px", height: "8px", borderRadius: "50%", background: "#4af626", boxShadow: "0 0 8px #4af626", display: "inline-block" },
  logoutBtn: { background: "none", border: "1px solid #a01212", color: "#ff2424", fontFamily: "'Share Tech Mono', monospace", fontSize: "12px", padding: "5px 12px", cursor: "pointer", letterSpacing: "1px", borderRadius: "2px" },
  tabs: { display: "flex", gap: "0", padding: "0 16px", borderBottom: "1px solid #1a201a" },
  tab: { flex: 1, background: "none", border: "none", borderBottom: "2px solid transparent", color: "#5d685c", fontFamily: "'Share Tech Mono', monospace", fontSize: "14px", letterSpacing: "2px", padding: "12px 4px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all .15s" },
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
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" },
  cardId: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", fontFamily: "'VT323', monospace" },
  cardStatus: { fontSize: "11px", padding: "2px 8px", border: "1px solid", letterSpacing: "1px", fontFamily: "'VT323', monospace" },
  statusOpen: { borderColor: "#2c8a17", color: "#4af626" },
  statusLocked: { borderColor: "#a01212", color: "#ff2424" },
  cardName: { fontFamily: "'MedievalSharp', serif", fontSize: "17px", color: "#b6c2b2", letterSpacing: "1px", lineHeight: "1.2" },
  cardTitle: { fontSize: "12px", color: "#2c8a17", letterSpacing: "1px", marginTop: "2px", fontFamily: "'VT323', monospace" },
  cardCat: { fontSize: "11px", color: "#5d685c", letterSpacing: "1px", marginTop: "4px" },
  cardDesc: { fontSize: "13px", color: "#8a9588", lineHeight: "1.5", marginTop: "6px" },
  toggleBtn: { width: "100%", marginTop: "10px", padding: "8px", fontSize: "13px", letterSpacing: "2px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s" },
  toggleUnlock: { background: "linear-gradient(180deg,rgba(74,246,38,.12),rgba(74,246,38,.03))", borderColor: "#4af626", color: "#4af626", textShadow: "0 0 6px rgba(74,246,38,.4)" },
  toggleLock: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424", textShadow: "0 0 6px rgba(255,36,36,.4)" },
  refreshBtn: { display: "block", margin: "20px auto", background: "none", border: "1px solid #2c8a17", color: "#4af626", fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", padding: "8px 20px", cursor: "pointer", letterSpacing: "2px", borderRadius: "2px" },
  toast: { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: "#0a0d0a", border: "1px solid #4af626", color: "#4af626", padding: "10px 24px", fontSize: "14px", letterSpacing: "2px", fontFamily: "'Share Tech Mono', monospace", borderRadius: "2px", boxShadow: "0 0 20px rgba(74,246,38,.3)", zIndex: 100 },
  cardActions: { display: "flex", gap: "6px", marginTop: "10px", alignItems: "stretch" },
  iconBtn: { width: "38px", minWidth: "38px", padding: "8px 0", fontSize: "15px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s", display: "flex", alignItems: "center", justifyContent: "center" },
  iconEdit: { background: "linear-gradient(180deg,rgba(232,161,58,.12),rgba(232,161,58,.03))", borderColor: "#e8a13a", color: "#e8a13a" },
  iconDel: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424" },
  miniBtn: { flex: 1, padding: "7px 4px", fontSize: "11px", letterSpacing: "1px", cursor: "pointer", borderRadius: "2px", fontFamily: "'Share Tech Mono', monospace", border: "1px solid", transition: "all .15s" },
  miniGreen: { background: "linear-gradient(180deg,rgba(74,246,38,.1),rgba(74,246,38,.02))", borderColor: "#4af626", color: "#4af626" },
  miniAmber: { background: "linear-gradient(180deg,rgba(232,161,58,.1),rgba(232,161,58,.02))", borderColor: "#e8a13a", color: "#e8a13a" },
  miniRed: { background: "linear-gradient(180deg,rgba(255,36,36,.1),rgba(255,36,36,.02))", borderColor: "#a01212", color: "#ff2424" },
  eventsWrap: { borderBottom: "1px solid #1a201a", background: "rgba(10,13,10,.4)" },
  eventsToggle: { width: "100%", background: "none", border: "none", color: "#e8a13a", fontFamily: "'Share Tech Mono', monospace", fontSize: "13px", letterSpacing: "2px", padding: "10px 16px", cursor: "pointer", textAlign: "left", textShadow: "0 0 8px rgba(232,161,58,.4)" },
  eventsBody: { padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: "4px" },
  eventsSectionTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "14px", color: "#e8a13a", letterSpacing: "2px", marginTop: "12px", marginBottom: "6px", paddingBottom: "4px", borderBottom: "1px solid #1a201a" },
  checkRow: { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#b6c2b2", letterSpacing: "1px", cursor: "pointer", padding: "4px 0" },
  checkbox: { width: "16px", height: "16px", accentColor: "#4af626", cursor: "pointer" },
  fieldRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
  timeRow: { display: "flex", gap: "6px", alignItems: "center" },
  godRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginTop: "6px" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "20px 12px", overflowY: "auto" },
  modalContent: { background: "#050505", border: "1px solid #4af626", borderRadius: "2px", maxWidth: "560px", width: "100%", margin: "auto", boxShadow: "0 0 40px rgba(74,246,38,.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1a201a", position: "sticky", top: 0, background: "#050505", zIndex: 1 },
  modalTitle: { fontFamily: "'MedievalSharp', serif", fontSize: "16px", color: "#4af626", letterSpacing: "2px", textShadow: "0 0 8px rgba(74,246,38,.5)" },
  modalClose: { background: "none", border: "1px solid #a01212", color: "#ff2424", width: "32px", height: "32px", cursor: "pointer", borderRadius: "2px", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" },
  modalForm: { padding: "16px", display: "flex", flexDirection: "column", gap: "4px" },
  modalActions: { display: "flex", gap: "8px", marginTop: "12px" },
  btnSecondary: { background: "none", borderColor: "#5d685c", color: "#8a9588", textShadow: "none" },
};
