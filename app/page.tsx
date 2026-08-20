"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import planData from "./plan-data.json";

type View = "today" | "plan" | "progress";
type Status = "planned" | "completed" | "modified" | "skipped";
type PlanSession = { id: string; date: string; endDate: string | null; block: string; week: string; weekTitle: string; day: string; category: string; session: string; pace: string; volume: string; notes: string };
type TrainingRecord = { status: Status; distance?: string; duration?: string; heartRate?: string; effort?: string; feelings?: string; notes?: string };

const sessions = planData as PlanSession[];
const STORAGE_KEY = "21k-training-log-records-v1";
const SCHEDULE_KEY = "21k-training-log-schedule-v1";
const statusLabels: Record<Status, string> = { planned: "Planificado", completed: "Completado", modified: "Modificado", skipped: "Omitido" };

function localISODate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function parseLocalDate(value: string) { return new Date(`${value}T12:00:00`); }
function formatDate(value: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", ...options }).format(parseLocalDate(value));
}
function formatDay(value: string) {
  const date = parseLocalDate(value);
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date).replace(".", "");
  return `${weekday.charAt(0).toLocaleUpperCase("es") + weekday.slice(1)} ${date.getDate()}`;
}
function getStatus(id: string, records: Record<string, TrainingRecord>): Status { return records[id]?.status ?? "planned"; }
function categoryClass(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function parseKm(value?: string) {
  const matches = value?.replace(",", ".").match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return 0;
  const values = matches.map(Number);
  return values.length > 1 ? (values[0] + values[1]) / 2 : values[0];
}
function SessionBadge({ category }: { category: string }) { return <span className={`session-badge ${categoryClass(category)}`}>{category}</span>; }
function StatusDot({ status }: { status: Status }) { return <span className={`status-dot ${status}`} aria-label={statusLabels[status]} />; }

export default function Home() {
  const [activeView, setActiveView] = useState<View>("today");
  const [records, setRecords] = useState<Record<string, TrainingRecord>>({});
  const [schedule, setSchedule] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<PlanSession | null>(null);
  const [moving, setMoving] = useState<PlanSession | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [hydrated, setHydrated] = useState(false);
  const today = localISODate();

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setRecords(JSON.parse(saved)); } catch { /* Keep the plan usable if local data is damaged. */ }
    try { const saved = localStorage.getItem(SCHEDULE_KEY); if (saved) setSchedule(JSON.parse(saved)); } catch { /* Ignore invalid schedule changes. */ }
    setHydrated(true);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }, [records, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule)); }, [schedule, hydrated]);

  const plannedSessions = useMemo(() => sessions.map((item) => {
    const date = schedule[item.id] ?? item.date;
    return date === item.date ? item : { ...item, date, day: formatDay(date) };
  }).sort((a, b) => a.date.localeCompare(b.date)), [schedule]);
  const todaySession = plannedSessions.find((item) => item.date === today);
  const nextSession = plannedSessions.find((item) => item.date > today && item.category !== "Descanso");
  const currentWeekKey = todaySession?.week ?? plannedSessions.find((item) => item.date >= today)?.week ?? plannedSessions.at(-1)?.week;
  const currentWeek = plannedSessions.filter((item) => item.week === currentWeekKey);
  const activeSessionCount = sessions.filter((item) => item.category !== "Descanso").length;
  const completed = Object.values(records).filter((record) => record.status === "completed" || record.status === "modified").length;
  const completedKm = Object.values(records).reduce((total, record) => total + (["completed", "modified"].includes(record.status) ? parseKm(record.distance) : 0), 0);
  const filteredSessions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    return plannedSessions.filter((item) => (category === "Todos" || item.category === category) && (!query || `${item.session} ${item.notes} ${item.weekTitle}`.toLocaleLowerCase("es").includes(query)));
  }, [search, category, plannedSessions]);
  const groupedSessions = useMemo(() => filteredSessions.reduce<Record<string, PlanSession[]>>((groups, item) => {
    const key = `${item.week} · ${item.weekTitle}`; (groups[key] ??= []).push(item); return groups;
  }, {}), [filteredSessions]);
  const saveRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const record: TrainingRecord = { status: (form.get("status") as Status) || "completed", distance: String(form.get("distance") || ""), duration: String(form.get("duration") || ""), heartRate: String(form.get("heartRate") || ""), effort: String(form.get("effort") || ""), feelings: String(form.get("feelings") || ""), notes: String(form.get("notes") || "") };
    setRecords((current) => ({ ...current, [selected.id]: record })); setSelected(null);
  };
  const swapSessions = (target: PlanSession) => {
    if (!moving || moving.id === target.id || moving.week !== target.week) return;
    setSchedule((current) => {
      const next = { ...current, [moving.id]: target.date, [target.id]: moving.date };
      [moving.id, target.id].forEach((id) => {
        const original = sessions.find((item) => item.id === id);
        if (original && next[id] === original.date) delete next[id];
      });
      return next;
    });
    setMoving(null);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setActiveView("today")} aria-label="Ir a hoy"><span className="brand-mark">21</span><span><strong>Veintiuno</strong><small>Training log</small></span></button>
      <nav className="main-nav" aria-label="Navegación principal"><NavButton active={activeView === "today"} icon="⌂" label="Hoy" onClick={() => setActiveView("today")} /><NavButton active={activeView === "plan"} icon="▦" label="Mi plan" onClick={() => setActiveView("plan")} /><NavButton active={activeView === "progress"} icon="↗" label="Progreso" onClick={() => setActiveView("progress")} /></nav>
      <div className="sidebar-goal"><span>Objetivo principal</span><strong>Sevilla · 1h50</strong><div className="goal-line"><i style={{ width: `${Math.min(100, (completed / activeSessionCount) * 100)}%` }} /></div><small>{completed} sesiones registradas</small></div>
    </aside>
    <main className="main-content">
      {activeView === "today" && <TodayView today={today} session={todaySession} nextSession={nextSession} currentWeek={currentWeek} records={records} onOpen={setSelected} onOpenPlan={() => setActiveView("plan")} />}
      {activeView === "plan" && <PlanView groupedSessions={groupedSessions} records={records} search={search} category={category} onSearch={setSearch} onCategory={setCategory} onOpen={setSelected} />}
      {activeView === "progress" && <ProgressView records={records} completed={completed} completedKm={completedKm} />}
    </main>
    <nav className="mobile-nav" aria-label="Navegación móvil"><NavButton active={activeView === "today"} icon="⌂" label="Hoy" onClick={() => setActiveView("today")} /><NavButton active={activeView === "plan"} icon="▦" label="Plan" onClick={() => setActiveView("plan")} /><NavButton active={activeView === "progress"} icon="↗" label="Progreso" onClick={() => setActiveView("progress")} /></nav>
    {selected && <RecordModal session={selected} record={records[selected.id]} onClose={() => setSelected(null)} onMove={() => { setMoving(selected); setSelected(null); }} onSubmit={saveRecord} />}
    {moving && <MoveSessionModal session={moving} weekSessions={plannedSessions.filter((item) => item.week === moving.week)} onClose={() => setMoving(null)} onSwap={swapSessions} />}
  </div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) { return <button className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span>{label}</button>; }

function TodayView({ today, session, nextSession, currentWeek, records, onOpen, onOpenPlan }: { today: string; session?: PlanSession; nextSession?: PlanSession; currentWeek: PlanSession[]; records: Record<string, TrainingRecord>; onOpen: (session: PlanSession) => void; onOpenPlan: () => void }) {
  const dateLabel = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return <>
    <header className="page-header"><div><p className="eyebrow">{dateLabel}</p><h1>Hola, vamos a por ello.</h1></div><div className="race-pill"><span>Próxima carrera</span><strong>Valencia · 25 oct</strong></div></header>
    <section className="hero-grid">
      <article className="today-card"><div className="card-topline"><div><span className="overline">ENTRENAMIENTO DE HOY</span><SessionBadge category={session?.category ?? "Descanso"} /></div>{session && <StatusDot status={getStatus(session.id, records)} />}</div>
        {session ? <><h2>{session.session}</h2><div className="metrics-row"><div><span>Volumen</span><strong>{session.volume}</strong></div><div><span>Ritmo</span><strong>{session.pace}</strong></div></div>{session.notes && <p className="coach-note"><span>i</span>{session.notes}</p>}<button className="primary-button" onClick={() => onOpen(session)}>{getStatus(session.id, records) === "planned" ? "Registrar entrenamiento" : "Ver o editar resultado"}<span>→</span></button></> : <div className="empty-today"><strong>Hoy no hay una sesión programada.</strong><p>Aprovecha para recuperar o consulta el plan completo.</p><button className="text-button" onClick={onOpenPlan}>Abrir mi plan →</button></div>}
      </article>
      <article className="goal-card valencia"><span className="overline">PRIMER OBJETIVO</span><p className="race-city">VALENCIA</p><div className="goal-time"><strong>1:58</strong><span>objetivo<br />sub 2 horas</span></div><div className="pace-target"><span>Ritmo objetivo</span><strong>5:35–5:41 <small>/km</small></strong></div></article>
      <article className="goal-card sevilla"><span className="overline">OBJETIVO PRINCIPAL</span><p className="race-city">SEVILLA</p><div className="goal-time"><strong>1:50</strong><span>29 noviembre<br />21,1 km</span></div><div className="pace-target"><span>Ritmo objetivo</span><strong>5:10–5:15 <small>/km</small></strong></div></article>
    </section>
    <section className="week-section"><div className="section-heading"><div><span className="overline">ESTA SEMANA</span><h2>{currentWeek[0]?.weekTitle ?? "Tu semana de entrenamiento"}</h2></div><button className="text-button" onClick={onOpenPlan}>Ver plan completo →</button></div><div className="week-strip">{currentWeek.map((item) => { const status = getStatus(item.id, records); return <button key={item.id} className={`week-day status-${status} ${item.date === today ? "is-today" : ""}`} onClick={() => onOpen(item)}><span className="day-name">{item.day.split(" ")[0]}</span><strong>{item.day.match(/\d+/)?.[0]}</strong><i className={`mini-dot ${categoryClass(item.category)}`} /><small>{status === "planned" ? (item.category === "Recuperacion" ? "Recuperación" : item.category) : statusLabels[status]}</small></button>; })}</div></section>
    {nextSession && <section className="next-card"><div className="next-date"><strong>{parseLocalDate(nextSession.date).getDate()}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(parseLocalDate(nextSession.date)).replace(".", "")}</span></div><div><span className="overline">PRÓXIMA SESIÓN</span><h3>{nextSession.session}</h3><p>{nextSession.volume} · {nextSession.pace}</p></div><button onClick={() => onOpen(nextSession)} aria-label="Abrir próxima sesión">→</button></section>}
  </>;
}

function PlanView({ groupedSessions, records, search, category, onSearch, onCategory, onOpen }: { groupedSessions: Record<string, PlanSession[]>; records: Record<string, TrainingRecord>; search: string; category: string; onSearch: (value: string) => void; onCategory: (value: string) => void; onOpen: (session: PlanSession) => void }) {
  const categories = ["Todos", ...new Set(sessions.map((item) => item.category))];
  return <><header className="page-header"><div><p className="eyebrow">14 agosto — 29 noviembre</p><h1>Mi plan de entrenamiento</h1><p className="header-copy">Plan completo para llegar con confianza a Valencia y Sevilla.</p></div></header><div className="plan-tools"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar una sesión" /></label><select value={category} onChange={(event) => onCategory(event.target.value)} aria-label="Filtrar por tipo">{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div><div className="plan-list">{Object.entries(groupedSessions).map(([week, items]) => <section className="plan-week" key={week}><div className="plan-week-title"><span>{items[0].block}</span><h2>{week}</h2></div><div className="plan-week-items">{items.map((item) => { const status = getStatus(item.id, records); return <button className="plan-row" key={item.id} onClick={() => onOpen(item)}><div className="plan-date"><strong>{parseLocalDate(item.date).getDate()}</strong><span>{new Intl.DateTimeFormat("es-ES", { month: "short" }).format(parseLocalDate(item.date)).replace(".", "")}</span></div><div className="plan-session"><div><SessionBadge category={item.category} /><span className={`row-status ${status}`}>{statusLabels[status]}</span></div><h3>{item.session}</h3>{item.notes && <p>{item.notes}</p>}</div><div className="plan-target"><span>{item.volume}</span><strong>{item.pace}</strong></div><span className="row-arrow">›</span></button>; })}</div></section>)}</div></>;
}

function ProgressView({ records, completed, completedKm }: { records: Record<string, TrainingRecord>; completed: number; completedKm: number }) {
  const counts = { completed: Object.values(records).filter((item) => item.status === "completed").length, modified: Object.values(records).filter((item) => item.status === "modified").length, skipped: Object.values(records).filter((item) => item.status === "skipped").length };
  const weeks = [...new Set(sessions.map((item) => item.week))];
  return <><header className="page-header"><div><p className="eyebrow">TU EVOLUCIÓN</p><h1>Progreso</h1><p className="header-copy">Cada sesión cuenta. Aquí verás cómo avanza tu preparación.</p></div></header><section className="stats-grid"><article><span>Sesiones registradas</span><strong>{completed}</strong><small>de {sessions.filter((item) => item.category !== "Descanso").length} activas</small></article><article><span>Kilómetros realizados</span><strong>{completedKm.toFixed(1)}</strong><small>km guardados</small></article><article><span>Cumplimiento</span><strong>{Math.round((completed / Math.max(1, completed + counts.skipped)) * 100)}%</strong><small>completadas o adaptadas</small></article></section><section className="progress-panel"><div className="section-heading"><div><span className="overline">POR SEMANA</span><h2>Constancia del plan</h2></div></div><div className="week-progress-list">{weeks.map((week) => { const weekSessions = sessions.filter((item) => item.week === week && item.category !== "Descanso"); const done = weekSessions.filter((item) => ["completed", "modified"].includes(records[item.id]?.status)).length; const percent = Math.round((done / Math.max(1, weekSessions.length)) * 100); return <div className="week-progress" key={week}><span>{week}</span><div><i style={{ width: `${percent}%` }} /></div><strong>{done}/{weekSessions.length}</strong></div>; })}</div></section><section className="legend-panel"><span><i className="legend-dot completed" /> Completados {counts.completed}</span><span><i className="legend-dot modified" /> Modificados {counts.modified}</span><span><i className="legend-dot skipped" /> Omitidos {counts.skipped}</span></section></>;
}

function RecordModal({ session, record, onClose, onMove, onSubmit }: { session: PlanSession; record?: TrainingRecord; onClose: () => void; onMove: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [status, setStatus] = useState<Status>(record?.status ?? "completed");
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">{formatDate(session.date, { weekday: "long" })}</p><h2 id="modal-title">{session.session}</h2><div className="modal-plan"><span><small>Plan</small>{session.volume}</span><span><small>Ritmo</small>{session.pace}</span></div>{session.notes && <p className="coach-note"><span>i</span>{session.notes}</p>}<button className="move-button" type="button" onClick={onMove}><span aria-hidden="true">⇄</span> Cambiar de día dentro de esta semana</button><form onSubmit={onSubmit}><fieldset className="status-picker"><legend>¿Cómo fue?</legend>{(["completed", "modified", "skipped", "planned"] as Status[]).map((item) => <label key={item} className={status === item ? "selected" : ""}><input type="radio" name="status" value={item} checked={status === item} onChange={() => setStatus(item)} />{statusLabels[item]}</label>)}</fieldset>{status !== "planned" && status !== "skipped" && <div className="form-grid"><label>Distancia real<input name="distance" defaultValue={record?.distance} placeholder="Ej. 8,2 km" /></label><label>Tiempo<input name="duration" defaultValue={record?.duration} placeholder="Ej. 48:30" /></label><label>Pulsaciones medias<input name="heartRate" inputMode="numeric" defaultValue={record?.heartRate} placeholder="Ej. 148" /></label><label>Esfuerzo (1–10)<input name="effort" type="number" min="1" max="10" defaultValue={record?.effort} placeholder="6" /></label><label className="full">Sensaciones<select name="feelings" defaultValue={record?.feelings ?? "Bien"}><option>Muy bien</option><option>Bien</option><option>Normal</option><option>Cansada</option><option>Con molestias</option></select></label></div>}<label className="notes-field">Notas<textarea name="notes" defaultValue={record?.notes} placeholder="¿Cómo te has sentido? ¿Algo que recordar?" rows={3} /></label><button className="primary-button" type="submit">Guardar resultado <span>→</span></button></form></section></div>;
}

function MoveSessionModal({ session, weekSessions, onClose, onSwap }: { session: PlanSession; weekSessions: PlanSession[]; onClose: () => void; onSwap: (target: PlanSession) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal move-modal" role="dialog" aria-modal="true" aria-labelledby="move-modal-title"><button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button><p className="eyebrow">REORGANIZAR · {session.week}</p><h2 id="move-modal-title">¿Con qué día quieres intercambiarlo?</h2><div className="moving-session"><SessionBadge category={session.category} /><strong>{formatDate(session.date, { weekday: "long" })}</strong><span>{session.session}</span></div><p className="move-help">El entrenamiento del día elegido ocupará el hueco actual. Los resultados guardados seguirán vinculados a cada entrenamiento.</p><div className="swap-list">{weekSessions.map((item) => <button key={item.id} type="button" disabled={item.id === session.id} onClick={() => onSwap(item)}><span className="swap-date"><strong>{parseLocalDate(item.date).getDate()}</strong><small>{new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(parseLocalDate(item.date)).replace(".", "")}</small></span><span className="swap-session"><SessionBadge category={item.category} /><strong>{item.id === session.id ? "Día actual" : item.session}</strong></span><span aria-hidden="true">{item.id === session.id ? "✓" : "⇄"}</span></button>)}</div></section></div>;
}
