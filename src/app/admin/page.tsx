"use client";

import { useState, useEffect, useCallback } from "react";

/* ============================================================
   ASHEN CODEX — Mobile Admin Panel  (/admin)
   Dark-fantasy themed, mobile-first. Password-gated.
   ============================================================ */

type RecordType = "npcs" | "lore" | "rulers";
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

const TABS: { key: RecordType; label: string }[] = [
  { key: "npcs", label: "НПС" },
  { key: "lore", label: "ЛОР" },
  { key: "rulers", label: "ПРАВИТ" },
];

const SIGILS = ["i-skull", "i-eye", "i-serpent", "i-crown", "i-flame", "i-hourglass", "i-ritual", "i-god"];

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
        <div style={styles.boot}>ПРОВЕРКА ВЕДОМОСТЕЙ СТРАЖА…</div>
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
            placeholder="ПАРОЛЬ"
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

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AllData>({ npcs: [], lore: [], rulers: [] });
  const [tab, setTab] = useState<RecordType>("npcs");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [toast, setToast] = useState("");

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
        flash(j.error || "сбой переключения");
        setData((d) => ({
          ...d,
          [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: currentLocked } : r)),
        }));
      } else {
        flash(currentLocked ? "ОТПЕЧАТАНО" : "РАСПЕЧАТАНО");
      }
    } catch {
      flash("сетевая ошибка");
      setData((d) => ({
        ...d,
        [type]: d[type].map((r) => (r.id === id ? { ...r, is_locked: currentLocked } : r)),
      }));
    }
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 1600);
  }

  const records = data[tab];
  const lockedCount = records.filter((r) => r.is_locked).length;

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.headerDot} />
          АШЕНОВ КОДЕКС <span style={{ color: "#4af626" }}>{"// СТРАЖ"}</span>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}>ВЫЙТИ</button>
      </header>

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
            <span style={styles.tabCount}>{data[t.key].length}</span>
          </button>
        ))}
      </nav>

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
          type={tab}
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
            {"// нажмите \"+ НОВАЯ ЗАПИСЬ\" для добавления."}
          </div>
        ) : (
          records.map((r) => (
            <RecordCard
              key={r.id}
              rec={r}
              onToggle={() => toggleLock(tab, r.id, r.is_locked)}
            />
          ))
        )}
      </div>

      <button onClick={load} style={styles.refreshBtn}>↻ ОБНОВИТЬ АРХИВ</button>

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

function RecordCard({ rec, onToggle }: { rec: ArchiveRecord; onToggle: () => void }) {
  const idShort = rec.id?.slice(0, 8).toUpperCase() || "—";
  return (
    <div style={{
      ...styles.card,
      ...(rec.is_locked ? styles.cardLocked : {}),
    }}>
      <div style={styles.cardHead}>
        <span style={styles.cardId}>№{idShort}</span>
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
      <button
        onClick={onToggle}
        style={{
          ...styles.toggleBtn,
          ...(rec.is_locked ? styles.toggleUnlock : styles.toggleLock),
        }}
      >
        {rec.is_locked ? "🔓 РАСПЕЧАТАТЬ" : "🔒 ОТПЕЧАТАТЬ"}
      </button>
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
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr("Имя обязательно."); return; }
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
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || "сбой загрузки");
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
      <div style={styles.uploadTitle}>+ НОВАЯ ЗАПИСЬ: {type === "npcs" ? "НПС" : type === "lore" ? "ЛОР" : "ПРАВИТЕЛЬ"}</div>

      <label style={styles.fieldLabel}>ИМЯ *</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Каэлен Пепельный" style={styles.input} />

      <label style={styles.fieldLabel}>КАТЕГОРИЯ</label>
      <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="напр. НЕЖИТЬ, ДЕМОН, ЛОР…" style={styles.input} />

      <label style={styles.fieldLabel}>ТИТУЛ / ЭПИТЕТ</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. // павший паладин" style={styles.input} />

      <label style={styles.fieldLabel}>ОПИСАНИЕ / ЛОР</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Текст лора…" rows={4} style={{ ...styles.input, resize: "vertical" }} />

      <label style={styles.fieldLabel}>ССЫЛКА НА КАРТИНКУ (необязательно)</label>
      <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…/image.png" style={styles.input} type="url" />

      <label style={styles.fieldLabel}>СИГИЛА</label>
      <select value={sigil} onChange={(e) => setSigil(e.target.value)} style={styles.select}>
        {SIGILS.map((s) => (<option key={s} value={s}>{s}</option>))}
      </select>

      {err && <div style={styles.err}>{err}</div>}

      <button type="submit" disabled={submitting} style={{ ...styles.btn, ...(submitting ? styles.btnDisabled : {}) }}>
        {submitting ? "ЗАГРУЗКА…" : "ЗАГРУЗИТЬ В АРХИВ"}
      </button>
    </form>
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
};
